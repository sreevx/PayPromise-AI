// PayPromise AI - Razorpay Webhook Endpoint
// Handles payment.captured, payment.failed, payment_link.paid, payment_link.failed events.
// Verifies webhook signature. Idempotent processing.

import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentSuccess, handlePaymentFailure, handlePaymentLinkPaid, handlePaymentLinkFailed } from '@/lib/engine/payments';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Log webhook for audit
    await prisma.auditLog.create({
      data: {
        action: 'webhook_received',
        actor: 'razorpay',
        details: JSON.stringify({
          event: event.event,
          payload: event.payload ? Object.keys(event.payload) : [],
        }),
      },
    });

    console.log(`[Webhook] Received event: ${event.event}`);

    // Handle payment events (from Order-based checkout)
    switch (event.event) {
      case 'payment.captured':
      case 'payment.authorized': {
        const payment = event.payload?.payment?.entity;
        if (!payment) {
          return NextResponse.json({ error: 'No payment entity' }, { status: 400 });
        }

        const result = await handlePaymentSuccess(
          payment.id,
          payment.order_id,
          signature,
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'payment.failed': {
        const payment = event.payload?.payment?.entity;
        if (!payment) {
          return NextResponse.json({ error: 'No payment entity' }, { status: 400 });
        }

        const failureReason = payment.error_description || payment.error_reason || 'Unknown failure';
        const result = await handlePaymentFailure(
          payment.id,
          payment.order_id,
          failureReason,
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      // ── Payment Link Events ─────────────────────────────
      // Razorpay sends these for Payment Link-based payments

      case 'payment_link.paid': {
        const paymentLink = event.payload?.payment_link?.entity;
        if (!paymentLink) {
          console.error('[Webhook] No payment_link entity in payment_link.paid event');
          return NextResponse.json({ error: 'No payment_link entity' }, { status: 400 });
        }

        console.log(`[Webhook] Payment Link paid: ${paymentLink.id}`);

        const result = await handlePaymentLinkPaid(
          paymentLink.id,
          paymentLink.payments || [],
          signature,
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'payment_link.failed': {
        const paymentLink = event.payload?.payment_link?.entity;
        if (!paymentLink) {
          return NextResponse.json({ error: 'No payment_link entity' }, { status: 400 });
        }

        console.log(`[Webhook] Payment Link failed: ${paymentLink.id}`);

        const result = await handlePaymentLinkFailed(
          paymentLink.id,
          'Payment failed via Payment Link',
        );

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      }

      case 'payment_link.cancelled':
      case 'payment_link.expired': {
        const paymentLink = event.payload?.payment_link?.entity;
        if (!paymentLink) {
          return NextResponse.json({ error: 'No payment_link entity' }, { status: 400 });
        }

        console.log(`[Webhook] Payment Link ${event.event}: ${paymentLink.id}`);

        // Update payment record status
        const payment = await prisma.payment.findFirst({
          where: { paymentLinkId: paymentLink.id },
        });

        if (payment && payment.status !== 'paid') {
          const newStatus = event.event === 'payment_link.expired' ? 'expired' : 'cancelled';
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: newStatus },
          });

          await prisma.aIAction.create({
            data: {
              invoiceId: payment.invoiceId,
              action: `payment_link_${newStatus}`,
              reason: `Payment link ${newStatus}: ${paymentLink.id}`,
              confidence: 1.0,
              policyDecision: 'ALLOW',
              policyReason: 'Webhook event recorded.',
              result: JSON.stringify({ paymentLinkId: paymentLink.id, status: newStatus }),
              actor: 'webhook',
            },
          });
        }

        return NextResponse.json({ received: true });
      }

      default:
        // Unhandled event type — acknowledge receipt
        console.log(`[Webhook] Unhandled event: ${event.event}`);
        return NextResponse.json({ received: true });
    }
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'razorpay-webhook' });
}
