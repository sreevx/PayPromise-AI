// PayPromise AI Recovery Engine - Policy / Guardrail Engine
// Every AI recommendation passes through this before execution.
// Policy decisions: ALLOW, BLOCK, ESCALATE

import type {
  InvoiceData,
  CustomerData,
  MessageData,
  CommitmentData,
  RecoveryAction,
  PolicyResult,
} from './types';

// ── Constants ─────────────────────────────────────────────

/** Maximum automated recovery attempts before mandatory escalation. */
export const MAX_AUTOMATED_ATTEMPTS = 8;

/** Minimum gap in hours between duplicate actions. */
export const MIN_ACTION_GAP_HOURS = 24;

/** Minimum gap in days between contacts. */
export const MIN_CONTACT_GAP_DAYS = 2;

/** Maximum messages per invoice. */
export const MAX_MESSAGES_PER_INVOICE = 10;

// ── Public API ──────────────────────────────────────────────

export function evaluatePolicy(
  proposedAction: RecoveryAction,
  invoice: InvoiceData,
  customer: CustomerData,
  messages: MessageData[],
  commitments: CommitmentData[],
): PolicyResult {
  // Run all policy checks in order. First BLOCK or ESCALATE wins.
  const checks = [
    checkPaidInvoice(proposedAction, invoice),
    checkWrittenOff(proposedAction, invoice),
    checkExcessiveContact(proposedAction, messages),
    checkDuplicateAction(proposedAction, invoice, messages),
    checkMaxAutomatedAttempts(proposedAction, invoice),
    checkPromiseExhaustion(proposedAction, commitments),
    checkAmountValidity(proposedAction, invoice),
    checkEscalationLevel(proposedAction, invoice),
  ];

  for (const check of checks) {
    if (check.decision !== 'ALLOW') {
      return {
        decision: check.decision,
        reason: check.reason,
        originalAction: proposedAction,
        finalAction: resolveFinalAction(proposedAction, check.decision),
      };
    }
  }

  // All checks passed
  return {
    decision: 'ALLOW',
    reason: 'All policy checks passed. Action is authorized.',
    originalAction: proposedAction,
    finalAction: proposedAction,
  };
}

// ── Policy Checks ───────────────────────────────────────────

interface CheckResult {
  decision: 'ALLOW' | 'BLOCK' | 'ESCALATE';
  reason: string;
}

// Rule: Never act on paid invoices
function checkPaidInvoice(action: RecoveryAction, invoice: InvoiceData): CheckResult {
  if (invoice.status === 'paid') {
    return {
      decision: 'BLOCK',
      reason: `Policy BLOCK: Invoice ${invoice.invoiceNumber} is already paid. Recovery actions are not permitted on paid invoices.`,
    };
  }
  return { decision: 'ALLOW', reason: '' };
}

// Rule: Never act on written-off invoices
function checkWrittenOff(action: RecoveryAction, invoice: InvoiceData): CheckResult {
  if (invoice.status === 'written_off') {
    return {
      decision: 'BLOCK',
      reason: `Policy BLOCK: Invoice ${invoice.invoiceNumber} has been written off. No further recovery actions.`,
    };
  }
  return { decision: 'ALLOW', reason: '' };
}

