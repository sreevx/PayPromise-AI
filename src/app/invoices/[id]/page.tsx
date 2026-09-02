import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import RazorpayPayment from './RazorpayPayment';
import { RecoveryActions } from './RecoveryActions';

type PageProps = { params: { id: string } };

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function getRiskBadge(level: string) {
  const l = level?.toUpperCase();
  if (l === 'LOW') return { label: 'Low Risk', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (l === 'HIGH') return { label: 'High Risk', cls: 'bg-red-500/20 text-red-300 border-red-500/30' };
  return { label: 'Medium Risk', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
}

function getPolicyBadge(decision: string) {
  if (decision === 'ALLOW') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (decision === 'BLOCK') return 'bg-red-500/20 text-red-300 border-red-500/30';
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
}

function getChannelIcon(channel: string) {
  if (channel === 'email') return '📧';
  if (channel === 'sms') return '💬';
  if (channel === 'whatsapp') return '📱';
  return '📋';
}

function getToneBadge(tone: string) {
  if (tone === 'friendly') return 'bg-emerald-500/15 text-emerald-300';
  if (tone === 'firm') return 'bg-amber-500/15 text-amber-300';
  if (tone === 'urgent') return 'bg-red-500/15 text-red-300';
  if (tone === 'legal') return 'bg-purple-500/15 text-purple-300';
  return 'bg-white/10 text-slate-300';
}

function getActionLabel(action: string) {
  const map: Record<string, string> = {
    analyze: 'AI Analysis',
    send_reminder: 'Send Reminder',
    request_promise: 'Request Promise',
    create_payment_link: 'Create Payment Link',
    follow_up: 'Follow Up',
    escalate: 'Escalate',
    payment_received: 'Payment Received',
    payment_failed: 'Payment Failed',
    create_promise: 'Promise Recorded',
    fulfill_promise: 'Promise Fulfilled',
    broken_promise: 'Broken Promise',
    cancel_promise: 'Promise Cancelled',
  };
  return map[action] || action.replace(/_/g, ' ');
}

export default async function InvoicePage({ params }: PageProps) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      commitments: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      aiActions: { orderBy: { createdAt: 'desc' }, take: 5 },
      messages: { orderBy: { sentAt: 'desc' } },
    },
  });

  if (!invoice) notFound();

  const existingPayment = invoice.payments?.[0] ?? null;
  const amount = Number(invoice.amount ?? 0);
  const latestAnalysis = invoice.analyses?.[0] ?? null;
  const latestAction = invoice.aiActions?.[0] ?? null;
  const recoveryProbability = Number(invoice.recoveryProbability ?? latestAnalysis?.recoveryProbability ?? 0);
  const riskLevel = latestAnalysis?.riskLevel ?? (recoveryProbability >= 0.5 ? 'LOW' : recoveryProbability >= 0.3 ? 'MEDIUM' : 'HIGH');
  const reasoning = latestAnalysis?.reasoning ?? '';
  const confidence = latestAnalysis?.confidence ?? 0;
  const followUpDays = latestAnalysis?.followUpDays ?? 0;
  const factors = latestAnalysis?.factors ? JSON.parse(latestAnalysis.factors) : null;
  const risk = getRiskBadge(riskLevel);
  const isPaid = invoice.status === 'paid' || invoice.recoveryStatus === 'recovered';
  const isOverdue = !isPaid && new Date(invoice.dueAt) < new Date();
  const daysOverdue = isOverdue ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueAt).getTime()) / 86400000)) : 0;
  const activePromises = invoice.commitments?.filter((c: { status: string }) => c.status === 'active') ?? [];
  const fulfilledPromises = invoice.commitments?.filter((c: { status: string }) => c.status === 'fulfilled') ?? [];
  const brokenPromises = invoice.commitments?.filter((c: { status: string }) => c.status === 'broken') ?? [];

  // Pipeline step states
  const hasAnalysis = !!latestAnalysis;
  const hasStrategy = !!invoice.recommendedAction;
  const hasPolicy = latestAction?.policyDecision != null;
  const hasMessage = invoice.messages?.length > 0;
  const hasPayment = !!existingPayment;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <Link href="/invoices" className="text-sm text-slate-400 hover:text-white">← Back to Invoices</Link>
            <h1 className="mt-2 text-2xl font-bold">Invoice Details</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-full border px-4 py-2 text-sm font-medium ${risk.cls}`}>{risk.label}</div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">{invoice.invoiceNumber}</div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">

        {/* ── AI Pipeline Progression ─────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">AI Recovery Pipeline</h2>
          <div className="flex items-center justify-between overflow-x-auto gap-2">
            {[
              { label: 'Recovery Analysis', icon: '🤖', done: hasAnalysis },
              { label: 'Strategy', icon: '📊', done: hasStrategy },
              { label: 'Policy Check', icon: '🛡️', done: hasPolicy },
              { label: 'Message', icon: '✉️', done: hasMessage },
              { label: 'Payment', icon: '💳', done: hasPayment },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border ${
                  step.done
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    : 'bg-white/[0.02] border-white/10 text-slate-500'
                }`}>
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-[11px] font-medium whitespace-nowrap">{step.label}</span>
                  {step.done && <span className="text-[10px] text-blue-400">✓ Complete</span>}
                </div>
                {i < 4 && <span className="text-slate-600 mx-1 text-lg">→</span>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Invoice + Payment Side by Side ──────────────────── */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Invoice Card */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-col justify-between gap-6 sm:flex-row">
              <div>
                <p className="text-sm text-slate-400">Invoice</p>
                <h2 className="mt-1 text-3xl font-bold">{invoice.invoiceNumber}</h2>
                <p className="mt-2 text-slate-400">{invoice.customer?.name ?? 'Unknown Customer'}</p>
                {invoice.customer?.email && <p className="mt-1 text-sm text-slate-500">{invoice.customer.email}</p>}
                {invoice.description && <p className="mt-1 text-sm text-slate-500">{invoice.description}</p>}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-slate-400">Invoice Amount</p>
                <p className="mt-1 text-3xl font-bold">{formatCurrency(amount)}</p>
                <p className="mt-1 text-sm text-slate-500">{invoice.currency ?? 'INR'}</p>
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-2 font-semibold capitalize">{invoice.status?.replaceAll('_', ' ')}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Due Date</p>
                <p className="mt-2 font-semibold">
                  {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString('en-IN') : '—'}
                  {isOverdue && <span className="ml-2 text-xs text-red-400">{daysOverdue}d overdue</span>}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Recovery Probability</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 w-16 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.round(recoveryProbability * 100))}%` }} />
                  </div>
                  <span className="font-semibold">{Math.round(recoveryProbability * 100)}%</span>
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Follow-ups</p>
                <p className="mt-2 font-semibold">{invoice.followUpCount}</p>
              </div>
            </div>
          </div>

          {/* Payment Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-semibold">Payment</h2>
            <p className="mt-1 text-sm text-slate-400">Secure payment through Razorpay</p>
            <div className="mt-6">
              <RazorpayPayment
                invoiceId={invoice.id}
                invoiceAmount={amount}
                invoiceNumber={invoice.invoiceNumber}
                existingPayment={existingPayment ? { ...existingPayment, createdAt: existingPayment.createdAt.toISOString() } : null}
              />
            </div>
          </div>
        </section>

        {/* ── Recovery Analysis ───────────────────────────────── */}
        {hasAnalysis && (
          <section className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg">🤖</div>
              <div>
                <h2 className="text-lg font-semibold">Recovery Analysis</h2>
                <p className="text-xs text-slate-400">AI assessment of recovery likelihood — {latestAnalysis?.createdAt ? new Date(latestAnalysis.createdAt).toLocaleDateString('en-IN') : ''}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-bold text-blue-400">{Math.round(recoveryProbability * 100)}%</p>
                <p className="text-xs text-slate-400">Recovery Probability</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-slate-500">Risk Level</p>
                <p className={`mt-1 font-semibold ${riskLevel === 'HIGH' ? 'text-red-400' : riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>{riskLevel}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-slate-500">Confidence</p>
                <p className="mt-1 font-semibold">{Math.round(confidence * 100)}%</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-slate-500">Follow-up in</p>
                <p className="mt-1 font-semibold">{followUpDays > 0 ? `${followUpDays} days` : 'Immediate'}</p>
              </div>
            </div>

            {reasoning && (
              <div className="rounded-xl bg-white/5 p-4 mb-4">
                <p className="text-xs font-medium text-slate-400 mb-2">AI Reasoning</p>
                <p className="text-sm text-slate-300 leading-relaxed">{reasoning}</p>
              </div>
            )}

            {factors && (
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs font-medium text-slate-400 mb-2">Scoring Factors</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {factors.daysOverdue != null && (
                    <div className="flex justify-between"><span className="text-slate-500">Days Overdue</span><span className="font-medium">{factors.daysOverdue}</span></div>
                  )}
                  {factors.customerReliability != null && (
                    <div className="flex justify-between"><span className="text-slate-500">Customer Reliability</span><span className="font-medium">{Math.round(factors.customerReliability * 100)}%</span></div>
                  )}
                  {factors.paymentHistory != null && (
                    <div className="flex justify-between"><span className="text-slate-500">Payment History</span><span className="font-medium">{Math.round(factors.paymentHistory * 100)}%</span></div>
                  )}
                  {factors.amountSeverity != null && (
                    <div className="flex justify-between"><span className="text-slate-500">Amount Severity</span><span className="font-medium">{Math.round(factors.amountSeverity * 100)}%</span></div>
                  )}
                  {factors.contactFatigue != null && (
                    <div className="flex justify-between"><span className="text-slate-500">Contact Fatigue</span><span className="font-medium">{Math.round(factors.contactFatigue * 100)}%</span></div>
                  )}
                  {factors.commitmentTrack != null && (
                    <div className="flex justify-between"><span className="text-slate-500">Commitment Track</span><span className="font-medium">{Math.round(factors.commitmentTrack * 100)}%</span></div>
                  )}
                  {factors.recoveryMomentum != null && (
                    <div className="flex justify-between"><span className="text-slate-500">Recovery Momentum</span><span className="font-medium">{Math.round(factors.recoveryMomentum * 100)}%</span></div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Recovery Strategy + Policy Check ────────────────── */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Strategy */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-lg">📊</div>
              <div>
                <h2 className="text-lg font-semibold">Recovery Strategy</h2>
                <p className="text-xs text-slate-400">AI-recommended recovery action</p>
              </div>
            </div>
            {invoice.recommendedAction ? (
              <div>
                <div className="rounded-xl bg-white/5 p-4 mb-3">
                  <p className="text-xs text-slate-500">Recommended Action</p>
                  <p className="mt-1 text-lg font-bold text-indigo-400">
                    {invoice.recommendedAction.split(':')[0]?.replace(/_/g, ' ')}
                  </p>
                </div>
                {invoice.recommendedAction.includes(':') && (
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-500">Why This Action</p>
                    <p className="mt-1 text-sm text-slate-300">{invoice.recommendedAction.split(':').slice(1).join(':').trim()}</p>
                  </div>
                )}
                {invoice.recoveryStatus && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Current Recovery Status:</span>
                    <span className="text-xs font-medium text-slate-300 bg-white/5 px-2 py-0.5 rounded">{invoice.recoveryStatus.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No strategy recommendation yet.</p>
            )}
          </div>

          {/* Policy Check */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg">🛡️</div>
              <div>
                <h2 className="text-lg font-semibold">Policy Check</h2>
                <p className="text-xs text-slate-400">Guardrails validated before action execution</p>
              </div>
            </div>
            {hasPolicy ? (
              <div>
                <div className="rounded-xl bg-white/5 p-4 mb-3">
                  <p className="text-xs text-slate-500">Policy Decision</p>
                  <p className="mt-1">
                    <span className={`inline-block text-sm font-bold px-3 py-1 rounded-lg border ${getPolicyBadge(latestAction.policyDecision)}`}>
                      {latestAction.policyDecision}
                    </span>
                  </p>
                </div>
                {latestAction.policyReason && (
                  <div className="rounded-xl bg-white/5 p-4 mb-3">
                    <p className="text-xs text-slate-500">Policy Reason</p>
                    <p className="mt-1 text-sm text-slate-300">{latestAction.policyReason}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xs text-slate-500">Action Evaluated</p>
                    <p className="mt-1 text-sm font-medium">{getActionLabel(latestAction.action)}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-xs text-slate-500">Confidence</p>
                    <p className="mt-1 text-sm font-medium">{Math.round((latestAction.confidence ?? 0) * 100)}%</p>
                  </div>
                </div>
                {latestAction.result && (
                  <div className="mt-3 rounded-xl bg-white/5 p-4">
                    <p className="text-xs text-slate-500">Result</p>
                    <p className="mt-1 text-sm text-slate-300 font-mono break-all">{latestAction.result}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No policy check recorded yet.</p>
            )}
          </div>
        </section>

        {/* ── Customer ────────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-lg font-semibold mb-4">Customer</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="mt-1 font-medium">{invoice.customer?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Company</p>
              <p className="mt-1 font-medium">{invoice.customer?.company ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="mt-1 font-medium">{invoice.customer?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Phone</p>
              <p className="mt-1 font-medium">{invoice.customer?.phone ?? '—'}</p>
            </div>
          </div>
        </section>

        {/* ── Recovery Messages ────────────────────────────────── */}
        {invoice.messages && invoice.messages.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-lg">✉️</div>
              <div>
                <h2 className="text-lg font-semibold">Recovery Messages</h2>
                <p className="text-xs text-slate-400">{invoice.messages.length} message{invoice.messages.length > 1 ? 's' : ''} generated</p>
              </div>
            </div>
            <div className="space-y-3">
              {invoice.messages.map((msg: any) => (
                <div key={msg.id} className="rounded-xl bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{getChannelIcon(msg.channel)}</span>
                      <span className="text-xs font-medium text-slate-300 capitalize">{msg.channel}</span>
                      {msg.subject && <span className="text-xs text-slate-500">· {msg.subject}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getToneBadge(msg.tone)}`}>{msg.tone}</span>
                      {msg.aiGenerated && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">AI Generated</span>}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/50 p-3 border border-white/5">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Sent {msg.sentAt ? new Date(msg.sentAt).toLocaleString('en-IN') : '—'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recovery Actions ─────────────────────────────────── */}
        <RecoveryActions
          invoiceId={invoice.id}
          invoiceStatus={invoice.status}
          isActionable={invoice.status !== 'paid' && invoice.status !== 'pending' && invoice.status !== 'written_off'}
          escalationLevel={invoice.escalationLevel}
          activePromises={activePromises.length}
          invoiceAmount={amount}
        />

        {/* ── Promise to Pay History ────────────────────────────── */}
        {invoice.commitments && invoice.commitments.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-semibold mb-4">Promise to Pay</h2>
            <div className="space-y-3">
              {invoice.commitments.map((ptp: any) => (
                <div key={ptp.id} className={`rounded-xl p-4 border ${
                  ptp.status === 'fulfilled' ? 'bg-emerald-500/5 border-emerald-500/20' :
                  ptp.status === 'broken' ? 'bg-red-500/5 border-red-500/20' :
                  ptp.status === 'active' ? 'bg-amber-500/5 border-amber-500/20' :
                  'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{formatCurrency(ptp.amount)}</p>
                      <p className="text-xs text-slate-400">Due: {new Date(ptp.dueDate).toLocaleDateString('en-IN')}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      ptp.status === 'fulfilled' ? 'bg-emerald-500/20 text-emerald-300' :
                      ptp.status === 'broken' ? 'bg-red-500/20 text-red-300' :
                      ptp.status === 'active' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-white/10 text-slate-300'
                    }`}>{ptp.status}</span>
                  </div>
                  {ptp.notes && <p className="mt-2 text-xs text-slate-400">{ptp.notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent AI Actions ─────────────────────────────────── */}
        {invoice.aiActions && invoice.aiActions.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-semibold mb-4">Recent AI Actions</h2>
            <div className="space-y-2">
              {invoice.aiActions.map((action: any) => (
                <div key={action.id} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    action.policyDecision === 'ALLOW' ? 'bg-emerald-400' :
                    action.policyDecision === 'BLOCK' ? 'bg-red-400' :
                    action.policyDecision === 'ESCALATE' ? 'bg-amber-400' : 'bg-slate-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getActionLabel(action.action)}</span>
                      {action.policyDecision && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPolicyBadge(action.policyDecision)}`}>
                          {action.policyDecision}
                        </span>
                      )}
                    </div>
                    {action.reason && <p className="text-xs text-slate-400 mt-0.5 truncate">{action.reason}</p>}
                  </div>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    {action.createdAt ? new Date(action.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
