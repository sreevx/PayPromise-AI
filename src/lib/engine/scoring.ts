// PayPromise AI Recovery Engine - Deterministic Scoring
// Computes recovery probability from invoice + customer data.
// Uses a direct formula for clear, reproducible scoring.

import type {
  InvoiceData,
  CustomerData,
  CommitmentData,
  MessageData,
  ScoringResult,
  ScoringFactors,
} from './types';

// ── Public API ──────────────────────────────────────────────

export function computeRecoveryScore(
  invoice: InvoiceData,
  customer: CustomerData,
  commitments: CommitmentData[],
  messages: MessageData[],
  referenceDate: Date = new Date(),
): ScoringResult {
  const factors = computeFactors(invoice, customer, commitments, messages, referenceDate);

  // Direct formula: each input maps linearly to probability contribution
  const daysOverdue = factors.daysOverdue;
  const lateRate = customer.paymentCount > 0 ? customer.latePayments / customer.paymentCount : 0.5;
  const brokenCount = commitments.filter(c => c.status === 'broken').length;
  const fulfilledCount = commitments.filter(c => c.status === 'fulfilled').length;
  const commitmentRatio = (fulfilledCount + brokenCount) > 0 ? fulfilledCount / (fulfilledCount + brokenCount) : 0.5;

  let score = 0.72; // Base: a reasonably healthy account

  // Negative factors (reduce probability)
  score -= daysOverdue * 0.008;                    // -0.008 per day overdue (max ~-0.72 at 90d)
  score -= lateRate * 0.25;                        // Up to -0.25 for terrible payment history
  score -= customer.riskScore * 0.15;              // Up to -0.15 for high-risk customer
  score -= factors.contactFatigue * 0.10;          // Up to -0.10 for contact fatigue
  score -= brokenCount * 0.06;                     // -0.06 per broken promise

  // Positive factors (increase probability)
  score += (1 - customer.riskScore) * 0.15;        // Up to +0.15 for reliable customer
  score += commitmentRatio * 0.08;                 // Up to +0.08 for kept promises
  score += factors.recoveryMomentum * 0.06;        // Up to +0.06 for progress
  score += Math.min(customer.paymentCount / 50, 1) * 0.05; // Up to +0.05 for deep relationship

  const probability = clamp(score, 0.02, 0.98);
  const riskLevel = probabilityToRiskLevel(probability);
  const confidence = computeConfidence(customer, messages, factors);
  const overallReasoning = buildReasoning(factors, riskLevel, probability, customer);

  return {
    recoveryProbability: round(probability, 4),
    riskLevel,
    factors: {
      ...factors,
      reasonings: factors.reasonings,
    },
    overallReasoning,
    confidence: round(confidence, 4),
  };
}

// ── Factor Computation ──────────────────────────────────────

