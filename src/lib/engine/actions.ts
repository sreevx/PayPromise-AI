// PayPromise AI Recovery Engine - Action Executor
// Executes recovery actions through the policy engine.
// NEVER trusts client-side data — always fetches fresh from DB.

import { prisma } from '@/lib/prisma';
import { analyzeInvoice, formatAIActionForStorage } from './orchestrator';
import { evaluatePolicy } from './policy';
import { generateRecoveryMessages } from './messages';
import { createPayment } from './payments';
import type { InvoiceData, CustomerData, CommitmentData, MessageData } from './types';

// ── Types ───────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  action: string;
  policyDecision: string;
  policyReason: string;
  message: string;
  details?: Record<string, unknown>;
}

// ── DB-to-Engine Mapping ────────────────────────────────────

function dbInvoiceToEngineData(inv: {
  id: string; invoiceNumber: string; amount: number; currency: string;
  issuedAt: Date; dueAt: Date; paidAt: Date | null; status: string;
  recoveryStatus: string; followUpCount: number; escalationLevel: number;
  lastFollowUpAt: Date | null;
}): InvoiceData {
  return {
    id: inv.id, invoiceNumber: inv.invoiceNumber, amount: inv.amount,
    currency: inv.currency, issuedAt: inv.issuedAt, dueAt: inv.dueAt,
    paidAt: inv.paidAt, status: inv.status, recoveryStatus: inv.recoveryStatus,
    followUpCount: inv.followUpCount, escalationLevel: inv.escalationLevel,
    lastFollowUpAt: inv.lastFollowUpAt,
  };
}

function dbCustomerToEngineData(cust: {
  id: string; name: string; company: string; email: string;
  riskScore: number; avgDaysToPay: number; totalPaid: number;
  totalDue: number; paymentCount: number; latePayments: number;
}): CustomerData {
  return {
    id: cust.id, name: cust.name, company: cust.company, email: cust.email,
    riskScore: cust.riskScore, avgDaysToPay: cust.avgDaysToPay,
    totalPaid: cust.totalPaid, totalDue: cust.totalDue,
    paymentCount: cust.paymentCount, latePayments: cust.latePayments,
  };
}

// ── Core Action Executor ────────────────────────────────────

