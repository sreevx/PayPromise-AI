// PayPromise AI Recovery Engine - Strategy
// Deterministic business rules for selecting the best recovery action.

import type {
  InvoiceData,
  CustomerData,
  CommitmentData,
  MessageData,
  ScoringResult,
  StrategyResult,
  RecoveryAction,
} from './types';

// ── Public API ──────────────────────────────────────────────

export function selectRecoveryStrategy(
  invoice: InvoiceData,
  customer: CustomerData,
  scoring: ScoringResult,
  commitments: CommitmentData[],
  messages: MessageData[],
): StrategyResult {
  // Rule 1: PAID invoice → STOP (no action needed)
  if (invoice.status === 'paid') {
    return {
      action: 'STOP',
      reason: 'Invoice is already paid. No recovery action needed.',
      suggestedFollowUpDays: 0,
      suggestedTone: 'friendly',
      suggestedChannel: 'email',
    };
  }

  // Rule 2: Written off → STOP
  if (invoice.status === 'written_off') {
    return {
      action: 'STOP',
      reason: 'Invoice has been written off. No recovery action possible.',
      suggestedFollowUpDays: 0,
      suggestedTone: 'friendly',
      suggestedChannel: 'email',
    };
  }

  // Rule 3: Not yet overdue → STOP
  if (invoice.status === 'pending') {
    return {
      action: 'STOP',
      reason: 'Invoice is not yet overdue. No recovery action needed.',
      suggestedFollowUpDays: 0,
      suggestedTone: 'friendly',
      suggestedChannel: 'email',
    };
  }

  // Rule 4: Already escalated at human/legal level → STOP further automated actions
  if (invoice.escalationLevel >= 2) {
    return {
      action: 'STOP',
      reason: `Invoice is already escalated to level ${invoice.escalationLevel} (human/legal). Automated actions suspended.`,
      suggestedFollowUpDays: 0,
      suggestedTone: 'firm',
      suggestedChannel: 'email',
    };
  }

  // Rule 5: Very recent contact (within 2 days) → STOP
  if (messages.length > 0) {
    const lastMessage = messages.reduce((latest, m) =>
      new Date(m.sentAt) > new Date(latest.sentAt) ? m : latest
    );
    const daysSinceLastContact = Math.floor(
      (Date.now() - new Date(lastMessage.sentAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastContact < 2) {
      return {
        action: 'STOP',
        reason: `Customer was contacted ${daysSinceLastContact} day(s) ago. Too soon for another contact.`,
        suggestedFollowUpDays: 2 - daysSinceLastContact,
        suggestedTone: 'friendly',
        suggestedChannel: lastMessage.channel as 'email' | 'sms' | 'whatsapp',
      };
    }
  }

  // Rule 6: Excessive recovery attempts (5+) with no progress → ESCALATE
  if (invoice.followUpCount >= 5 && scoring.recoveryProbability < 0.3) {
    return {
      action: 'ESCALATE',
      reason: `${invoice.followUpCount} recovery attempts with ${(scoring.recoveryProbability * 100).toFixed(0)}% recovery probability. Human intervention recommended.`,
      suggestedFollowUpDays: 0,
      suggestedTone: 'urgent',
      suggestedChannel: 'email',
    };
  }

  // Rule 7: Broken promises exceeding fulfilled → ESCALATE
  const brokenPromises = commitments.filter(c => c.status === 'broken').length;
  const fulfilledPromises = commitments.filter(c => c.status === 'fulfilled').length;
  if (brokenPromises > fulfilledPromises && brokenPromises >= 2) {
    return {
      action: 'ESCALATE',
      reason: `Customer has broken ${brokenPromises} promise(s) while fulfilling only ${fulfilledPromises}. Escalation recommended.`,
      suggestedFollowUpDays: 0,
      suggestedTone: 'urgent',
      suggestedChannel: 'email',
    };
  }

  // Rule 8: Long overdue (60+ days) + low probability → ESCALATE
  if (scoring.factors.daysOverdue >= 60 && scoring.recoveryProbability < 0.25) {
    return {
      action: 'ESCALATE',
      reason: `Invoice is ${scoring.factors.daysOverdue} days overdue with only ${(scoring.recoveryProbability * 100).toFixed(0)}% recovery probability. Legal escalation recommended.`,
      suggestedFollowUpDays: 0,
      suggestedTone: 'legal',
      suggestedChannel: 'email',
    };
  }

  // Rule 9: Has an active promise to pay → FOLLOW_UP (check on commitment)
  const activePromise = commitments.find(c => c.status === 'active');
  if (activePromise) {
    const daysUntilPromiseDue = Math.floor(
      (new Date(activePromise.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilPromiseDue > 0) {
      return {
        action: 'FOLLOW_UP',
        reason: `Customer has an active promise-to-pay of ₹${activePromise.amount.toLocaleString('en-IN')} due in ${daysUntilPromiseDue} day(s). Follow up to confirm.`,
        suggestedFollowUpDays: Math.min(daysUntilPromiseDue, 3),
        suggestedTone: 'friendly',
        suggestedChannel: 'whatsapp',
      };
    } else {
      // Promise is overdue — broken promise detection should have caught this
      return {
        action: 'ESCALATE',
        reason: `Customer's active promise-to-pay of ₹${activePromise.amount.toLocaleString('en-IN')} was due ${Math.abs(daysUntilPromiseDue)} day(s) ago and has not been fulfilled.`,
        suggestedFollowUpDays: 0,
        suggestedTone: 'firm',
        suggestedChannel: 'email',
      };
    }
  }

  // ── Strategy based on risk level and customer profile ──────

  const { riskLevel, factors } = scoring;
  const goodHistory = customer.latePayments / Math.max(1, customer.paymentCount) < 0.25;

  if (riskLevel === 'LOW') {
    // Low risk + good history + short overdue → gentle reminder
    if (factors.daysOverdue <= 14 && goodHistory) {
      return {
        action: 'SEND_REMINDER',
        reason: `Low risk invoice (${(scoring.recoveryProbability * 100).toFixed(0)}% probability), customer has good payment history. A gentle reminder should suffice.`,
        suggestedFollowUpDays: 7,
        suggestedTone: 'friendly',
        suggestedChannel: 'email',
      };
    }
    // Low risk + longer overdue → request promise
    return {
      action: 'REQUEST_PROMISE',
      reason: `Invoice is ${factors.daysOverdue} days overdue but customer has good reliability. Request a promise-to-pay.`,
      suggestedFollowUpDays: 5,
      suggestedTone: 'friendly',
      suggestedChannel: 'whatsapp',
    };
  }

  if (riskLevel === 'MEDIUM') {
    // Medium risk + good history → request promise
    if (goodHistory) {
      return {
        action: 'REQUEST_PROMISE',
        reason: `Medium risk invoice. Customer has decent payment history. Request a concrete promise-to-pay with a deadline.`,
        suggestedFollowUpDays: 3,
        suggestedTone: 'firm',
        suggestedChannel: 'email',
      };
    }
    // Medium risk + poor history → create payment link
    return {
      action: 'CREATE_PAYMENT_LINK',
      reason: `Medium risk with poor payment history. Make it easy to pay with a direct payment link.`,
      suggestedFollowUpDays: 5,
      suggestedTone: 'firm',
      suggestedChannel: 'email',
    };
  }

  // HIGH risk
  if (factors.daysOverdue >= 30) {
    // High risk + long overdue → escalate
    return {
      action: 'ESCALATE',
      reason: `High risk invoice, ${factors.daysOverdue} days overdue. Automated recovery unlikely to succeed. Escalate to human collections.`,
      suggestedFollowUpDays: 0,
      suggestedTone: 'urgent',
      suggestedChannel: 'email',
    };
  }

  // High risk + short overdue → firm reminder with payment link
  return {
    action: 'CREATE_PAYMENT_LINK',
    reason: `High risk invoice but still early. Send a firm reminder with a payment link to maximize the chance of quick recovery.`,
    suggestedFollowUpDays: 3,
    suggestedTone: 'urgent',
    suggestedChannel: 'email',
  };
}