function computeFactors(
  invoice: InvoiceData,
  customer: CustomerData,
  commitments: CommitmentData[],
  messages: MessageData[],
  referenceDate: Date,
): ScoringFactors {
  const daysOverdue = Math.max(0, Math.floor(
    (referenceDate.getTime() - invoice.dueAt.getTime()) / (1000 * 60 * 60 * 24)
  ));

  // Amount severity: ratio of this invoice to customer's total exposure
  const customerTotalExposure = customer.totalPaid + customer.totalDue;
  const amountSeverity = customerTotalExposure > 0
    ? Math.min(1, invoice.amount / customerTotalExposure)
    : 0.5;

  const lateRatio = customer.paymentCount > 0
    ? customer.latePayments / customer.paymentCount
    : 0.5;
  const customerReliability = clamp(1 - customer.riskScore, 0, 1);
  const paymentHistory = clamp(1 - lateRatio, 0, 1);
  const relationshipDepth = clamp(customer.paymentCount / 50, 0, 1);

  const fulfilled = commitments.filter(c => c.status === 'fulfilled').length;
  const broken = commitments.filter(c => c.status === 'broken').length;
  const totalCommitments = fulfilled + broken;
  const commitmentTrack = totalCommitments > 0
    ? fulfilled / totalCommitments
    : 0.5;

  const contactFatigue = clamp(messages.length / 10, 0, 1);
  const recoveryMomentum = computeRecoveryMomentum(invoice.recoveryStatus, invoice.followUpCount);

  const reasonings: string[] = [];

  if (daysOverdue > 60) {
    reasonings.push(`Invoice is severely overdue (${daysOverdue} days), significantly reducing recovery likelihood.`);
  } else if (daysOverdue > 30) {
    reasonings.push(`Invoice is ${daysOverdue} days overdue, moderately reducing recovery chances.`);
  } else if (daysOverdue > 7) {
    reasonings.push(`Invoice is ${daysOverdue} days overdue, slightly reducing recovery chances.`);
  } else if (daysOverdue > 0) {
    reasonings.push(`Invoice is only ${daysOverdue} day(s) overdue — still in early recovery window.`);
  } else {
    reasonings.push(`Invoice is not yet overdue.`);
  }

  if (customerReliability > 0.6) {
    reasonings.push(`${customer.name} has strong reliability (${(customerReliability * 100).toFixed(0)}%), indicating likely payment.`);
  } else if (customerReliability < 0.3) {
    reasonings.push(`${customer.name} has low reliability (${(customerReliability * 100).toFixed(0)}%), indicating high collection risk.`);
  } else {
    reasonings.push(`${customer.name} has moderate reliability (${(customerReliability * 100).toFixed(0)}%).`);
  }

  if (lateRatio > 0.5) {
    reasonings.push(`Customer has a high late payment rate (${(lateRatio * 100).toFixed(0)}%), reducing confidence.`);
  } else if (lateRatio < 0.15) {
    reasonings.push(`Customer has an excellent payment record (${(lateRatio * 100).toFixed(0)}% late rate).`);
  }

  if (contactFatigue > 0.6) {
    reasonings.push(`High contact fatigue (${messages.length} messages sent), customer may be desensitized to reminders.`);
  }

  if (broken > fulfilled && totalCommitments > 0) {
    reasonings.push(`Customer has broken ${broken} promise(s) while fulfilling only ${fulfilled}, indicating pattern of non-payment.`);
  } else if (fulfilled > 0 && broken === 0) {
    reasonings.push(`Customer has fulfilled all ${fulfilled} previous commitment(s), building trust.`);
  }

  if (daysOverdue > 30 && lateRatio > 0.3) {
    reasonings.push(`Combined overdue duration and poor payment history significantly increase risk.`);
  }

  return {
    daysOverdue,
    amountSeverity: round(amountSeverity, 4),
    customerReliability: round(customerReliability, 4),
    paymentHistory: round(paymentHistory, 4),
    relationshipDepth: round(relationshipDepth, 4),
    commitmentTrack: round(commitmentTrack, 4),
    contactFatigue: round(contactFatigue, 4),
    recoveryMomentum: round(recoveryMomentum, 4),
    reasonings,
  };
}

function computeRecoveryMomentum(recoveryStatus: string, followUpCount: number): number {
  const stageScore: Record<string, number> = {
    'none': 0.0,
    'ai_analyzing': 0.2,
    'message_sent': 0.4,
    'follow_up': 0.5,
    'promise_to_pay': 0.7,
    'payment_initiated': 0.9,
    'recovered': 1.0,
    'escalated': 0.1,
  };

  const base = stageScore[recoveryStatus] ?? 0.3;
  const followUpPenalty = Math.min(followUpCount * 0.05, 0.3);
  return clamp(base - followUpPenalty, 0, 1);
}

// ── Risk Level ──────────────────────────────────────────────

function probabilityToRiskLevel(probability: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (probability >= 0.50) return 'LOW';
  if (probability >= 0.30) return 'MEDIUM';
  return 'HIGH';
}

// ── Confidence ──────────────────────────────────────────────

function computeConfidence(
  customer: CustomerData,
  messages: MessageData[],
  factors: ScoringFactors,
): number {
  let confidence = 0.60;

  if (customer.paymentCount >= 20) confidence += 0.15;
  else if (customer.paymentCount >= 10) confidence += 0.10;
  else if (customer.paymentCount >= 5) confidence += 0.05;

  if (messages.length >= 5) confidence += 0.10;
  else if (messages.length >= 2) confidence += 0.05;

  // Extreme risk scores are harder to predict
  const riskAbs = Math.abs(customer.riskScore - 0.5);
  confidence += riskAbs * 0.10;

  return clamp(confidence, 0.50, 0.95);
}

// ── Reasoning Builder ───────────────────────────────────────

function buildReasoning(
  factors: ScoringFactors,
  riskLevel: string,
  probability: number,
  customer: CustomerData,
): string {
  const header = `Recovery probability: ${(probability * 100).toFixed(0)}% (${riskLevel} risk).`;
  const factorSummary = factors.reasonings.join(' ');
  return `${header} ${factorSummary}`;
}

// ── Helpers ─────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
