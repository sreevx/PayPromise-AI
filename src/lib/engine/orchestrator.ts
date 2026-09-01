// PayPromise AI Recovery Engine - Orchestrator
// Ties together scoring, strategy, reasoning, policy, and message generation.
// This is the main entry point for analyzing an invoice.

import type {
  InvoiceData,
  CustomerData,
  CommitmentData,
  MessageData,
  RecoveryAnalysisResult,
} from './types';
import { computeRecoveryScore } from './scoring';
import { selectRecoveryStrategy } from './strategy';
import { createReasoningProvider } from './reasoning';
import { evaluatePolicy } from './policy';
import { generateRecoveryMessages } from './messages';

// ── Public API ──────────────────────────────────────────────

export async function analyzeInvoice(
  invoice: InvoiceData,
  customer: CustomerData,
  commitments: CommitmentData[],
  messages: MessageData[],
): Promise<RecoveryAnalysisResult> {
  const timestamp = new Date();

  // Step 1: Compute recovery score
  const scoring = computeRecoveryScore(invoice, customer, commitments, messages, timestamp);

  // Step 2: Run AI reasoning to generate human-readable analysis
  const reasoningProvider = createReasoningProvider();
  const reasoningResult = await reasoningProvider.analyze({
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    daysOverdue: scoring.factors.daysOverdue,
    customerName: customer.name,
    customerCompany: customer.company,
    customerReliability: scoring.factors.customerReliability,
    previousAttempts: invoice.followUpCount,
    brokenPromises: commitments.filter(c => c.status === 'broken').length,
    totalPayments: customer.paymentCount,
    latePayments: customer.latePayments,
  });

  // Merge reasoning into scoring result
  scoring.overallReasoning = `${reasoningResult.reasoning} ${scoring.overallReasoning}`;
  scoring.confidence = (scoring.confidence + reasoningResult.confidence) / 2;

  // Store provider metadata for display
  const providerMeta = {
    provider: reasoningResult.provider || 'deterministic',
    model: reasoningResult.model,
    fallback: reasoningResult.fallback || false,
    fallbackReason: reasoningResult.fallbackReason,
    summary: reasoningResult.summary,
    customerContext: reasoningResult.customerContext,
    llmRecommendedTone: reasoningResult.recommendedTone,
    llmFollowUpDays: reasoningResult.suggestedFollowUpDays,
  };

  // Step 3: Select recovery strategy
  const strategy = selectRecoveryStrategy(invoice, customer, scoring, commitments, messages);

  // Step 4: Evaluate policy guardrails
  const policy = evaluatePolicy(
    strategy.action,
    invoice,
    customer,
    messages,
    commitments,
  );

  // Step 5: Generate messages if action is allowed
  let messages_out: Awaited<ReturnType<typeof generateRecoveryMessages>> = [];
  if (policy.decision === 'ALLOW') {
    messages_out = generateRecoveryMessages(invoice, customer, strategy);
  }

  return {
    scoring,
    strategy,
    policy,
    messages: messages_out,
    timestamp,
    provider: providerMeta,
  };
}

// ── Convenience: Run analysis and format for DB storage ─────

export function formatAnalysisForStorage(result: RecoveryAnalysisResult) {
  return {
    recoveryProbability: result.scoring.recoveryProbability,
    riskLevel: result.scoring.riskLevel,
    recommendedAction: result.strategy.action,
    reasoning: result.policy.decision === 'ALLOW'
      ? result.scoring.overallReasoning
      : `[Policy ${result.policy.decision}: ${result.policy.reason}] ${result.scoring.overallReasoning}`,
    followUpDays: result.strategy.suggestedFollowUpDays,
    confidence: result.scoring.confidence,
    factors: JSON.stringify({
      ...result.scoring.factors,
      strategy: result.strategy.action,
      policyDecision: result.policy.decision,
      provider: result.provider?.provider || 'deterministic',
      model: result.provider?.model,
      fallback: result.provider?.fallback || false,
    }),
  };
}

// ── Convenience: Format AIAction for DB storage ─────────────

export function formatAIActionForStorage(
  result: RecoveryAnalysisResult,
  invoiceId: string,
  actionType: string,
) {
  return {
    invoiceId,
    action: actionType,
    reason: result.policy.decision === 'ALLOW'
      ? result.strategy.reason
      : `Policy ${result.policy.decision}: ${result.policy.reason}`,
    confidence: result.scoring.confidence,
    policyDecision: result.policy.decision,
    policyReason: result.policy.reason,
    result: JSON.stringify({
      action: result.strategy.action,
      riskLevel: result.scoring.riskLevel,
      probability: result.scoring.recoveryProbability,
      tone: result.strategy.suggestedTone,
      channel: result.strategy.suggestedChannel,
    }),
    actor: 'engine',
  };
}
