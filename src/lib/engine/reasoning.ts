// PayPromise AI Recovery Engine - Reasoning Abstraction
// Provides an LLM-backed reasoning provider with deterministic fallback.
// The LLM explains WHY the deterministic result makes sense.
// It does NOT control financial decisions or action selection.

import type {
  ReasoningProvider,
  ReasoningInput,
  ReasoningOutput,
} from './types';

// ── Configuration ───────────────────────────────────────────

const AI_API_KEY = process.env.AI_PROVIDER_API_KEY || '';
const AI_BASE_URL = process.env.AI_PROVIDER_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const AI_TIMEOUT_MS = 15000; // 15 second timeout

// ── Provider Selection ──────────────────────────────────────

export function createReasoningProvider(): ReasoningProvider {
  if (AI_API_KEY) {
    return new LLMReasoningProvider();
  }

  return new DeterministicReasoningProvider();
}

// ── System Prompt ───────────────────────────────────────────

const SYSTEM_PROMPT = `You are a B2B accounts-receivable recovery assistant for PayPromise AI.

Your job is to analyze structured invoice and customer information and provide explainable reasoning for an already-calculated recovery situation.

You must:
- never invent financial facts
- never change invoice amounts
- never approve discounts
- never claim a payment was received
- never override policy rules
- never create or execute payments
- clearly distinguish facts from recommendations
- return valid structured JSON only

The deterministic scoring engine has already calculated:
- recovery probability (0-100%)
- risk level (LOW/MEDIUM/HIGH)
- recommended action (SEND_REMINDER, REQUEST_PROMISE, CREATE_PAYMENT_LINK, FOLLOW_UP, ESCALATE, STOP)

Your role is to:
1. Explain WHY the deterministic result makes sense given the data
2. Provide a brief one-line summary of the situation
3. Add context about the customer's payment behavior
4. Suggest a communication tone that matches the situation
5. Suggest optimal follow-up timing
6. Rate your confidence in the analysis (0.0-1.0)

Return ONLY valid JSON matching this schema:
{
  "summary": "Brief one-line summary",
  "reasoning": "Detailed explanation of why the analysis makes sense",
  "customerContext": "Observations about the customer's payment behavior",
  "recommendedTone": "friendly" | "firm" | "urgent" | "legal",
  "suggestedFollowUpDays": number,
  "confidence": number between 0.0 and 1.0
}`;

// ── LLM Provider ───────────────────────────────────────────

class LLMReasoningProvider implements ReasoningProvider {
  async analyze(input: ReasoningInput): Promise<ReasoningOutput> {
    try {
      const userMessage = buildUserMessage(input);
      const response = await callLLM(SYSTEM_PROMPT, userMessage);

      // Validate and parse response
      const parsed = validateLLMResponse(response);

      return {
        reasoning: parsed.reasoning,
        confidence: clamp(parsed.confidence, 0.3, 0.95),
        summary: parsed.summary,
        customerContext: parsed.customerContext,
        recommendedTone: parsed.recommendedTone,
        suggestedFollowUpDays: parsed.suggestedFollowUpDays,
        provider: 'llm',
        model: AI_MODEL,
        fallback: false,
      };
    } catch (error: any) {
      // Graceful fallback to deterministic reasoning
      console.warn(`[Reasoning] LLM call failed: ${error.message}. Using deterministic fallback.`);
      const fallback = new DeterministicReasoningProvider();
      const result = await fallback.analyze(input);
      return {
        ...result,
        fallback: true,
        fallbackReason: `LLM unavailable: ${error.message}`,
      };
    }
  }
}

// ── Call LLM API ────────────────────────────────────────────

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3, // Low temperature for consistent, factual output
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in LLM response');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Build User Message ──────────────────────────────────────

function buildUserMessage(input: ReasoningInput): string {
  const lateRate = input.totalPayments > 0
    ? ((input.latePayments / input.totalPayments) * 100).toFixed(0)
    : 'N/A';

  return `Analyze this recovery situation and return structured JSON.

Invoice:
- Number: ${input.invoiceNumber}
- Amount: ₹${input.amount.toLocaleString('en-IN')}
- Days Overdue: ${input.daysOverdue}

Customer:
- Name: ${input.customerName}
- Company: ${input.customerCompany}
- Payment History: ${input.totalPayments} total payments, ${input.latePayments} late (${lateRate}% late rate)
- Reliability Score: ${(input.customerReliability * 100).toFixed(0)}%

Recovery Context:
- Previous Attempts: ${input.previousAttempts}
- Broken Promises: ${input.brokenPromises}

Please provide your analysis as JSON.`;
}

// ── Validate LLM Response ───────────────────────────────────

interface LLMResponse {
  summary: string;
  reasoning: string;
  customerContext: string;
  recommendedTone: 'friendly' | 'firm' | 'urgent' | 'legal';
  suggestedFollowUpDays: number;
  confidence: number;
}

function validateLLMResponse(raw: string): LLMResponse {
  let parsed: any;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }

  // Validate required fields
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('LLM response is not an object');
  }

  if (typeof parsed.reasoning !== 'string' || parsed.reasoning.length < 10) {
    throw new Error('LLM reasoning is missing or too short');
  }

  if (typeof parsed.summary !== 'string') {
    parsed.summary = parsed.reasoning.slice(0, 120) + '...';
  }

  if (typeof parsed.customerContext !== 'string') {
    parsed.customerContext = '';
  }

  // Validate tone
  const validTones = ['friendly', 'firm', 'urgent', 'legal'];
  if (!validTones.includes(parsed.recommendedTone)) {
    parsed.recommendedTone = 'firm'; // safe default
  }

  // Validate follow-up days
  if (typeof parsed.suggestedFollowUpDays !== 'number' || parsed.suggestedFollowUpDays < 0 || parsed.suggestedFollowUpDays > 90) {
    parsed.suggestedFollowUpDays = 7; // safe default
  }

  // Validate confidence
  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
    parsed.confidence = 0.7; // safe default
  }

  return parsed as LLMResponse;
}

