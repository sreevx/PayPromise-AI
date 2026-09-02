import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getRiskColor(prob: number) {
  if (prob >= 0.5) return 'text-green-600 bg-green-50 border-green-200';
  if (prob >= 0.3) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function getRiskLabel(prob: number) {
  if (prob >= 0.5) return 'Low';
  if (prob >= 0.3) return 'Medium';
  return 'High';
}

function getActionIcon(action: string) {
  if (action.includes('reminder') || action.includes('message')) return '📧';
  if (action.includes('promise')) return '🤝';
  if (action.includes('payment')) return '💳';
  if (action.includes('escalat')) return '🚨';
  if (action.includes('analyze')) return '🤖';
  if (action.includes('follow')) return '📋';
  return '📋';
}

function getActionLabel(action: string) {
  if (action === 'analyze') return 'Invoice analyzed';
  if (action.includes('reminder')) return 'Reminder recommended';
  if (action.includes('promise')) return 'Promise requested';
  if (action.includes('payment_link_created')) return 'Payment link created';
  if (action.includes('payment_received')) return 'Payment received';
  if (action.includes('payment_failed')) return 'Payment failed';
  if (action.includes('escalat')) return 'Invoice escalated';
  if (action.includes('follow')) return 'Follow-up scheduled';
  if (action.includes('broken_promise')) return 'Broken promise detected';
  if (action.includes('create_promise')) return 'Promise recorded';
  if (action.includes('fulfill')) return 'Promise fulfilled';
  return action.replace(/_/g, ' ');
}

export default async function DashboardPage() {
  const [invoices, recentActions, activePromises, escalatedCount] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        customer: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.aIAction.findMany({
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
      take: 8,
    }),
    prisma.promiseToPay.count({ where: { status: 'active' } }),
    prisma.invoice.count({ where: { escalationLevel: { gte: 1 }, status: { not: 'paid' } } }),
  ]);

  // Compute metrics
  const totalRevenue = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const overdueInvoices = invoices.filter(i => {
    const isPaid = i.status === 'paid' || i.recoveryStatus === 'recovered';
    return !isPaid && new Date(i.dueAt) < new Date();
  });
  const revenueAtRisk = overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const paidInvoices = invoices.filter(i => i.status === 'paid' || i.recoveryStatus === 'recovered');
  const revenueRecovered = paidInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const recoveryRate = totalRevenue > 0 ? Math.round((revenueRecovered / totalRevenue) * 100) : 0;

  // Risk distribution for overdue invoices
  const highRisk = overdueInvoices.filter(i => (i.recoveryProbability ?? 0) < 0.3);
  const medRisk = overdueInvoices.filter(i => (i.recoveryProbability ?? 0) >= 0.3 && (i.recoveryProbability ?? 0) < 0.5);
  const lowRisk = overdueInvoices.filter(i => (i.recoveryProbability ?? 0) >= 0.5);

  const highRiskAmount = highRisk.reduce((s, i) => s + Number(i.amount), 0);
  const medRiskAmount = medRisk.reduce((s, i) => s + Number(i.amount), 0);
  const lowRiskAmount = lowRisk.reduce((s, i) => s + Number(i.amount), 0);

  // Recovery queue: top 5 overdue invoices sorted by urgency (lowest probability first)
  const recoveryQueue = overdueInvoices
    .sort((a, b) => (a.recoveryProbability ?? 0) - (b.recoveryProbability ?? 0))
    .slice(0, 5);

  const maxRiskAmount = Math.max(highRiskAmount, medRiskAmount, lowRiskAmount, 1);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">PayPromise AI</p>
              <h1 className="mt-1 text-3xl font-bold text-gray-900">
                {getGreeting()}, receivables overview
              </h1>
              <p className="mt-2 text-gray-500">
                AI-powered monitoring of your outstanding payments and recovery pipeline.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-green-700">AI Recovery Engine Active</span>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            <p className="mt-1 text-xs text-gray-400">{invoices.length} invoices</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Revenue at Risk</p>
            <p className="mt-2 text-2xl font-bold text-red-700">{formatCurrency(revenueAtRisk)}</p>
            <p className="mt-1 text-xs text-red-500">{overdueInvoices.length} overdue</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Revenue Recovered</p>
            <p className="mt-2 text-2xl font-bold text-green-700">{formatCurrency(revenueRecovered)}</p>
            <p className="mt-1 text-xs text-green-500">{paidInvoices.length} paid</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Recovery Rate</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">{recoveryRate}%</p>
            <p className="mt-1 text-xs text-blue-500">of total value</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Pipeline</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{activePromises + escalatedCount}</p>
            <p className="mt-1 text-xs text-gray-400">{activePromises} promises · {escalatedCount} escalated</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Left column: Risk + Queue ─────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Risk Distribution */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">AI Risk Distribution</h2>
                <span className="text-xs text-gray-400">Overdue invoices by risk level</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{highRisk.length}</p>
                  <p className="mt-1 text-xs font-semibold text-red-700">High Risk</p>
                  <p className="mt-1 text-xs text-red-500">{formatCurrency(highRiskAmount)}</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-red-100">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${(highRiskAmount / maxRiskAmount) * 100}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-600">{medRisk.length}</p>
                  <p className="mt-1 text-xs font-semibold text-yellow-700">Medium Risk</p>
                  <p className="mt-1 text-xs text-yellow-600">{formatCurrency(medRiskAmount)}</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-yellow-100">
                    <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(medRiskAmount / maxRiskAmount) * 100}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{lowRisk.length}</p>
                  <p className="mt-1 text-xs font-semibold text-green-700">Low Risk</p>
                  <p className="mt-1 text-xs text-green-600">{formatCurrency(lowRiskAmount)}</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-green-100">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${(lowRiskAmount / maxRiskAmount) * 100}%` }} />
                  </div>
                </div>
              </div>
            </section>

            {/* Recovery Queue */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">AI Recovery Queue</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Invoices requiring attention, sorted by priority</p>
                </div>
                <Link href="/invoices" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                  View all →
                </Link>
              </div>
              {recoveryQueue.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No overdue invoices — all clear!</p>
              ) : (
                <div className="space-y-3">
                  {recoveryQueue.map((inv) => {
                    const prob = inv.recoveryProbability ?? 0;
                    const probPct = Math.round(prob * 100);
                    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(inv.dueAt).getTime()) / 86400000));
                    const action = inv.recommendedAction?.split(':')[0] ?? 'ANALYZE';
                    return (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 hover:bg-gray-50 hover:shadow-sm transition"
                      >
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold border ${getRiskColor(prob)}`}>
                          {probPct}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">{inv.customer?.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              prob < 0.3 ? 'bg-red-100 text-red-700' : prob < 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {getRiskLabel(prob)} Risk
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500">{inv.invoiceNumber}</span>
                            <span className="text-xs font-semibold text-gray-700">{formatCurrency(Number(inv.amount))}</span>
                            <span className="text-xs text-red-500">{daysOverdue}d overdue</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                            {action.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ── Right column: Actions + Quick Links ────────── */}
          <div className="space-y-6">

            {/* Recent AI Actions */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent AI Actions</h2>
                <Link href="/audit" className="text-xs font-semibold text-blue-600 hover:text-blue-800">View all →</Link>
              </div>
              {recentActions.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No actions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentActions.map((action) => (
                    <div key={action.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                      <span className="text-base mt-0.5">{getActionIcon(action.action)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{getActionLabel(action.action)}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {action.invoice?.invoiceNumber && (
                            <Link href={`/invoices/${action.invoice.id}`} className="text-blue-600 hover:underline">
                              {action.invoice.invoiceNumber}
                            </Link>
                          )}
                          {action.invoice && ' · '}
                          {action.policyDecision && (
                            <span className={`font-medium ${
                              action.policyDecision === 'ALLOW' ? 'text-green-600' :
                              action.policyDecision === 'BLOCK' ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                              {action.policyDecision}
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(action.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quick Actions */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/invoices" className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition">
                  <span className="text-lg">📄</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">All Invoices</p>
                    <p className="text-xs text-gray-500">Search, filter, manage</p>
                  </div>
                </Link>
                <Link href="/invoices?risk=high" className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3 hover:bg-red-50 transition">
                  <span className="text-lg">🚨</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">High-Risk Invoices</p>
                    <p className="text-xs text-red-500">{highRisk.length} invoices need attention</p>
                  </div>
                </Link>
                <Link href="/follow-ups" className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition">
                  <span className="text-lg">🔔</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Follow-ups</p>
                    <p className="text-xs text-gray-500">Promises & commitments</p>
                  </div>
                </Link>
                <Link href="/revenue" className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition">
                  <span className="text-lg">💰</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Revenue Insights</p>
                    <p className="text-xs text-gray-500">Detailed recovery analytics</p>
                  </div>
                </Link>
              </div>
            </section>

            {/* Revenue Summary Bar */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Revenue Breakdown</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Recovered</span>
                    <span className="text-xs font-semibold text-green-600">{formatCurrency(revenueRecovered)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${recoveryRate}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">At Risk</span>
                    <span className="text-xs font-semibold text-red-600">{formatCurrency(revenueAtRisk)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${totalRevenue > 0 ? Math.round((revenueAtRisk / totalRevenue) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>

      </div>
    </main>
  );
}