export async function executeRecoveryAction(
  invoiceId: string,
  forcedAction?: string,
): Promise<ActionResult> {
  // SECURITY: Fetch fresh data from DB — never trust client
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      commitments: true,
      messages: { orderBy: { sentAt: 'desc' } },
    },
  });

  if (!invoice) {
    return { success: false, action: 'UNKNOWN', policyDecision: 'BLOCK', policyReason: 'Invoice not found', message: 'Invoice not found.' };
  }

  const invoiceData = dbInvoiceToEngineData(invoice);
  const customerData = dbCustomerToEngineData(invoice.customer);
  const commitmentData: CommitmentData[] = invoice.commitments.map(c => ({
    id: c.id, amount: c.amount, promisedAt: c.promisedAt,
    dueDate: c.dueDate, status: c.status,
  }));
  const messageData: MessageData[] = invoice.messages.map(m => ({
    id: m.id, channel: m.channel, tone: m.tone, sentAt: m.sentAt,
  }));

  // Run fresh analysis
  const analysis = await analyzeInvoice(invoiceData, customerData, commitmentData, messageData);
  const actionToExecute = forcedAction || analysis.strategy.action;

  // Run policy engine
  const policyResult = evaluatePolicy(
    actionToExecute as any,
    invoiceData,
    customerData,
    messageData,
    commitmentData,
  );

  // Record the AI action
  const actionRecord = {
    invoiceId,
    action: actionToExecute,
    reason: policyResult.decision === 'ALLOW'
      ? analysis.strategy.reason
      : `Policy ${policyResult.decision}: ${policyResult.reason}`,
    confidence: analysis.scoring.confidence,
    policyDecision: policyResult.decision,
    policyReason: policyResult.reason,
    result: JSON.stringify({
      action: actionToExecute,
      riskLevel: analysis.scoring.riskLevel,
      probability: analysis.scoring.recoveryProbability,
      decision: policyResult.decision,
    }),
    actor: 'engine',
  };

  await prisma.aIAction.create({ data: actionRecord });

  // Update invoice analysis
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      recoveryProbability: analysis.scoring.recoveryProbability,
      recommendedAction: `${actionToExecute}: ${analysis.strategy.reason}`,
    },
  });

  // If BLOCKED or ESCALATED (without execution), stop here
  if (policyResult.decision === 'BLOCK') {
    return {
      success: false,
      action: actionToExecute,
      policyDecision: 'BLOCK',
      policyReason: policyResult.reason,
      message: `Action blocked by policy: ${policyResult.reason}`,
    };
  }

  if (policyResult.decision === 'ESCALATE' && actionToExecute !== 'ESCALATE') {
    // Policy says escalate instead of the proposed action
    return await executeEscalation(invoiceId, policyResult.reason, analysis.scoring.confidence);
  }

  // Execute the allowed action
  switch (actionToExecute) {
    case 'SEND_REMINDER':
      return await executeSendReminder(invoice, invoiceData, customerData, analysis);
    case 'REQUEST_PROMISE':
      return await executeRequestPromise(invoice, invoiceData, customerData, analysis);
    case 'CREATE_PAYMENT_LINK':
      return await executeCreatePaymentLink(invoice, invoiceData, analysis);
    case 'FOLLOW_UP':
      return await executeFollowUp(invoice, invoiceData, customerData, analysis);
    case 'ESCALATE':
      return await executeEscalation(invoiceId, analysis.strategy.reason, analysis.scoring.confidence);
    case 'STOP':
      return {
        success: true,
        action: 'STOP',
        policyDecision: 'ALLOW',
        policyReason: 'All checks passed. No action needed.',
        message: 'No action required for this invoice.',
      };
    default:
      return {
        success: false,
        action: actionToExecute,
        policyDecision: 'BLOCK',
        policyReason: `Unknown action: ${actionToExecute}`,
        message: `Unknown action: ${actionToExecute}`,
      };
  }
}

// ── Action Implementations ──────────────────────────────────

async function executeSendReminder(
  invoice: any,
  invoiceData: InvoiceData,
  customerData: CustomerData,
  analysis: any,
): Promise<ActionResult> {
  const messages = generateRecoveryMessages(invoiceData, customerData, analysis.strategy);

  // Store messages
  for (const msg of messages) {
    await prisma.recoveryMessage.create({
      data: {
        invoiceId: invoice.id,
        channel: msg.channel,
        subject: msg.subject,
        content: msg.content,
        tone: msg.tone,
        aiGenerated: true,
      },
    });
  }

  // Update invoice state
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      recoveryStatus: 'message_sent',
      lastFollowUpAt: new Date(),
      followUpCount: { increment: 1 },
    },
  });

  return {
    success: true,
    action: 'SEND_REMINDER',
    policyDecision: 'ALLOW',
    policyReason: 'All policy checks passed.',
    message: `Reminder sent via ${messages.map(m => m.channel).join(', ')} to ${customerData.name}.`,
    details: { channels: messages.map(m => m.channel), tone: analysis.strategy.suggestedTone },
  };
}

async function executeRequestPromise(
  invoice: any,
  invoiceData: InvoiceData,
  customerData: CustomerData,
  analysis: any,
): Promise<ActionResult> {
  const messages = generateRecoveryMessages(invoiceData, customerData, analysis.strategy);

  for (const msg of messages) {
    await prisma.recoveryMessage.create({
      data: {
        invoiceId: invoice.id,
        channel: msg.channel,
        subject: msg.subject,
        content: msg.content,
        tone: msg.tone,
        aiGenerated: true,
      },
    });
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      recoveryStatus: 'message_sent',
      lastFollowUpAt: new Date(),
      followUpCount: { increment: 1 },
    },
  });

  return {
    success: true,
    action: 'REQUEST_PROMISE',
    policyDecision: 'ALLOW',
    policyReason: 'All policy checks passed.',
    message: `Promise-to-pay request sent to ${customerData.name} via ${messages.map(m => m.channel).join(', ')}.`,
    details: { channels: messages.map(m => m.channel) },
  };
}

