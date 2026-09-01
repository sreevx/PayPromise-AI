// PayPromise AI Recovery Engine - Follow-up Logic
// Checks active promises, detects broken ones, and triggers re-analysis.

import { prisma } from '@/lib/prisma';
import { checkBrokenPromises } from './promises';
import { analyzeInvoice, formatAIActionForStorage } from './orchestrator';
import type { InvoiceData, CustomerData, CommitmentData, MessageData } from './types';

// ── Run Follow-up Check ─────────────────────────────────────

export async function runFollowUpCheck(): Promise<{
  promisesChecked: number;
  promisesBroken: number;
  invoicesReassessed: number;
  escalated: number;
}> {
  // Step 1: Check for broken promises
  const { checked: promisesChecked, broken: promisesBroken } = await checkBrokenPromises();

  // Step 2: Re-assess invoices that had broken promises
  let invoicesReassessed = 0;
  let escalated = 0;

  if (promisesBroken > 0) {
    // Find invoices that just had promises broken
    const recentlyBroken = await prisma.aIAction.findMany({
      where: {
        action: 'broken_promise',
        createdAt: { gte: new Date(Date.now() - 60 * 1000) }, // Last minute
      },
      distinct: ['invoiceId'],
    });

    for (const action of recentlyBroken) {
      if (!action.invoiceId) continue;

      const reassessment = await reAssessInvoice(action.invoiceId);
      invoicesReassessed++;
      if (reassessment.escalated) escalated++;
    }
  }

  return { promisesChecked, promisesBroken, invoicesReassessed, escalated };
}

// ── Re-assess Invoice ───────────────────────────────────────

async function reAssessInvoice(invoiceId: string): Promise<{ escalated: boolean }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      commitments: true,
      messages: { orderBy: { sentAt: 'desc' } },
    },
  });

  if (!invoice || invoice.status === 'paid') {
    return { escalated: false };
  }

  const invoiceData: InvoiceData = {
    id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.amount,
    currency: invoice.currency, issuedAt: invoice.issuedAt, dueAt: invoice.dueAt,
    paidAt: invoice.paidAt, status: invoice.status, recoveryStatus: invoice.recoveryStatus,
    followUpCount: invoice.followUpCount, escalationLevel: invoice.escalationLevel,
    lastFollowUpAt: invoice.lastFollowUpAt,
  };

  const customerData: CustomerData = {
    id: invoice.customer.id, name: invoice.customer.name, company: invoice.customer.company,
    email: invoice.customer.email, riskScore: invoice.customer.riskScore,
    avgDaysToPay: invoice.customer.avgDaysToPay, totalPaid: invoice.customer.totalPaid,
    totalDue: invoice.customer.totalDue, paymentCount: invoice.customer.paymentCount,
    latePayments: invoice.customer.latePayments,
  };

  const commitmentData: CommitmentData[] = invoice.commitments.map(c => ({
    id: c.id, amount: c.amount, promisedAt: c.promisedAt,
    dueDate: c.dueDate, status: c.status,
  }));

  const messageData: MessageData[] = invoice.messages.map(m => ({
    id: m.id, channel: m.channel, tone: m.tone, sentAt: m.sentAt,
  }));

  const analysis = await analyzeInvoice(invoiceData, customerData, commitmentData, messageData);

  // Store the re-analysis
  await prisma.recoveryAnalysis.create({
    data: {
      invoiceId,
      recoveryProbability: analysis.scoring.recoveryProbability,
      riskLevel: analysis.scoring.riskLevel,
      recommendedAction: analysis.strategy.action,
      reasoning: analysis.scoring.overallReasoning,
      followUpDays: analysis.strategy.suggestedFollowUpDays,
      confidence: analysis.scoring.confidence,
      factors: JSON.stringify({
        ...analysis.scoring.factors,
        reAssessmentReason: 'broken_promise',
      }),
    },
  });

  // Update invoice with new scores
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      recoveryProbability: analysis.scoring.recoveryProbability,
      recommendedAction: `${analysis.strategy.action}: ${analysis.strategy.reason}`,
    },
  });

  // If strategy says escalate, do it
  let escalated = false;
  if (analysis.strategy.action === 'ESCALATE' || analysis.policy.decision === 'ESCALATE') {
    const newLevel = Math.min(invoice.escalationLevel + 1, 3);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        escalationLevel: newLevel,
        recoveryStatus: 'escalated',
        recoverySource: 'followup_broken_promise',
      },
    });

    await prisma.aIAction.create({
      data: {
        invoiceId,
        action: 'auto_escalate',
        reason: `Automatic escalation after broken promise. ${analysis.strategy.reason}`,
        confidence: analysis.scoring.confidence,
        policyDecision: 'ESCALATE',
        policyReason: analysis.policy.reason,
        result: JSON.stringify({
          trigger: 'broken_promise',
          newLevel,
          probability: analysis.scoring.recoveryProbability,
        }),
        actor: 'engine',
      },
    });

    escalated = true;
  }

  return { escalated };
}
