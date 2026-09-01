import { prisma } from '@/lib/prisma';
import { formatDateTime, formatRecoveryStatus, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const [aiActions, legacyLogs] = await Promise.all([
    prisma.aIAction.findMany({ orderBy: { createdAt: 'desc' }, include: { invoice: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, include: { invoice: true }, take: 20 }),
  ]);

  const allEntries = [
    ...aiActions.map(a => ({
      id: a.id, type: 'ai_action' as const, action: a.action, actor: a.actor,
      reason: a.reason, confidence: a.confidence, policyDecision: a.policyDecision,
      policyReason: a.policyReason, result: a.result,
      invoiceNumber: a.invoice?.invoiceNumber ?? null, invoiceId: a.invoice?.id ?? null,
      amount: a.invoice?.amount, createdAt: a.createdAt,
    })),
    ...legacyLogs.map(l => ({
      id: l.id, type: 'audit_log' as const, action: l.action, actor: l.actor,
      reason: null, confidence: null, policyDecision: null, policyReason: null,
      result: l.details, invoiceNumber: l.invoice?.invoiceNumber ?? null,
      invoiceId: l.invoice?.id ?? null, amount: l.invoice?.amount, createdAt: l.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const policyCounts = aiActions.reduce((acc, a) => { acc[a.policyDecision] = (acc[a.policyDecision] || 0) + 1; return acc; }, {} as Record<string, number>);

  // Build pipeline summary for recent invoices
  const recentInvoices = await prisma.invoice.findMany({
    where: { status: 'overdue' },
    include: { customer: true, analyses: { take: 1 }, aiActions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Complete AI activity trail — every decision is tracked and auditable</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs font-medium text-blue-600">Engine Actions</p>
          <p className="text-xl font-bold text-blue-700">{aiActions.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs font-medium text-green-600">Policy: ALLOW</p>
          <p className="text-xl font-bold text-green-700">{policyCounts['ALLOW'] ?? 0}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-xs font-medium text-red-600">Policy: BLOCK</p>
          <p className="text-xl font-bold text-red-700">{policyCounts['BLOCK'] ?? 0}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4">
          <p className="text-xs font-medium text-yellow-600">Policy: ESCALATE</p>
          <p className="text-xl font-bold text-yellow-700">{policyCounts['ESCALATE'] ?? 0}</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* VISUAL RECOVERY PIPELINE                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recovery Pipeline</h2>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {[
            { label: 'AI Analysis', icon: '🤖', color: 'bg-blue-100 text-blue-700' },
            { label: 'Recommendation', icon: '📊', color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Policy Check', icon: '🛡️', color: 'bg-purple-100 text-purple-700' },
            { label: 'Action', icon: '⚡', color: 'bg-yellow-100 text-yellow-700' },
            { label: 'Promise', icon: '🤝', color: 'bg-orange-100 text-orange-700' },
            { label: 'Payment', icon: '💳', color: 'bg-green-100 text-green-700' },
            { label: 'Recovery', icon: '✅', color: 'bg-emerald-100 text-emerald-700' },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center">
              <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg ${step.color}`}>
                <span className="text-lg">{step.icon}</span>
                <span className="text-[10px] font-medium whitespace-nowrap">{step.label}</span>
              </div>
              {i < 6 && <span className="text-gray-300 mx-1 text-lg">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* RECENT INVOICE PIPELINES                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Invoice Pipelines</h2>
        <div className="space-y-4">
          {recentInvoices.map((inv) => {
            const stages = [
              { label: 'Analysis', done: inv.analyses.length > 0 },
              { label: 'Action', done: inv.aiActions.some(a => a.action !== 'analyze') },
              { label: 'Policy', done: inv.aiActions.some(a => a.policyDecision === 'ALLOW') },
              { label: 'Promise', done: false },
              { label: 'Payment', done: false },
              { label: 'Recovered', done: inv.status === 'paid' },
            ];

            return (
              <div key={inv.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/invoices/${inv.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                      {inv.invoiceNumber}
                    </Link>
                    <span className="text-xs text-gray-500">{inv.customer?.name}</span>
                    {inv.amount && <span className="text-xs font-medium text-gray-700">{formatCurrency(inv.amount)}</span>}
                  </div>
                  <span className={`badge text-[10px] ${inv.recoveryProbability && inv.recoveryProbability < 0.3 ? 'badge-danger' : inv.recoveryProbability && inv.recoveryProbability < 0.5 ? 'badge-warning' : 'badge-success'}`}>
                    {inv.recoveryProbability ? `${(inv.recoveryProbability * 100).toFixed(0)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {stages.map((stage, i) => (
                    <div key={stage.label} className="flex items-center">
                      <div className={`px-2 py-1 rounded text-[10px] font-medium ${stage.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {stage.done ? '✓' : '○'} {stage.label}
                      </div>
                      {i < stages.length - 1 && <span className="text-gray-300 mx-0.5">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Timeline */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Full Activity Timeline ({allEntries.length} entries)</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {allEntries.slice(0, 30).map((entry) => (
            <div key={entry.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50/50">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-blue-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                {entry.action.includes('analysis') || entry.action === 'analyze' ? '🤖' :
                 entry.action.includes('message') || entry.action.includes('reminder') ? '📧' :
                 entry.action.includes('escalat') || entry.action.includes('auto_escalat') ? '🚨' :
                 entry.action.includes('promise') || entry.action.includes('payout') ? '🤝' :
                 entry.action.includes('payment') ? '💳' : '📋'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{formatRecoveryStatus(entry.action)}</span>
                  {entry.type === 'ai_action' && entry.policyDecision && (
                    <span className={`badge text-[10px] ${entry.policyDecision === 'ALLOW' ? 'badge-success' : entry.policyDecision === 'BLOCK' ? 'badge-danger' : 'badge-warning'}`}>{entry.policyDecision}</span>
                  )}
                  <span className="text-xs text-gray-400">by {entry.actor}</span>
                  {entry.invoiceNumber && (
                    <Link href={`/invoices/${entry.invoiceId}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">{entry.invoiceNumber}</Link>
                  )}
                  {entry.amount && <span className="text-xs text-gray-500">{formatCurrency(entry.amount)}</span>}
                </div>
                {entry.reason && <p className="text-xs text-gray-600 mt-1">{entry.reason}</p>}
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{formatDateTime(entry.createdAt)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
