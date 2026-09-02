// PayPromise AI - Payment Engine
// Handles Razorpay Checkout payments, demo payments,
// payment verification, invoice recovery, and promise fulfillment.

import crypto from 'crypto';

import { prisma } from '@/lib/prisma';

import {
  isRazorpayConfigured,
  createRazorpayOrder,
  fetchRazorpayPayment,
  amountToPaise,
} from '@/lib/razorpay';

import { fulfillPromise } from './promises';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Create Payment
// ─────────────────────────────────────────────────────────────

export async function createPayment(
  invoiceId: string
): Promise<PaymentResult> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },

      include: {
        customer: true,

        payments: {
          orderBy: {
            createdAt: 'desc',
          },

          take: 10,
        },
      },
    });

    if (!invoice) {
      return {
        success: false,
        message: 'Invoice not found.',
      };
    }

    // ----------------------------------------------------------
    // Already paid
    // ----------------------------------------------------------

    if (
      invoice.status === 'paid' ||
      invoice.recoveryStatus === 'recovered'
    ) {
      return {
        success: false,
        message: 'This invoice has already been paid.',
      };
    }

    // ----------------------------------------------------------
    // Validate amount
    // ----------------------------------------------------------

    const amount = Number(invoice.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        success: false,
        message: 'Invalid invoice amount.',
      };
    }

    const currency = invoice.currency || 'INR';

    // ----------------------------------------------------------
    // Reuse existing payment
    // ----------------------------------------------------------

    const existingPayment = invoice.payments.find(
      (payment) =>
        [
          'created',
          'pending',
          'active',
          'paid',
        ].includes(payment.status)
    );

    if (existingPayment) {
      return {
        success: existingPayment.status !== 'paid',

        message:
          existingPayment.status === 'paid'
            ? 'Payment has already been completed.'
            : 'An active payment already exists for this invoice.',

        paymentId: existingPayment.id,

        orderId:
          existingPayment.razorpayOrderId ||
          undefined,

        amount:
          Number(existingPayment.amount),

        currency:
          existingPayment.currency ||
          currency,

        razorpayKeyId:
          isRazorpayConfigured()
            ? process.env.RAZORPAY_KEY_ID
            : undefined,

        details: {
          reused: true,
          status: existingPayment.status,
        },
      };
    }

    // ----------------------------------------------------------
    // Demo fallback
    // ----------------------------------------------------------

    if (!isRazorpayConfigured()) {
      return createDemoPayment(invoice);
    }

    // ----------------------------------------------------------
    // Create Razorpay Order
    // ----------------------------------------------------------

    const razorpayOrder =
      await createRazorpayOrder({
        amount: amountToPaise(amount),

        currency,

        receipt:
          `invoice_${invoice.id}`,

        notes: {
          invoiceId:
            invoice.id,

          invoiceNumber:
            invoice.invoiceNumber,

          customerId:
            invoice.customerId,

          customerName:
            invoice.customer?.name || '',
        },
      });

    // ----------------------------------------------------------
    // Store payment
    // ----------------------------------------------------------

    const payment =
      await prisma.payment.create({
        data: {
          invoiceId:
            invoice.id,

          razorpayOrderId:
            razorpayOrder.id,

          paymentLinkId:
            null,

          paymentLinkUrl:
            null,

          amount,

          currency,

          status:
            'active',

          isDemo:
            false,
        },
      });

    // ----------------------------------------------------------
    // Update invoice recovery status
    // ----------------------------------------------------------

    await prisma.invoice.update({
      where: {
        id: invoice.id,
      },

      data: {
        recoveryStatus:
          'payment_initiated',
      },
    });

    // ----------------------------------------------------------
    // Audit AI action
    //
    // AIAction schema:
    // action
    // reason
    // confidence
    // policyDecision
    // policyReason
    // result
    // actor
    // ----------------------------------------------------------

    await prisma.aIAction.create({
      data: {
        invoiceId:
          invoice.id,

        action:
          'payment_link_created',

        reason:
          'Razorpay Checkout payment order created for invoice recovery.',

        confidence:
          1,

        policyDecision:
          'ALLOW',

        policyReason:
          'Payment creation permitted by the recovery engine.',

        result:
          JSON.stringify({
            provider:
              'razorpay',

            orderId:
              razorpayOrder.id,

            paymentId:
              payment.id,

            amount,

            currency,

            testMode:
              process.env.RAZORPAY_KEY_ID?.startsWith(
                'rzp_test_'
              ) || false,
          }),

        actor:
          'engine',
      },
    });

    return {
      success: true,

      message:
        'Razorpay payment order created successfully.',

      paymentId:
        payment.id,

      orderId:
        razorpayOrder.id,

      amount:
        razorpayOrder.amount,

      currency:
        razorpayOrder.currency,

      razorpayKeyId:
        process.env.RAZORPAY_KEY_ID,

      details: {
        provider:
          'razorpay',

        testMode:
          process.env.RAZORPAY_KEY_ID?.startsWith(
            'rzp_test_'
          ) || false,
      },
    };
  } catch (error) {
    console.error(
      '[Payment] Failed to create payment:',
      error
    );

    return {
      success: false,

      message:
        error instanceof Error
          ? error.message
          : 'Failed to create payment.',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Demo Payment
// ─────────────────────────────────────────────────────────────

async function createDemoPayment(
  invoice: any
): Promise<PaymentResult> {
  try {
    const payment =
      await prisma.payment.create({
        data: {
          invoiceId:
            invoice.id,

          razorpayOrderId:
            null,

          paymentLinkId:
            null,

          paymentLinkUrl:
            null,

          amount:
            Number(invoice.amount),

          currency:
            invoice.currency || 'INR',

          status:
            'active',

          isDemo:
            true,
        },
      });

    await prisma.invoice.update({
      where: {
        id: invoice.id,
      },

      data: {
        recoveryStatus:
          'payment_initiated',
      },
    });

    await prisma.aIAction.create({
      data: {
        invoiceId:
          invoice.id,

        action:
          'payment_link_created',

        reason:
          'Demo payment created because Razorpay is not configured.',

        confidence:
          1,

        policyDecision:
          'ALLOW',

        policyReason:
          'Demo payment fallback permitted by the payment engine.',

        result:
          JSON.stringify({
            provider:
              'demo',

            paymentId:
              payment.id,

            amount:
              Number(invoice.amount),

            currency:
              invoice.currency || 'INR',
          }),

        actor:
          'engine',
      },
    });

    return {
      success: true,

      message:
        'Demo payment created successfully.',

      paymentId:
        payment.id,

      amount:
        Number(invoice.amount),

      currency:
        invoice.currency || 'INR',

      details: {
        provider:
          'demo',

        demo:
          true,
      },
    };
  } catch (error) {
    console.error(
      '[Payment] Failed to create demo payment:',
      error
    );

    return {
      success: false,

      message:
        error instanceof Error
          ? error.message
          : 'Failed to create demo payment.',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Razorpay Checkout Success
// ─────────────────────────────────────────────────────────────

export async function handlePaymentSuccess(
  razorpayPaymentId: string,
  razorpayOrderId: string,
  razorpaySignature?: string
): Promise<PaymentResult> {
  try {
    if (
      !razorpayPaymentId ||
      !razorpayOrderId
    ) {
      return {
        success: false,

        message:
          'Missing Razorpay payment or order ID.',
      };
    }

    // ----------------------------------------------------------
    // Find local payment
    // ----------------------------------------------------------

    const payment =
      await prisma.payment.findFirst({
        where: {
          razorpayOrderId,
        },

        include: {
          invoice: true,
        },
      });

    if (!payment) {
      return {
        success: false,

        message:
          'Payment order was not found in PayPromise AI.',
      };
    }

    // ----------------------------------------------------------
    // Idempotency
    // ----------------------------------------------------------

    if (payment.status === 'paid') {
      return {
        success: true,

        message:
          'Payment has already been processed.',

        paymentId:
          payment.id,

        orderId:
          razorpayOrderId,

        amount:
          Number(payment.amount),

        currency:
          payment.currency || 'INR',
      };
    }

    // ----------------------------------------------------------
    // Razorpay payment verification
    // ----------------------------------------------------------

    if (!payment.isDemo) {
      if (!isRazorpayConfigured()) {
        return {
          success: false,

          message:
            'Razorpay is not configured on the server.',
        };
      }

      if (!razorpaySignature) {
        return {
          success: false,

          message:
            'Razorpay payment signature is missing.',
        };
      }

      const secret =
        process.env.RAZORPAY_KEY_SECRET;

      if (!secret) {
        return {
          success: false,

          message:
            'Razorpay secret is not configured.',
        };
      }

      // --------------------------------------------------------
      // Verify Checkout signature
      // --------------------------------------------------------

      const generatedSignature =
        crypto
          .createHmac(
            'sha256',
            secret
          )
          .update(
            `${razorpayOrderId}|${razorpayPaymentId}`
          )
          .digest('hex');

      const expected =
        Buffer.from(
          generatedSignature,
          'utf8'
        );

      const received =
        Buffer.from(
          razorpaySignature,
          'utf8'
        );

      if (
        expected.length !==
          received.length ||
        !crypto.timingSafeEqual(
          expected,
          received
        )
      ) {
        console.error(
          '[Payment] Invalid Razorpay signature.'
        );

        return {
          success: false,

          message:
            'Payment verification failed.',
        };
      }

      // --------------------------------------------------------
      // Fetch payment directly from Razorpay
      // --------------------------------------------------------

      const razorpayPayment =
        await fetchRazorpayPayment(
          razorpayPaymentId
        );

      // --------------------------------------------------------
      // Verify payment belongs to this order
      // --------------------------------------------------------

      if (
        razorpayPayment.orderId !==
        razorpayOrderId
      ) {
        console.error(
          '[Payment] Payment/order mismatch.',
          {
            expectedOrderId:
              razorpayOrderId,

            receivedOrderId:
              razorpayPayment.orderId,
          }
        );

        return {
          success: false,

          message:
            'Payment does not belong to this order.',
        };
      }

      // --------------------------------------------------------
      // Verify amount
      // --------------------------------------------------------

      const expectedAmount =
        amountToPaise(
          Number(payment.amount)
        );

      if (
        razorpayPayment.amount !==
        expectedAmount
      ) {
        console.error(
          '[Payment] Amount mismatch.',
          {
            expectedAmount,

            receivedAmount:
              razorpayPayment.amount,
          }
        );

        return {
          success: false,

          message:
            'Payment amount verification failed.',
        };
      }

      // --------------------------------------------------------
      // Verify payment status
      // --------------------------------------------------------

      if (
        razorpayPayment.status !==
          'captured' &&
        razorpayPayment.status !==
          'authorized'
      ) {
        return {
          success: false,

          message:
            `Razorpay payment is not successful. Current status: ${razorpayPayment.status}`,
        };
      }

      // --------------------------------------------------------
      // Mark payment paid
      //
      // Payment model does NOT contain paidAt.
      // updatedAt is automatically maintained by Prisma.
      // --------------------------------------------------------

      await prisma.payment.update({
        where: {
          id: payment.id,
        },

        data: {
          status:
            'paid',

          razorpayPaymentId:
            razorpayPaymentId,

          razorpayResponse:
            JSON.stringify(
              razorpayPayment
            ),

          method:
            razorpayPayment.method ||
            undefined,
        },
      });
    }

    // ----------------------------------------------------------
    // Mark invoice recovered
    // ----------------------------------------------------------

    const updatedInvoice =
      await prisma.invoice.update({
        where: {
          id:
            payment.invoiceId,
        },

        data: {
          status:
            'paid',

          paidAt:
            new Date(),

          recoveryStatus:
            'recovered',

          recoverySource:
            'razorpay_payment',
        },
      });

    // ----------------------------------------------------------
    // Fulfill active promise
    // ----------------------------------------------------------

    try {
      await fulfillPromise(
        payment.invoiceId
      );
    } catch (promiseError) {
      console.error(
        '[Payment] Promise fulfillment failed:',
        promiseError
      );
    }

    // ----------------------------------------------------------
    // Audit action
    // ----------------------------------------------------------

    await prisma.aIAction.create({
      data: {
        invoiceId:
          payment.invoiceId,

        action:
          'payment_received',

        reason:
          'Payment successfully verified and invoice recovered.',

        confidence:
          1,

        policyDecision:
          'ALLOW',

        policyReason:
          'Payment was successfully verified.',

        result:
          JSON.stringify({
            provider:
              payment.isDemo
                ? 'demo'
                : 'razorpay',

            razorpayPaymentId,

            razorpayOrderId,

            amount:
              Number(payment.amount),

            currency:
              payment.currency,

            invoiceStatus:
              updatedInvoice.status,
          }),

        actor:
          'engine',
      },
    });

    return {
      success: true,

      message:
        'Payment verified successfully. Invoice marked as paid.',

      paymentId:
        payment.id,

      orderId:
        razorpayOrderId,

      amount:
        Number(payment.amount),

      currency:
        payment.currency,
    };
  } catch (error) {
    console.error(
      '[Payment] Payment success handler failed:',
      error
    );

    return {
      success: false,

      message:
        error instanceof Error
          ? error.message
          : 'Failed to process successful payment.',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Payment Failure
// ─────────────────────────────────────────────────────────────

export async function handlePaymentFailure(
  paymentId: string,
  reason?: string
): Promise<PaymentResult> {
  try {
    const payment =
      await prisma.payment.findUnique({
        where: {
          id:
            paymentId,
        },

        include: {
          invoice: true,
        },
      });

    if (!payment) {
      return {
        success: false,

        message:
          'Payment not found.',
      };
    }

    await prisma.payment.update({
      where: {
        id:
          payment.id,
      },

      data: {
        status:
          'failed',

        failureReason:
          reason || undefined,

        razorpayResponse:
          reason
            ? JSON.stringify({
                reason,
              })
            : undefined,
      },
    });

    await prisma.aIAction.create({
      data: {
        invoiceId:
          payment.invoiceId,

        action:
          'payment_failed',

        reason:
          reason ||
          'Payment attempt failed.',

        confidence:
          1,

        policyDecision:
          'ALLOW',

        policyReason:
          'Payment failure recorded for recovery tracking.',

        result:
          JSON.stringify({
            paymentId:
              payment.id,

            reason:
              reason ||
              'Unknown payment failure',
          }),

        actor:
          'engine',
      },
    });

    return {
      success: true,

      message:
        'Payment failure recorded.',

      paymentId:
        payment.id,
    };
  } catch (error) {
    console.error(
      '[Payment] Payment failure handler failed:',
      error
    );

    return {
      success: false,

      message:
        error instanceof Error
          ? error.message
          : 'Failed to record payment failure.',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Complete Demo Payment
// ─────────────────────────────────────────────────────────────

export async function completeDemoPayment(
  paymentId: string
): Promise<PaymentResult> {
  try {
    const payment =
      await prisma.payment.findUnique({
        where: {
          id:
            paymentId,
        },

        include: {
          invoice: true,
        },
      });

    if (!payment) {
      return {
        success: false,

        message:
          'Payment not found.',
      };
    }

    if (!payment.isDemo) {
      return {
        success: false,

        message:
          'This is not a demo payment.',
      };
    }

    if (payment.status === 'paid') {
      return {
        success: true,

        message:
          'Payment has already been completed.',

        paymentId:
          payment.id,
      };
    }

    // ----------------------------------------------------------
    // Complete demo payment directly
    // ----------------------------------------------------------

    await prisma.payment.update({
      where: {
        id:
          payment.id,
      },

      data: {
        status:
          'paid',

        razorpayPaymentId:
          `demo_pay_${payment.id}`,
      },
    });

    // ----------------------------------------------------------
    // Mark invoice recovered
    // ----------------------------------------------------------

    await prisma.invoice.update({
      where: {
        id:
          payment.invoiceId,
      },

      data: {
        status:
          'paid',

        paidAt:
          new Date(),

        recoveryStatus:
          'recovered',

        recoverySource:
          'demo_payment',
      },
    });

    // ----------------------------------------------------------
    // Fulfill active promise
    // ----------------------------------------------------------

    try {
      await fulfillPromise(
        payment.invoiceId
      );
    } catch (promiseError) {
      console.error(
        '[Payment] Demo promise fulfillment failed:',
        promiseError
      );
    }

    // ----------------------------------------------------------
    // Audit action
    // ----------------------------------------------------------

    await prisma.aIAction.create({
      data: {
        invoiceId:
          payment.invoiceId,

        action:
          'payment_received',

        reason:
          'Demo payment completed and invoice recovered.',

        confidence:
          1,

        policyDecision:
          'ALLOW',

        policyReason:
          'Demo payment completion permitted by the payment engine.',

        result:
          JSON.stringify({
            provider:
              'demo',

            paymentId:
              payment.id,

            demoPaymentId:
              `demo_pay_${payment.id}`,

            amount:
              Number(payment.amount),

            currency:
              payment.currency,
          }),

        actor:
          'engine',
      },
    });

    return {
      success: true,

      message:
        'Demo payment completed successfully.',

      paymentId:
        payment.id,

      amount:
        Number(payment.amount),

      currency:
        payment.currency || 'INR',
    };
  } catch (error) {
    console.error(
      '[Payment] Demo payment completion failed:',
      error
    );

    return {
      success: false,

      message:
        error instanceof Error
          ? error.message
          : 'Failed to complete demo payment.',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Legacy Payment Link Support
// ─────────────────────────────────────────────────────────────

export async function handlePaymentLinkPaid(
  paymentId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string
): Promise<PaymentResult> {
  return handlePaymentSuccess(
    razorpayPaymentId,
    razorpayOrderId
  );
}

// ─────────────────────────────────────────────────────────────
// Process Successful Payment
// ─────────────────────────────────────────────────────────────

export async function processSuccessfulPayment(
  paymentId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string
): Promise<PaymentResult> {
  return handlePaymentSuccess(
    razorpayPaymentId,
    razorpayOrderId
  );
}

// ─────────────────────────────────────────────────────────────
// Legacy Payment Link Failure
// ─────────────────────────────────────────────────────────────

export async function handlePaymentLinkFailed(
  paymentId: string,
  reason?: string
): Promise<PaymentResult> {
  return handlePaymentFailure(
    paymentId,
    reason
  );
}