// PayPromise AI - Manual Razorpay Payment Sync
//
// This endpoint allows the frontend to manually check whether
// a Razorpay Payment Link has been paid.
//
// Flow:
//
// Database Payment
//       ↓
// Razorpay Payment Link
//       ↓
// Payment Link status
//       ↓
// order_id
//       ↓
// Order Payments API
//       ↓
// captured payment
//       ↓
// handlePaymentLinkPaid()
//       ↓
// Invoice recovered

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

import {
  handlePaymentLinkPaid,
  handlePaymentLinkFailed,
} from '@/lib/engine/payments';

import {
  isRazorpayConfigured,
  fetchRazorpayPaymentLink,
  fetchPaymentsForLink,
} from '@/lib/razorpay';

// Prevent Next.js from caching this API route.
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest
) {
  try {
    // ─────────────────────────────────────────────
    // 1. Read request body
    // ─────────────────────────────────────────────

    const body = await request.json();

    const paymentId = body?.paymentId;

    if (
      !paymentId ||
      typeof paymentId !== 'string'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'paymentId is required',
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      `[Sync] Starting payment sync: ${paymentId}`
    );

    // ─────────────────────────────────────────────
    // 2. Find payment in database
    // ─────────────────────────────────────────────

    const payment =
      await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },
      });

    if (!payment) {
      console.error(
        `[Sync] Payment ${paymentId} not found in database`
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Payment not found',
        },
        {
          status: 404,
        }
      );
    }

    console.log('[Sync] Database payment:', {
      id: payment.id,
      status: payment.status,
      paymentLinkId: payment.paymentLinkId,
    });

    // ─────────────────────────────────────────────
    // 3. Already paid
    // ─────────────────────────────────────────────

    if (payment.status === 'paid') {
      return NextResponse.json({
        success: true,
        message: 'Payment already processed.',
        status: 'paid',
        paymentId: payment.id,
      });
    }

    // ─────────────────────────────────────────────
    // 4. Check Razorpay configuration
    // ─────────────────────────────────────────────

    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Razorpay is not configured. Cannot sync payment status.',
        },
        {
          status: 400,
        }
      );
    }

    // ─────────────────────────────────────────────
    // 5. Get Payment Link ID
    // ─────────────────────────────────────────────

    const linkId =
      payment.paymentLinkId;

    if (!linkId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No Razorpay payment link ID found for this payment.',
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      `[Sync] Checking Razorpay Payment Link: ${linkId}`
    );

    // ─────────────────────────────────────────────
    // 6. Fetch Payment Link
    // ─────────────────────────────────────────────

    const link =
      await fetchRazorpayPaymentLink(
        linkId
      );

    console.log(
      '[Sync] Razorpay Payment Link status:',
      {
        id: link.id,
        status: link.status,
        amount: link.amount,
        amount_paid: link.amount_paid,
        order_id: link.order_id,
      }
    );

    // ─────────────────────────────────────────────
    // 7. If link is not paid, check failed/active
    // ─────────────────────────────────────────────

    if (
      link.status !== 'paid'
    ) {
      console.log(
        `[Sync] Payment Link ${linkId} is not paid. Status: ${link.status}`
      );

      return NextResponse.json({
        success: false,
        status: link.status,
        message:
          `Payment has not completed yet. Payment link status: ${link.status}`,
      });
    }

    // ─────────────────────────────────────────────
    // 8. Payment Link says PAID
    // ─────────────────────────────────────────────

    console.log(
      `[Sync] Payment Link ${linkId} is PAID.`
    );

    // ─────────────────────────────────────────────
    // 9. Fetch actual payments
    //
    // fetchPaymentsForLink() internally performs:
    //
    // Payment Link
    //     ↓
    // order_id
    //     ↓
    // /v1/orders/{order_id}/payments
    // ─────────────────────────────────────────────

    let payments;

    try {
      payments =
        await fetchPaymentsForLink(
          linkId
        );
    } catch (error: any) {
      console.error(
        '[Sync] Failed to retrieve payments:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          status: 'paid',

          message:
            'Payment link is paid, but the completed payment details could not be retrieved. Please sync again.',

          error:
            error?.message ||
            'Unable to retrieve payment details',
        },
        {
          status: 502,
        }
      );
    }

    console.log(
      `[Sync] Retrieved ${payments.length} payment(s)`
    );

    // ─────────────────────────────────────────────
    // 10. Find captured payment
    // ─────────────────────────────────────────────

    const successfulPayment =
      payments.find(
        (p) =>
          p.status === 'captured'
      );

    // ─────────────────────────────────────────────
    // 11. Captured payment found
    // ─────────────────────────────────────────────

    if (successfulPayment) {
      console.log(
        '[Sync] CAPTURED payment found:',
        {
          paymentId:
            successfulPayment.id,

          orderId:
            successfulPayment.order_id,

          amount:
            successfulPayment.amount,

          status:
            successfulPayment.status,

          method:
            successfulPayment.method,
        }
      );

      // ───────────────────────────────────────────
      // Process payment
      // ───────────────────────────────────────────

      const result =
        await handlePaymentLinkPaid(
          linkId,
          [successfulPayment]
        );

      console.log(
        '[Sync] handlePaymentLinkPaid result:',
        result
      );

      return NextResponse.json({
        success: result.success,

        message:
          result.message,

        status: 'paid',

        paymentId:
          successfulPayment.id,

        orderId:
          successfulPayment.order_id,
      });
    }

    // ─────────────────────────────────────────────
    // 12. Authorized payment
    // ─────────────────────────────────────────────
    //
    // Normally Payment Link completion should result
    // in a captured payment. We still handle authorized
    // payments safely.
    // ─────────────────────────────────────────────

    const authorizedPayment =
      payments.find(
        (p) =>
          p.status === 'authorized'
      );

    if (authorizedPayment) {
      console.log(
        '[Sync] AUTHORIZED payment found:',
        {
          paymentId:
            authorizedPayment.id,

          orderId:
            authorizedPayment.order_id,

          amount:
            authorizedPayment.amount,
        }
      );

      const result =
        await handlePaymentLinkPaid(
          linkId,
          [authorizedPayment]
        );

      return NextResponse.json({
        success: result.success,

        message:
          result.message,

        status: 'paid',

        paymentId:
          authorizedPayment.id,

        orderId:
          authorizedPayment.order_id,
      });
    }

    // ─────────────────────────────────────────────
    // 13. Failed payment
    // ─────────────────────────────────────────────

    const failedPayment =
      payments.find(
        (p) =>
          p.status === 'failed'
      );

    if (failedPayment) {
      console.log(
        '[Sync] FAILED payment found:',
        {
          paymentId:
            failedPayment.id,

          amount:
            failedPayment.amount,
        }
      );

      const result =
        await handlePaymentLinkFailed(
          linkId,
          'Payment failed (detected via manual sync)'
        );

      return NextResponse.json({
        success: result.success,

        message:
          result.message,

        status: 'failed',

        paymentId:
          failedPayment.id,
      });
    }

    // ─────────────────────────────────────────────
    // 14. Payment Link paid but payment unavailable
    // ─────────────────────────────────────────────

    console.warn(
      `[Sync] Payment Link ${linkId} is PAID but no captured payment was returned.`
    );

    return NextResponse.json({
      success: false,

      status: 'paid',

      message:
        'Payment link is paid, but the completed payment details are not available yet. Please sync again.',
    });

  } catch (error: any) {
    // ─────────────────────────────────────────────
    // Global error handler
    // ─────────────────────────────────────────────

    console.error(
      '[Sync] Fatal error:',
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          'Sync failed: ' +
          (error?.message ||
            'Unknown error'),
      },
      {
        status: 500,
      }
    );
  }
}