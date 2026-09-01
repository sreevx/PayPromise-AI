import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate, getDaysOverdue, getRecoveryProbabilityColor, getStatusColor, formatRecoveryStatus, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Compute all metrics from real database data
  const [overdueInvoices, allInvoices, recentAuditLogs, recentAIActions, activePromises, escalatedCount] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: 'overdue' },
      include: { customer: true },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.invoice.findMany({
      select: { id: true, amount: true, status: true, recoveryProbability: true },
    }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
    }),
    prisma.aIAction.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
    }),
    prisma.promiseToPay.findMany({
      where: { status: 'active' },
      include: { invoice: true, customer: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.invoice.count({
      where: { escalationLevel: { gte: 1 }, status: { not: 'paid' } },
    }),
  ]);

  // Compute metrics from actual data
  const totalRevenue = allInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const revenueAtRisk = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const revenueRecovered = allInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const totalInvoices = allInvoices.length;
  const overdueCount = overdueInvoices.length;
  const recoveredCount = allInvoices.filter(inv => inv.status === 'paid').length;
  const highRiskCount = overdueInvoices.filter(inv => (inv.recoveryProbability ?? 0) < 0.25).length;
  const mediumRiskCount = overdueInvoices.filter(inv => {
    const p = inv.recoveryProbability ?? 0;
    return p >= 0.25 && p < 0.50;
  }).length;

  // Combine recent activity from both audit logs and AI actions
  const allActivity = [
    ...recentAuditLogs.map(l => ({
      id: l.id, type: 'legacy' as const, action: l.action, actor: l.actor,
      invoiceNumber: l.invoice?.invoiceNumber ?? null, invoiceId: l.invoice?.id ?? null,
      createdAt: l.createdAt,
    })),
    ...recentAIActions.map(a => ({
      id: a.id, type: 'engine' as const, action: a.action, actor: a.actor,
      invoiceNumber: a.invoice?.invoiceNumber ?? null, invoiceId: a.invoice?.id ?? null,
      createdAt: a.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Revenue Recovery Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor your invoice recovery performance and take action on overdue payments.</p>
        <p className="text-[10px] text-gray-400 mt-1">Metrics computed from database • {totalInvoices} total invoices</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Revenue at Risk</span>
            <span className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-sm">⚠️</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(revenueAtRisk)}</p>
          <p className="text-xs text-gray-500 mt-1">{overdueCount} overdue invoices</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Revenue Recovered</span>
            <span className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-sm">✅</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(revenueRecovered)}</p>
          <p className="text-xs text-gray-500 mt-1">{recoveredCount} invoices recovered</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Active Promises</span>
            <span className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm">🤝</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{activePromises.length}</p>
          <p className="text-xs text-gray-500 mt-1">Pending commitments</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Escalated Cases</span>
            <span className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-sm">🚨</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{escalatedCount}</p>
          <p className="text-xs text-gray-500 mt-1">{highRiskCount} high risk, {mediumRiskCount} medium risk</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Invoices Table */}
        <div className="lg:col-span-2">
          <div className="table-container">
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Overdue Invoices</h2>
                <p className="text-xs text-gray-500 mt-0.5">Requiring attention</p>
              </div>
              <Link href="/invoices" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Days Overdue</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Recovery %</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.slice(0, 8).map((invoice) => (
                  <tr key={invoice.id} className="table-row">
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${invoice.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{invoice.description}</p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-gray-900">{invoice.customer.name}</p>
                      <p className="text-xs text-gray-500">{invoice.customer.company}</p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.amount)}</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-sm font-bold ${getDaysOverdue(invoice.dueAt) > 30 ? 'text-red-600' : getDaysOverdue(invoice.dueAt) > 14 ? 'text-orange-500' : 'text-yellow-600'}`}>
                        {getDaysOverdue(invoice.dueAt)}d
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-sm font-semibold ${getRecoveryProbabilityColor(invoice.recoveryProbability ?? 0)}`}>
                        {((invoice.recoveryProbability ?? 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`badge ${getStatusColor(invoice.status)}`}>
                        {formatRecoveryStatus(invoice.recoveryStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overdueInvoices.length > 8 && (
              <div className="px-6 py-3 border-t border-gray-100 text-center">
                <Link href="/invoices" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  View {overdueInvoices.length - 8} more overdue invoices →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* AI Recovery Opportunities */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-6">
            <h3 className="text-sm font-semibold text-indigo-900 mb-3">🤖 AI Recovery Opportunities</h3>
            <p className="text-[10px] text-indigo-600 mb-3">Highest-priority invoices for AI-assisted recovery</p>
            <div className="space-y-2">
              {overdueInvoices
                .filter(inv => (inv.recoveryProbability ?? 0) > 0.25 && (inv.recoveryProbability ?? 0) < 0.75)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 4)
                .map(inv => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`} className="block p-3 bg-white/60 rounded-lg hover:bg-white border border-indigo-100/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-indigo-900">{inv.invoiceNumber}</span>
                      <span className="text-xs font-bold text-indigo-700">{formatCurrency(inv.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">{inv.customer.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold ${getRecoveryProbabilityColor(inv.recoveryProbability ?? 0)}`}>
                          {(inv.recoveryProbability ?? 0 * 100).toFixed(0)}% recovery
                        </span>
                        <span className="badge badge-info text-[10px]">
                          {inv.recoveryStatus === 'none' ? 'New' : formatRecoveryStatus(inv.recoveryStatus)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/invoices" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                <span className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-sm group-hover:bg-blue-100">📄</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">View All Invoices</p>
                  <p className="text-xs text-gray-500">Manage and track invoices</p>
                </div>
              </Link>
              <Link href="/customers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                <span className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center text-sm group-hover:bg-purple-100">👥</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Customer Profiles</p>
                  <p className="text-xs text-gray-500">View payment histories</p>
                </div>
              </Link>
              <Link href="/follow-ups" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                <span className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center text-sm group-hover:bg-orange-100">🔔</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Pending Follow-ups</p>
                  <p className="text-xs text-gray-500">{activePromises.length} promises pending</p>
                </div>
              </Link>
              <Link href="/audit" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group">
                <span className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center text-sm group-hover:bg-green-100">📋</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Audit Trail</p>
                  <p className="text-xs text-gray-500">Complete AI activity log</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Active Promises */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Active Commitments</h3>
            {activePromises.length === 0 ? (
              <p className="text-sm text-gray-500">No active promises</p>
            ) : (
              <div className="space-y-3">
                {activePromises.map((promise) => (
                  <div key={promise.id} className="p-3 bg-yellow-50/50 rounded-lg border border-yellow-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{promise.customer.name}</span>
                      <span className="text-sm font-semibold text-yellow-700">{formatCurrency(promise.amount)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{promise.invoice.invoiceNumber} • Due {formatDate(promise.dueDate)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Recent AI Activity</h3>
            <div className="space-y-3">
              {allActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] mt-0.5 flex-shrink-0">
                    {log.action.includes('analysis') || log.action === 'analyze' ? '🤖' :
                     log.action.includes('message') || log.action.includes('reminder') ? '📧' :
                     log.action.includes('escalat') ? '🚨' :
                     log.action.includes('promise') ? '🤝' :
                     log.action.includes('payment') ? '💳' :
                     log.action.includes('follow') ? '🔔' : '📋'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-900">
                      <span className="font-medium">{log.actor}</span> • {formatRecoveryStatus(log.action)}
                      {log.invoiceNumber && (
                        <Link href={`/invoices/${log.invoiceId}`} className="text-blue-600 hover:text-blue-700 ml-1">
                          {log.invoiceNumber}
                        </Link>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500">{formatRelativeTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
