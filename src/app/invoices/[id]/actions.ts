'use server';

// PayPromise AI - Server Actions for Invoice Recovery
// All actions validate data from DB, never trust client input.

import { revalidatePath } from 'next/cache';

import { executeRecoveryAction } from '@/lib/engine/actions';

import {
  createPromise,
  fulfillPromise,
  cancelPromise,
} from '@/lib/engine/promises';

import { runFollowUpCheck } from '@/lib/engine/followup';

import {
  createPayment,
  completeDemoPayment,
  handlePaymentSuccess,
} from '@/lib/engine/payments';

// ── Recovery Action ─────────────────────────────────────────

export async function triggerRecoveryAction(invoiceId: string) {
  if (!invoiceId || typeof invoiceId !== 'string') {
    return {
      success: false,
      message: 'Invalid invoice ID.',
    };
  }

  const result = await executeRecoveryAction(invoiceId);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath('/invoices');
  revalidatePath('/');
  revalidatePath('/audit');

  return result;
}

// ── Promise to Pay ──────────────────────────────────────────

export async function createPromiseToPay(
  invoiceId: string,
  amount: number,
  dueDate: string,
  notes?: string,
) {
  if (!invoiceId || typeof invoiceId !== 'string') {
    return {
      success: false,
      message: 'Invalid invoice ID.',
      errors: ['Invalid invoice ID'],
    };
  }

  if (typeof amount !== 'number' || isNaN(amount)) {
    return {
      success: false,
      message: 'Invalid amount.',
      errors: ['Invalid amount'],
    };
  }

  if (!dueDate || typeof dueDate !== 'string') {
    return {
      success: false,
      message: 'Invalid date.',
      errors: ['Invalid date'],
    };
  }

  const result = await createPromise({
    invoiceId,
    amount,
    dueDate,
    notes,
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath('/follow-ups');
  revalidatePath('/');

  return result;
}

export async function markPromiseFulfilled(
  promiseId: string
) {
  if (!promiseId || typeof promiseId !== 'string') {
    return {
      success: false,
      message: 'Invalid promise ID.',
    };
  }

  const result = await fulfillPromise(promiseId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath('/follow-ups');
    revalidatePath('/');
    revalidatePath('/revenue');
  }

  return result;
}

export async function markPromiseCancelled(
  promiseId: string
) {
  if (!promiseId || typeof promiseId !== 'string') {
    return {
      success: false,
      message: 'Invalid promise ID.',
    };
  }

  const result = await cancelPromise(promiseId);

  revalidatePath('/follow-ups');

  return result;
}

// ── Follow-up Check ─────────────────────────────────────────

export async function triggerFollowUpCheck() {
  const result = await runFollowUpCheck();

  revalidatePath('/follow-ups');
  revalidatePath('/');
  revalidatePath('/audit');

  return result;
}

// ── Razorpay Payment ────────────────────────────────────────

export async function createPaymentAction(
  invoiceId: string
) {
  if (!invoiceId || typeof invoiceId !== 'string') {
    return {
      success: false,
      message: 'Invalid invoice ID.',
    };
  }

  const result = await createPayment(invoiceId);

  if (result.success) {
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/invoices');
    revalidatePath('/');
    revalidatePath('/audit');
  }

  return {
    success: result.success,
    message: result.message,

    orderId: result.orderId,
    paymentId: result.paymentId,
    razorpayKeyId: result.razorpayKeyId,

    amount: result.amount,
    currency: result.currency,

    demo: !result.razorpayKeyId,
  };
}

// ── Complete Demo Payment ───────────────────────────────────

export async function completeDemoPaymentAction(
  paymentId: string
) {
  if (!paymentId || typeof paymentId !== 'string') {
    return {
      success: false,
      message: 'Invalid payment ID.',
    };
  }

  const result = await completeDemoPayment(paymentId);

  if (result.success) {
    revalidatePath('/invoices');
    revalidatePath('/');
    revalidatePath('/revenue');
    revalidatePath('/audit');
  }

  return result;
}

// ── Confirm Razorpay Checkout Success ────────────────────────

export async function confirmPaymentSuccessAction(
  orderId: string,
  paymentId: string,
  signature: string
) {
  if (
    !orderId ||
    typeof orderId !== 'string' ||
    !paymentId ||
    typeof paymentId !== 'string' ||
    !signature ||
    typeof signature !== 'string'
  ) {
    return {
      success: false,
      message: 'Invalid Razorpay payment data.',
    };
  }

  /*
   * Razorpay Checkout returns:
   *
   * razorpay_payment_id
   * razorpay_order_id
   * razorpay_signature
   *
   * The signature is verified server-side inside
   * handlePaymentSuccess().
   */

  const result = await handlePaymentSuccess(
    paymentId,
    orderId,
    signature
  );

  if (result.success) {
    /*
     * The payment engine already knows which invoice
     * belongs to this Razorpay order.
     *
     * Revalidate the invoice list and all dashboard
     * pages that depend on payment state.
     */
    revalidatePath('/invoices');
    revalidatePath('/');
    revalidatePath('/revenue');
    revalidatePath('/audit');
    revalidatePath('/follow-ups');
  }

  return result;
}

// ── Sync Payment Status ─────────────────────────────────────

export async function syncPaymentStatus(
  paymentId: string
) {
  if (!paymentId || typeof paymentId !== 'string') {
    return {
      success: false,
      message: 'Invalid payment ID.',
    };
  }

  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000'
      }/api/sync-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      revalidatePath('/invoices');
      revalidatePath('/');
      revalidatePath('/revenue');
      revalidatePath('/audit');
      revalidatePath('/follow-ups');
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message:
        'Sync failed: ' +
        (error instanceof Error
          ? error.message
          : 'Unknown error'),
    };
  }
}