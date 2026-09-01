// PayPromise AI Recovery Engine - Types
// All types shared across the recovery engine modules.

// ── Input Data ──────────────────────────────────────────────

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issuedAt: Date;
  dueAt: Date;
  paidAt: Date | null;
  status: string; // pending, overdue, paid, partially_paid, written_off
  recoveryStatus: string;
  followUpCount: number;
  escalationLevel: number;
  lastFollowUpAt: Date | null;
}

export interface CustomerData {
  id: string;
  name: string;
  company: string;
  email: string;
  riskScore: number; // 0-1
  avgDaysToPay: number;
  totalPaid: number;
  totalDue: number;
  paymentCount: number;
  latePayments: number;
}

export interface CommitmentData {
  id: string;
  amount: number;
  promisedAt: Date;
  dueDate: Date;
  status: string; // active, fulfilled, broken, cancelled
}

export interface MessageData {
  id: string;
  channel: string;
  tone: string;
  sentAt: Date;
}

// ── Scoring Output ──────────────────────────────────────────

export interface ScoringFactors {
  daysOverdue: number;
  amountSeverity: number;       // 0-1, higher = larger amount relative to customer total
  customerReliability: number;  // 0-1, higher = more reliable
  paymentHistory: number;       // 0-1, based on late/total ratio
  relationshipDepth: number;    // 0-1, based on payment count
  commitmentTrack: number;      // 0-1, based on fulfilled vs broken promises
  contactFatigue: number;       // 0-1, higher = more contacts already made
  recoveryMomentum: number;     // 0-1, based on current recovery status progress
  reasonings: string[];         // human-readable explanations for each factor
}

export interface ScoringResult {
  recoveryProbability: number; // 0-1
  riskLevel: RiskLevel;
  factors: ScoringFactors;
  overallReasoning: string;
  confidence: number; // 0-1
}

// ── Strategy Output ─────────────────────────────────────────

export type RecoveryAction =
  | 'SEND_REMINDER'
  | 'REQUEST_PROMISE'
  | 'CREATE_PAYMENT_LINK'
  | 'FOLLOW_UP'
  | 'ESCALATE'
  | 'STOP';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface StrategyResult {
  action: RecoveryAction;
  reason: string;
  suggestedFollowUpDays: number;
  suggestedTone: 'friendly' | 'firm' | 'urgent' | 'legal';
  suggestedChannel: 'email' | 'sms' | 'whatsapp';
}

// ── Policy Output ───────────────────────────────────────────

export type PolicyDecision = 'ALLOW' | 'BLOCK' | 'ESCALATE';

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
  originalAction: RecoveryAction;
  finalAction: RecoveryAction;
}

// ── Message Generation ──────────────────────────────────────

export interface GeneratedMessage {
  channel: 'email' | 'sms' | 'whatsapp';
  subject: string | null;
  content: string;
  tone: 'friendly' | 'firm' | 'urgent' | 'legal';
}

// ── Orchestrator Output ─────────────────────────────────────

export interface RecoveryAnalysisResult {
  scoring: ScoringResult;
  strategy: StrategyResult;
  policy: PolicyResult;
  messages: GeneratedMessage[];
  timestamp: Date;
  provider?: {
    provider: 'llm' | 'deterministic';
    model?: string;
    fallback: boolean;
    fallbackReason?: string;
    summary?: string;
    customerContext?: string;
    llmRecommendedTone?: string;
    llmFollowUpDays?: number;
  };
}

// ── Reasoning Abstraction ───────────────────────────────────

export interface ReasoningProvider {
  analyze(input: ReasoningInput): Promise<ReasoningOutput>;
}

export interface ReasoningInput {
  invoiceNumber: string;
  amount: number;
  daysOverdue: number;
  customerName: string;
  customerCompany: string;
  customerReliability: number;
  previousAttempts: number;
  brokenPromises: number;
  totalPayments: number;
  latePayments: number;
}

export interface ReasoningOutput {
  reasoning: string;
  confidence: number;
  summary?: string;             // Brief one-line summary
  customerContext?: string;     // LLM's reading of customer situation
  recommendedTone?: 'friendly' | 'firm' | 'urgent' | 'legal';
  suggestedFollowUpDays?: number;
  provider?: 'llm' | 'deterministic'; // Which provider produced this
  model?: string;               // Model name if LLM
  fallback?: boolean;           // True if LLM failed and fallback was used
  fallbackReason?: string;      // Why fallback occurred
}