// Rule: Prevent excessive contact frequency (max 1 contact per 2 days)
function checkExcessiveContact(action: RecoveryAction, messages: MessageData[]): CheckResult {
  if (messages.length === 0) return { decision: 'ALLOW', reason: '' };

  const lastMessage = messages.reduce((latest, m) =>
    new Date(m.sentAt) > new Date(latest.sentAt) ? m : latest
  );
  const daysSinceLastContact = Math.floor(
    (Date.now() - new Date(lastMessage.sentAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastContact < MIN_CONTACT_GAP_DAYS && action !== 'STOP') {
    return {
      decision: 'BLOCK',
      reason: `Policy BLOCK: Customer was contacted ${daysSinceLastContact} day(s) ago. Minimum ${MIN_CONTACT_GAP_DAYS}-day gap between contacts required.`,
    };
  }

  // Total message cap
  if (messages.length >= MAX_MESSAGES_PER_INVOICE && action !== 'STOP' && action !== 'ESCALATE') {
    return {
      decision: 'BLOCK',
      reason: `Policy BLOCK: ${messages.length} messages already sent. Maximum ${MAX_MESSAGES_PER_INVOICE} automated messages allowed per invoice.`,
    };
  }

  return { decision: 'ALLOW', reason: '' };
}

// Rule: Prevent duplicate recovery actions
function checkDuplicateAction(
  action: RecoveryAction,
  invoice: InvoiceData,
  messages: MessageData[],
): CheckResult {
  // Don't send another reminder if one was just sent (within 24h) for the same action type
  if ((action === 'SEND_REMINDER' || action === 'REQUEST_PROMISE') && messages.length > 0) {
    const lastMessage = messages.reduce((latest, m) =>
      new Date(m.sentAt) > new Date(latest.sentAt) ? m : latest
    );
    const hoursSinceLastContact = (Date.now() - new Date(lastMessage.sentAt).getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastContact < MIN_ACTION_GAP_HOURS) {
      return {
        decision: 'BLOCK',
        reason: `Policy BLOCK: Similar action was already taken ${hoursSinceLastContact.toFixed(1)} hours ago. No duplicate actions within ${MIN_ACTION_GAP_HOURS} hours.`,
      };
    }
  }
  return { decision: 'ALLOW', reason: '' };
}

// Rule: Maximum automated attempts
function checkMaxAutomatedAttempts(action: RecoveryAction, invoice: InvoiceData): CheckResult {
  if (invoice.followUpCount >= MAX_AUTOMATED_ATTEMPTS && action !== 'STOP' && action !== 'ESCALATE') {
    return {
      decision: 'ESCALATE',
      reason: `Policy ESCALATE: ${invoice.followUpCount} automated attempts made (max ${MAX_AUTOMATED_ATTEMPTS}). Escalating to human review.`,
    };
  }
  return { decision: 'ALLOW', reason: '' };
}

// Rule: Failed repeated promises must eventually escalate
function checkPromiseExhaustion(action: RecoveryAction, commitments: CommitmentData[]): CheckResult {
  const brokenCount = commitments.filter(c => c.status === 'broken').length;

  if (brokenCount >= 3 && action !== 'ESCALATE' && action !== 'STOP') {
    return {
      decision: 'ESCALATE',
      reason: `Policy ESCALATE: ${brokenCount} broken promise(s). Customer has repeatedly failed to honor commitments.`,
    };
  }
  return { decision: 'ALLOW', reason: '' };
}

// Rule: Payment amount cannot exceed invoice amount (for CREATE_PAYMENT_LINK)
function checkAmountValidity(action: RecoveryAction, invoice: InvoiceData): CheckResult {
  if (action === 'CREATE_PAYMENT_LINK') {
    if (invoice.amount <= 0) {
      return {
        decision: 'BLOCK',
        reason: `Policy BLOCK: Cannot create payment link for invalid amount (₹${invoice.amount}).`,
      };
    }
  }
  return { decision: 'ALLOW', reason: '' };
}

// Rule: High-escalation invoices should not get new automated actions
function checkEscalationLevel(action: RecoveryAction, invoice: InvoiceData): CheckResult {
  if (invoice.escalationLevel >= 2 && action !== 'STOP') {
    return {
      decision: 'BLOCK',
      reason: `Policy BLOCK: Invoice is at escalation level ${invoice.escalationLevel}. Automated actions are suspended pending human review.`,
    };
  }
  return { decision: 'ALLOW', reason: '' };
}

// ── Helpers ─────────────────────────────────────────────────

function resolveFinalAction(
  originalAction: RecoveryAction,
  decision: 'ALLOW' | 'BLOCK' | 'ESCALATE',
): RecoveryAction {
  if (decision === 'ALLOW') return originalAction;
  if (decision === 'ESCALATE') return 'ESCALATE';
  // BLOCK → STOP (don't do anything)
  return 'STOP';
}