// ── Deterministic Fallback ──────────────────────────────────

class DeterministicReasoningProvider implements ReasoningProvider {
  async analyze(input: ReasoningInput): Promise<ReasoningOutput> {
    const parts: string[] = [];
    let confidence = 0.75;

    // Analyze overdue severity
    if (input.daysOverdue <= 7) {
      parts.push(`The invoice is ${input.daysOverdue} days overdue, which is in the early stage. Recovery chances are typically high at this point.`);
      confidence += 0.05;
    } else if (input.daysOverdue <= 30) {
      parts.push(`The invoice is ${input.daysOverdue} days overdue, entering the moderate-risk window. Proactive outreach is recommended.`);
    } else if (input.daysOverdue <= 60) {
      parts.push(`The invoice is ${input.daysOverdue} days overdue, which is in the high-risk zone. More aggressive recovery tactics may be needed.`);
      confidence -= 0.05;
    } else {
      parts.push(`The invoice is severely overdue at ${input.daysOverdue} days. Recovery probability drops significantly past 60 days.`);
      confidence -= 0.10;
    }

    // Analyze customer reliability
    if (input.customerReliability > 0.7) {
      parts.push(`${input.customerName} from ${input.customerCompany} has a strong reliability profile (${(input.customerReliability * 100).toFixed(0)}%), suggesting they are likely to respond to recovery efforts.`);
      confidence += 0.08;
    } else if (input.customerReliability > 0.4) {
      parts.push(`${input.customerName} from ${input.customerCompany} has moderate reliability (${(input.customerReliability * 100).toFixed(0)}%). Follow-up may be needed.`);
    } else {
      parts.push(`${input.customerName} from ${input.customerCompany} has low reliability (${(input.customerReliability * 100).toFixed(0)}%). Escalation may be necessary.`);
      confidence -= 0.08;
    }

    // Analyze payment history
    const lateRate = input.totalPayments > 0 ? input.latePayments / input.totalPayments : 0;
    if (lateRate > 0.5) {
      parts.push(`Historical late payment rate of ${(lateRate * 100).toFixed(0)}% indicates a pattern of delayed payments.`);
    } else if (lateRate < 0.15) {
      parts.push(`Excellent payment record with only ${(lateRate * 100).toFixed(0)}% late payments across ${input.totalPayments} transactions.`);
      confidence += 0.05;
    }

    // Analyze previous attempts
    if (input.previousAttempts >= 5) {
      parts.push(`${input.previousAttempts} recovery attempts have already been made. Further automated attempts may have diminishing returns.`);
      confidence -= 0.10;
    } else if (input.previousAttempts > 0) {
      parts.push(`${input.previousAttempts} previous recovery attempt(s) have been made. Monitoring for response is advised.`);
    }

    // Analyze broken promises
    if (input.brokenPromises > 0) {
      parts.push(`${input.brokenPromises} previously broken promise(s) significantly reduce confidence in future commitments.`);
      confidence -= input.brokenPromises * 0.05;
    }

    const finalConfidence = Math.max(0.4, Math.min(0.95, confidence));

    // Determine summary and context
    const summary = input.daysOverdue > 60
      ? `Severely overdue invoice (₹${input.amount.toLocaleString('en-IN')}) from ${input.customerCompany} requires immediate attention.`
      : input.daysOverdue > 14
      ? `Moderately overdue invoice (₹${input.amount.toLocaleString('en-IN')}) from ${input.customerCompany} needs proactive follow-up.`
      : `Recently overdue invoice (₹${input.amount.toLocaleString('en-IN')}) from ${input.customerCompany} in early recovery window.`;

    const customerContext = input.brokenPromises > 0
      ? `${input.customerCompany} has ${input.brokenPromises} broken promise(s) and ${input.latePayments}/${input.totalPayments} late payments. Customer reliability is low.`
      : input.customerReliability > 0.7
      ? `${input.customerCompany} has a strong payment history with ${input.totalPayments} transactions. This overdue payment is likely an oversight.`
      : `${input.customerCompany} has ${input.latePayments}/${input.totalPayments} late payments. Moderate collection risk.`;

    // Suggest tone based on risk
    let recommendedTone: 'friendly' | 'firm' | 'urgent' | 'legal' = 'firm';
    if (input.daysOverdue > 60 || input.customerReliability < 0.3) recommendedTone = 'legal';
    else if (input.daysOverdue > 30 || input.brokenPromises > 0) recommendedTone = 'urgent';
    else if (input.customerReliability > 0.7 && input.daysOverdue < 14) recommendedTone = 'friendly';

    // Suggest follow-up days
    let suggestedFollowUpDays = 7;
    if (input.daysOverdue > 60) suggestedFollowUpDays = 3;
    else if (input.daysOverdue > 30) suggestedFollowUpDays = 5;
    else if (input.daysOverdue <= 7) suggestedFollowUpDays = 10;

    return {
      reasoning: parts.join(' '),
      confidence: finalConfidence,
      summary,
      customerContext,
      recommendedTone,
      suggestedFollowUpDays,
      provider: 'deterministic',
      fallback: false,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
