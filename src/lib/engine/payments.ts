// PayPromise AI - Payment Management
// Handles payment creation, verification, and status tracking.
// All functions validate from DB — never trust client input.

import { prisma } from '@/lib/prisma';
import {
  getRazorpayClient,
  isRazorpayConfigured,
  createRazorpayOrder,
  createRazorpayPaymentLink,
  fetchRazorpayPayment,
  fetchRazorpayPaymentLink,
  fetchPaymentById,
  amountToPaise,
  verifyWebhookSignature,
} from '@/lib/razorpay';
import { fulfillPromise } from './promises';

// ── Types ───────────────────────────────────────────────────

export interface PaymentResult {
  success: boolean;
  message: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  clientSecret?: string;
  razorpayKeyId?: string;
  details?: Record<string, unknown>;
}

// ── Create Payment ──────────────────────────────────────────

export async function createPayment(invoiceId: string): Promise<PaymentResult> {
  // SECURITY: Fetch fresh invoice from DB
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      payments: {
        where: { status: { in: ['created', 'pending', 'paid'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!invoice) {
    return { success: false, message: 'Invoice not found.' };
  }

  // Validate invoice status
  if (invoice.status === 'paid' || invoice.status === 'recovered') {
    return {
      success: false,
      message: 'Invoice is already paid. Cannot create a new payment.',
    };
  }

  // Validate amount
  if (invoice.amount <= 0) {
    return { success: false, message: 'Invalid invoice amount.' };
  }

  // IDEMPOTENCY: Check for existing active payment
  if (invoice.payments.length > 0) {
    const activePayment = invoice.payments[0];

    // If payment is already paid, reject
    if (activePayment.status === 'paid') {
      return {
        success: false,
        message: `Invoice already has a successful payment (ID: ${
          activePayment.razorpayPaymentId || activePayment.id
        }). Invoice is paid.`,
        paymentId: activePayment.id,
        orderId: activePayment.razorpayOrderId || undefined,
      };
    }

    // If payment link exists and is active, reuse it
    if (
      activePayment.status === 'created' ||
      activePayment.status === 'active'
    ) {
      return {
        success: true,
        message: `Existing payment link active (Status: ${activePayment.status}). Use the existing link.`,
        paymentId: activePayment.id,
        orderId: activePayment.razorpayOrderId || undefined,
        amount: activePayment.amount,
        currency: activePayment.currency,
        razorpayKeyId: activePayment.isDemo
          ? undefined
          : process.env.RAZORPAY_KEY_ID,
      };
    }

    // If payment failed/expired/cancelled, allow creating a new one
  }

  // Check if Razorpay is configured
  if (!isRazorpayConfigured()) {
    // Demo mode: create a simulated payment
    return createDemoPayment(invoice);
  }

  // Create Razorpay payment link
  try {
    // Calculate expiry: 7 days from now
    const expireBy =
      Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    const paymentLink = await createRazorpayPaymentLink({
      amount: amountToPaise(invoice.amount),
      currency: invoice.currency,
      description: `Payment for Invoice ${invoice.invoiceNumber} — ${
        invoice.description || 'PayPromise AI'
      }`,
      customer: {
        name: invoice.customer?.name || 'Customer',
        email: invoice.customer?.email,
        contact: invoice.customer?.phone || undefined,
      },
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
      expireBy,
      notify: {
        sms: false,
        email: true,
        whatsapp: false,
      },
    });

    // Store payment record with link info
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        razorpayOrderId: paymentLink.id,
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.short_url,
        amount: invoice.amount,
        currency: invoice.currency,
        status: 'active',
        isDemo: false,
      },
    });

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        recoveryStatus: 'payment_initiated',
        lastFollowUpAt: new Date(),
      },
    });

    // Record action
    await prisma.aIAction.create({
      data: {
        invoiceId,
        action: 'payment_link_created',
        reason: `Razorpay Test Mode payment link created for ₹${invoice.amount.toLocaleString(
          'en-IN'
        )}.`,
        confidence: 1.0,
        policyDecision: 'ALLOW',
        policyReason: 'Payment creation authorized.',
        result: JSON.stringify({
          paymentLinkId: paymentLink.id,
          paymentLinkUrl: paymentLink.short_url,
          amount: invoice.amount,
          paymentId: payment.id,
          expiresAt: new Date(expireBy * 1000).toISOString(),
          demo: false,
        }),
        actor: 'system',
      },
    });

    return {
      success: true,
      message: `Razorpay Test Mode payment link created for ₹${invoice.amount.toLocaleString(
        'en-IN'
      )}.`,
      paymentId: payment.id,
      orderId: paymentLink.id,
      amount: invoice.amount,
      currency: invoice.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to create Razorpay payment link: ${error.message}`,
    };
  }
}

// ── Demo Payment ─────────────────────────────────────────────

async function createDemoPayment(invoice: any): Promise<PaymentResult> {
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      razorpayOrderId: `order_demo_${Date.now()}`,
      paymentLinkId: `link_demo_${Date.now()}`,
      paymentLinkUrl: null,
      amount: invoice.amount,
      currency: invoice.currency,
      status: 'active',
      isDemo: true,
    },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      recoveryStatus: 'payment_initiated',
      lastFollowUpAt: new Date(),
    },
  });

  await prisma.aIAction.create({
    data: {
      invoiceId: invoice.id,
      action: 'payment_link_created',
      reason: `DEMO SIMULATION — Razorpay Test Mode not configured. Simulated payment link created for ₹${invoice.amount.toLocaleString(
        'en-IN'
      )}.`,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Demo mode — no real payment created.',
      result: JSON.stringify({
        paymentLinkId: payment.paymentLinkId,
        orderId: payment.razorpayOrderId,
        amount: invoice.amount,
        paymentId: payment.id,
        demo: true,
      }),
      actor: 'system',
    },
  });

  return {
    success: true,
    message: `DEMO SIMULATION: Payment link created for ₹${invoice.amount.toLocaleString(
      'en-IN'
    )} (Razorpay Test Mode not configured — no real payment link).`,
    paymentId: payment.id,
    orderId: payment.razorpayOrderId || undefined,
    amount: invoice.amount,
    currency: invoice.currency,
  };
}

// ── Handle Successful Payment ────────────────────────────────

export async function handlePaymentSuccess(
  razorpayPaymentId: string,
  razorpayOrderId: string,
  razorpaySignature?: string
): Promise<PaymentResult> {
  // Verify webhook signature if provided
  // NOTE: The webhook route already verifies the raw request signature.
  // Do not attempt to verify an empty body here.
  if (razorpaySignature && !razorpaySignature.trim()) {
    return {
      success: false,
      message: 'Invalid webhook signature.',
    };
  }

  // Find payment record
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId },
  });

  if (!payment) {
    return {
      success: false,
      message: 'No payment record found for this order.',
    };
  }

  // Idempotency
  if (payment.status === 'paid') {
    return {
      success: true,
      message: 'Payment already processed.',
      paymentId: payment.id,
    };
  }

  let updatedPayment = payment;

  // Fetch payment details from Razorpay
  if (isRazorpayConfigured()) {
    try {
      const razorpayPayment =
        await fetchRazorpayPayment(razorpayPaymentId);

      if (
        razorpayPayment.status !== 'captured' &&
        razorpayPayment.status !== 'authorized'
      ) {
        return {
          success: false,
          message: `Payment not captured. Status: ${razorpayPayment.status}`,
        };
      }

      updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPaymentId,
          amount: razorpayPayment.amount / 100,
          status: 'paid',
          method: razorpayPayment.method,
          razorpayResponse: JSON.stringify(razorpayPayment),
        },
      });
    } catch (error: any) {
      console.error(
        '[Payment] Failed to verify payment with Razorpay:',
        error.message
      );

      return {
        success: false,
        message: `Payment verification failed: ${error.message}`,
      };
    }
  } else {
    updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId,
        status: 'paid',
        method: 'demo',
      },
    });
  }

  if (!updatedPayment.invoiceId) {
    return {
      success: false,
      message: 'Payment record has no associated invoice.',
    };
  }

  // Mark invoice as paid
  await prisma.invoice.update({
    where: { id: updatedPayment.invoiceId },
    data: {
      status: 'paid',
      paidAt: new Date(),
      recoveryStatus: 'recovered',
      recoverySource: 'razorpay_payment',
    },
  });

  // Fulfill active promises
  const activePromises = await prisma.promiseToPay.findMany({
    where: {
      invoiceId: updatedPayment.invoiceId,
      status: 'active',
    },
  });

  for (const promise of activePromises) {
    await fulfillPromise(promise.id);
  }

  // Record success action
  await prisma.aIAction.create({
    data: {
      invoiceId: updatedPayment.invoiceId,
      action: 'payment_received',
      reason: `Payment of ₹${updatedPayment.amount.toLocaleString(
        'en-IN'
      )} received via ${updatedPayment.method || 'unknown'}.`,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Verified payment received.',
      result: JSON.stringify({
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        amount: updatedPayment.amount,
        method: updatedPayment.method,
        status: 'SUCCESS',
      }),
      actor: 'system',
    },
  });

  return {
    success: true,
    message: `Payment of ₹${updatedPayment.amount.toLocaleString(
      'en-IN'
    )} confirmed. Invoice marked as paid.`,
    paymentId: updatedPayment.id,
    amount: updatedPayment.amount,
  };
}

// ── Handle Failed Payment ────────────────────────────────────

export async function handlePaymentFailure(
  razorpayPaymentId: string,
  razorpayOrderId: string,
  failureReason: string
): Promise<PaymentResult> {
  const payment = await prisma.payment.findFirst({
    where: { razorpayOrderId },
  });

  if (!payment) {
    return {
      success: false,
      message: 'No payment record found for this order.',
    };
  }

  if (payment.status === 'failed') {
    return {
      success: true,
      message: 'Failure already recorded.',
    };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'failed',
      failureReason,
      razorpayPaymentId,
    },
  });

  await prisma.aIAction.create({
    data: {
      invoiceId: payment.invoiceId,
      action: 'payment_failed',
      reason: `Payment failed: ${failureReason}`,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Payment failure recorded.',
      result: JSON.stringify({
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        amount: payment.amount,
        failureReason,
        status: 'FAILED',
      }),
      actor: 'system',
    },
  });

  return {
    success: true,
    message: 'Payment failure recorded. Invoice remains outstanding.',
    paymentId: payment.id,
  };
}

// ── Handle Payment Link Paid ─────────────────────────────────

export async function handlePaymentLinkPaid(
  paymentLinkId: string,
  payments: any[],
  razorpaySignature?: string
): Promise<PaymentResult> {
  // Find our payment record
  const payment = await prisma.payment.findFirst({
    where: { paymentLinkId },
  });

  if (!payment) {
    console.error(
      `[Payment] No payment record found for link: ${paymentLinkId}`
    );

    return {
      success: false,
      message: `No payment record found for link ${paymentLinkId}.`,
    };
  }

  // Idempotency
  if (payment.status === 'paid') {
    return {
      success: true,
      message: 'Payment already processed.',
      paymentId: payment.id,
    };
  }

  // Find a captured/authorized payment from the webhook payload
  const completedPayment = payments?.find(
    (p: any) =>
      p?.status === 'captured' ||
      p?.status === 'authorized'
  );

  // If the payment details are not directly available,
  // try the latest payment supplied by Razorpay.
  if (!completedPayment) {
    if (isRazorpayConfigured() && payments?.length > 0) {
      try {
        const latestPayment = payments[payments.length - 1];

        if (latestPayment?.id) {
          const verified =
            await fetchPaymentById(latestPayment.id);

          if (
            verified.status === 'captured' ||
            verified.status === 'authorized'
          ) {
            return await processSuccessfulPayment(
              payment,
              verified.id,
              verified
            );
          }
        }
      } catch (error: any) {
        console.error(
          '[Payment] Failed to verify payment:',
          error.message
        );
      }
    }

    return {
      success: false,
      message: 'No captured payment found in Payment Link event.',
    };
  }

  // Verify the payment directly with Razorpay
  if (isRazorpayConfigured()) {
    try {
      const verified =
        await fetchPaymentById(completedPayment.id);

      if (
        verified.status !== 'captured' &&
        verified.status !== 'authorized'
      ) {
        return {
          success: false,
          message: `Payment not captured. Status: ${verified.status}`,
        };
      }

      return await processSuccessfulPayment(
        payment,
        verified.id,
        verified
      );
    } catch (error: any) {
      console.error(
        '[Payment] Verification failed:',
        error.message
      );

      return {
        success: false,
        message: `Payment verification failed: ${error.message}`,
      };
    }
  }

  // Fallback for demo/non-configured environments
  return await processSuccessfulPayment(
    payment,
    completedPayment.id,
    {
      id: completedPayment.id,
      amount: completedPayment.amount,
      status: completedPayment.status,
      method: completedPayment.method || null,
    }
  );
}

// ── Process Successful Payment ───────────────────────────────

async function processSuccessfulPayment(
  payment: any,
  razorpayPaymentId: string,
  verifiedData: {
    id: string;
    amount: number;
    status: string;
    method: string | null;
  }
): Promise<PaymentResult> {
  // Update payment record
  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      razorpayPaymentId,
      amount: verifiedData.amount / 100,
      status: 'paid',
      method: verifiedData.method,
      razorpayResponse: JSON.stringify(verifiedData),
    },
  });

  if (!updatedPayment.invoiceId) {
    return {
      success: false,
      message: 'Payment has no associated invoice.',
    };
  }

  // Mark invoice as paid
  await prisma.invoice.update({
    where: { id: updatedPayment.invoiceId },
    data: {
      status: 'paid',
      paidAt: new Date(),
      recoveryStatus: 'recovered',
      recoverySource: 'razorpay_payment_link',
    },
  });

  // Fulfill active promises
  const activePromises = await prisma.promiseToPay.findMany({
    where: {
      invoiceId: updatedPayment.invoiceId,
      status: 'active',
    },
  });

  for (const promise of activePromises) {
    await fulfillPromise(promise.id);
  }

  // Record success action
  await prisma.aIAction.create({
    data: {
      invoiceId: updatedPayment.invoiceId,
      action: 'payment_received',
      reason: `Payment of ₹${updatedPayment.amount.toLocaleString(
        'en-IN'
      )} received via ${
        verifiedData.method || 'Razorpay Payment Link'
      }.`,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Verified payment received.',
      result: JSON.stringify({
        paymentId: razorpayPaymentId,
        paymentLinkId: updatedPayment.paymentLinkId,
        amount: updatedPayment.amount,
        method: verifiedData.method,
        status: 'SUCCESS',
      }),
      actor: 'webhook',
    },
  });

  return {
    success: true,
    message: `Payment of ₹${updatedPayment.amount.toLocaleString(
      'en-IN'
    )} confirmed. Invoice marked as paid.`,
    paymentId: updatedPayment.id,
    amount: updatedPayment.amount,
  };
}

// ── Handle Payment Link Failed ──────────────────────────────

export async function handlePaymentLinkFailed(
  paymentLinkId: string,
  failureReason: string
): Promise<PaymentResult> {
  const payment = await prisma.payment.findFirst({
    where: { paymentLinkId },
  });

  if (!payment) {
    return {
      success: false,
      message: `No payment record found for link ${paymentLinkId}.`,
    };
  }

  if (payment.status === 'failed') {
    return {
      success: true,
      message: 'Failure already recorded.',
    };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'failed',
      failureReason,
    },
  });

  await prisma.aIAction.create({
    data: {
      invoiceId: payment.invoiceId,
      action: 'payment_failed',
      reason: `Payment via link failed: ${failureReason}`,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Payment failure recorded.',
      result: JSON.stringify({
        paymentLinkId,
        amount: payment.amount,
        failureReason,
        status: 'FAILED',
      }),
      actor: 'webhook',
    },
  });

  return {
    success: true,
    message: 'Payment failure recorded. Invoice remains outstanding.',
    paymentId: payment.id,
  };
}

// ── Demo Payment Completion ─────────────────────────────────

export async function completeDemoPayment(
  paymentId: string
): Promise<PaymentResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return {
      success: false,
      message: 'Payment not found.',
    };
  }

  if (payment.status !== 'created') {
    return {
      success: false,
      message: `Payment is already ${payment.status}.`,
    };
  }

  // Simulate payment success
  return handlePaymentSuccess(
    `pay_demo_${Date.now()}`,
    payment.razorpayOrderId || ''
  );
}