async function executeCreatePaymentLink(
  invoice: any,
  invoiceData: InvoiceData,
  analysis: any,
): Promise<ActionResult> {
  // Create Razorpay payment (Test Mode or Demo)
  const paymentResult = await createPayment(invoice.id);

  if (!paymentResult.success) {
    return {
      success: false,
      action: 'CREATE_PAYMENT_LINK',
      policyDecision: 'BLOCK',
      policyReason: paymentResult.message,
      message: paymentResult.message,
    };
  }

  // Update invoice state
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      recoveryStatus: 'payment_initiated',
      lastFollowUpAt: new Date(),
      followUpCount: { increment: 1 },
    },
  });

  return {
    success: true,
    action: 'CREATE_PAYMENT_LINK',
    policyDecision: 'ALLOW',
    policyReason: 'All policy checks passed.',
    message: paymentResult.message,
    details: {
      orderId: paymentResult.orderId,
      amount: paymentResult.amount,
      razorpayKeyId: paymentResult.razorpayKeyId,
      paymentId: paymentResult.paymentId,
      demo: !paymentResult.razorpayKeyId,
    },
  };
}

async function executeFollowUp(
  invoice: any,
  invoiceData: InvoiceData,
  customerData: CustomerData,
  analysis: any,
): Promise<ActionResult> {
  const messages = generateRecoveryMessages(invoiceData, customerData, analysis.strategy);

  for (const msg of messages) {
    await prisma.recoveryMessage.create({
      data: {
        invoiceId: invoice.id,
        channel: msg.channel,
        subject: msg.subject,
        content: msg.content,
        tone: msg.tone,
        aiGenerated: true,
      },
    });
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      recoveryStatus: 'follow_up',
      lastFollowUpAt: new Date(),
      followUpCount: { increment: 1 },
    },
  });

  return {
    success: true,
    action: 'FOLLOW_UP',
    policyDecision: 'ALLOW',
    policyReason: 'All policy checks passed.',
    message: `Follow-up sent to ${customerData.name}.`,
    details: { channels: messages.map(m => m.channel) },
  };
}

async function executeEscalation(
  invoiceId: string,
  reason: string,
  confidence: number,
): Promise<ActionResult> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return { success: false, action: 'ESCALATE', policyDecision: 'BLOCK', policyReason: 'Invoice not found', message: 'Invoice not found.' };
  }

  const newLevel = Math.min(invoice.escalationLevel + 1, 3);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      escalationLevel: newLevel,
      recoveryStatus: 'escalated',
      recoverySource: 'engine',
    },
  });

  // Record escalation action
  await prisma.aIAction.create({
    data: {
      invoiceId,
      action: 'escalate',
      reason,
      confidence,
      policyDecision: 'ESCALATE',
      policyReason: reason,
      result: JSON.stringify({
        previousLevel: invoice.escalationLevel,
        newLevel,
        levelName: newLevel === 1 ? 'AI Review' : newLevel === 2 ? 'Human Collections' : 'Legal',
      }),
      actor: 'engine',
    },
  });

  const levelName = newLevel === 1 ? 'AI review' : newLevel === 2 ? 'human collections' : 'legal';

  return {
    success: true,
    action: 'ESCALATE',
    policyDecision: 'ESCALATE',
    policyReason: reason,
    message: `Invoice escalated to ${levelName} (level ${newLevel}).`,
    details: { escalationLevel: newLevel, levelName },
  };
}
