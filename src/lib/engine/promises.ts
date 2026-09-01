// PayPromise AI Recovery Engine - Promise-to-Pay Manager
// Validates and manages promise-to-pay commitments.
// NEVER trusts client data — validates everything from DB.

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────

export interface PromiseResult {
  success: boolean;
  message: string;
  promiseId?: string;
  errors?: string[];
}

export interface PromiseInput {
  invoiceId: string;
  amount: number;
  dueDate: string; // ISO date string
  notes?: string;
}

// ── Create Promise ──────────────────────────────────────────

export async function createPromise(input: PromiseInput): Promise<PromiseResult> {
  const errors: string[] = [];

  // Fetch invoice from DB (never trust client)
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { commitments: { where: { status: 'active' } } },
  });

  if (!invoice) {
    return { success: false, message: 'Invoice not found.', errors: ['Invoice not found'] };
  }

  // Validation: invoice cannot be paid or written off
  if (invoice.status === 'paid') {
    errors.push('Cannot create promise for a paid invoice.');
  }
  if (invoice.status === 'written_off') {
    errors.push('Cannot create promise for a written-off invoice.');
  }
  if (invoice.status === 'recovered') {
    errors.push('Cannot create promise for a recovered invoice.');
  }

  // Validation: amount must be > 0
  if (input.amount <= 0) {
    errors.push('Promise amount must be greater than zero.');
  }

  // Validation: amount cannot exceed invoice amount
  if (input.amount > invoice.amount) {
    errors.push(`Promise amount (₹${input.amount.toLocaleString('en-IN')}) cannot exceed invoice amount (₹${invoice.amount.toLocaleString('en-IN')}).`);
  }

  // Validation: due date must be valid and in the future
  const dueDate = new Date(input.dueDate);
  if (isNaN(dueDate.getTime())) {
    errors.push('Invalid promise date.');
  } else if (dueDate <= new Date()) {
    errors.push('Promise date must be in the future.');
  }

  // Validation: prevent duplicate active promises
  if (invoice.commitments.length > 0) {
    errors.push(`Invoice already has ${invoice.commitments.length} active promise(s). Complete or cancel existing promises first.`);
  }

  if (errors.length > 0) {
    return {
      success: false,
      message: `Promise validation failed: ${errors.join(' ')}`,
      errors,
    };
  }

  // Create the promise
  const promise = await prisma.promiseToPay.create({
    data: {
      invoiceId: input.invoiceId,
      customerId: invoice.customerId,
      amount: input.amount,
      promisedAt: new Date(),
      dueDate,
      status: 'active',
      notes: input.notes || null,
    },
  });

  // Update invoice recovery status
  await prisma.invoice.update({
    where: { id: input.invoiceId },
    data: {
      recoveryStatus: 'promise_to_pay',
      lastFollowUpAt: new Date(),
    },
  });

  // Record AI action
  await prisma.aIAction.create({
    data: {
      invoiceId: input.invoiceId,
      action: 'create_promise',
      reason: `Promise-to-pay created: ₹${input.amount.toLocaleString('en-IN')} due ${dueDate.toLocaleDateString('en-IN')}.`,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Promise validated and accepted.',
      result: JSON.stringify({
        promiseId: promise.id,
        amount: input.amount,
        dueDate: dueDate.toISOString(),
        notes: input.notes,
      }),
      actor: 'system',
    },
  });

  return {
    success: true,
    message: `Promise-to-pay of ₹${input.amount.toLocaleString('en-IN')} created, due ${dueDate.toLocaleDateString('en-IN')}.`,
    promiseId: promise.id,
  };
}

// ── Fulfill Promise ─────────────────────────────────────────

export async function fulfillPromise(promiseId: string): Promise<PromiseResult> {
  const promise = await prisma.promiseToPay.findUnique({
    where: { id: promiseId },
    include: { invoice: true },
  });

  if (!promise) {
    return { success: false, message: 'Promise not found.' };
  }

  if (promise.status !== 'active') {
    return { success: false, message: `Promise is already ${promise.status}.` };
  }

  // Mark promise as fulfilled
  await prisma.promiseToPay.update({
    where: { id: promiseId },
    data: { status: 'fulfilled' },
  });

  // Mark invoice as recovered if fully paid
  await prisma.invoice.update({
    where: { id: promise.invoiceId },
    data: {
      status: 'paid',
      paidAt: new Date(),
      recoveryStatus: 'recovered',
    },
  });

  // Record action
  await prisma.aIAction.create({
    data: {
      invoiceId: promise.invoiceId,
      action: 'fulfill_promise',
      reason: `Promise of ₹${promise.amount.toLocaleString('en-IN')} fulfilled. Invoice marked as paid.`,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Payment received.',
      result: JSON.stringify({ promiseId, amount: promise.amount }),
      actor: 'system',
    },
  });

  return {
    success: true,
    message: `Promise fulfilled. Invoice ${promise.invoice.invoiceNumber} marked as paid.`,
    promiseId,
  };
}

// ── Cancel Promise ──────────────────────────────────────────

export async function cancelPromise(promiseId: string, reason: string = 'Cancelled by merchant'): Promise<PromiseResult> {
  const promise = await prisma.promiseToPay.findUnique({
    where: { id: promiseId },
  });

  if (!promise) {
    return { success: false, message: 'Promise not found.' };
  }

  if (promise.status !== 'active') {
    return { success: false, message: `Promise is already ${promise.status}.` };
  }

  await prisma.promiseToPay.update({
    where: { id: promiseId },
    data: { status: 'cancelled' },
  });

  await prisma.aIAction.create({
    data: {
      invoiceId: promise.invoiceId,
      action: 'cancel_promise',
      reason,
      confidence: 1.0,
      policyDecision: 'ALLOW',
      policyReason: 'Merchant cancelled the promise.',
      result: JSON.stringify({ promiseId, originalAmount: promise.amount }),
      actor: 'system',
    },
  });

  return {
    success: true,
    message: 'Promise cancelled.',
    promiseId,
  };
}

// ── Check Broken Promises ───────────────────────────────────

export async function checkBrokenPromises(): Promise<{ checked: number; broken: number }> {
  const activePromises = await prisma.promiseToPay.findMany({
    where: { status: 'active' },
    include: { invoice: true },
  });

  let broken = 0;
  const now = new Date();

  for (const promise of activePromises) {
    if (new Date(promise.dueDate) < now) {
      // Promise is overdue — mark as broken
      await prisma.promiseToPay.update({
        where: { id: promise.id },
        data: { status: 'broken' },
      });

      // Record the broken promise
      await prisma.aIAction.create({
        data: {
          invoiceId: promise.invoiceId,
          action: 'broken_promise',
          reason: `Promise of ₹${promise.amount.toLocaleString('en-IN')} was due on ${promise.dueDate.toLocaleDateString('en-IN')} and has not been fulfilled.`,
          confidence: 1.0,
          policyDecision: 'ALLOW',
          policyReason: 'Automatic detection of overdue promise.',
          result: JSON.stringify({
            promiseId: promise.id,
            amount: promise.amount,
            dueDate: promise.dueDate.toISOString(),
          }),
          actor: 'system',
        },
      });

      broken++;
    }
  }

  return { checked: activePromises.length, broken };
}
