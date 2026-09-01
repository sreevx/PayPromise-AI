import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, formatRecoveryStatus } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function FollowUpsPage() {
  // Fetch all data in parallel
  const [activePromises, brokenPromises, fulfilledPromises, escalatedInvoices, recentActions] = await Promise.all([
    prisma.promiseToPay.findMany({
      where: { status: 'active' },
      include: { invoice: true, customer: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.promiseToPay.findMany({
      where: { status: 'broken' },
      include: { invoice: true, customer: true },
      orderBy: { dueDate: 'desc' },
      take: 10,
    }),
    prisma.promiseToPay.findMany({
      where: { status: 'fulfilled' },
      include: { invoice: true, customer: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: {
        escalationLevel: { gte: 1 },
        status: { not: 'paid' },
      },
      include: { customer: true },
      orderBy: { escalationLevel: 'desc' },
    }),
    prisma.aIAction.findMany({
      where: {
        action: { in: ['create_promise', 'fulfill_promise', 'broken_promise', 'cancel_promise', 'escalate', 'auto_escalate'] },
      },
      include: { invoice: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Determine which active promises are due soon, due today, or overdue
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const overduePromises = activePromises.filter(p => new Date(p.dueDate) < today);
  const dueToday = activePromises.filter(p => {
    const d = new Date(p.dueDate);
    return d >= today && d < tomorrow;
  });
  const dueSoon = activePromises.filter(p => {
    const d = new Date(p.dueDate);
    return d >= tomorrow && d <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  // Find invoices needing follow-up (overdue, no recent action)
  const followUpNeeded = await prisma.invoice.findMany({
    where: {
      status: 'overdue',
      recoveryStatus: { in: ['none', 'message_sent', 'follow_up'] },
      followUpCount: { lt: 3 },
    },
    include: { customer: true },
    orderBy: { dueAt: 'asc' },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Follow-ups & Commitments</h1>
        <p className="text-sm text-gray-500 mt-1">Track Promise-to-Pay commitments and manage follow-up actions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <div className="metric-card">
          <p className="text-xs font-medium text-gray-500 mb-1">Active Promises</p>
          <p className="text-2xl font-bold text-blue-600">{activePromises.length}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-medium text-gray-500 mb-1">Overdue Promises</p>
          <p className="text-2xl font-bold text-red-600">{overduePromises.length}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-medium text-gray-500 mb-1">Due Today</p>
          <p className="text-2xl font-bold text-yellow-600">{dueToday.length}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-medium text-gray-500 mb-1">Escalated</p>
          <p className="text-2xl font-bold text-orange-600">{escalatedInvoices.length}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs font-medium text-gray-500 mb-1">Follow-up Needed</p>
          <p className="text-2xl font-bold text-purple-600">{followUpNeeded.length}</p>
        </div>
      </div>

      {/* Overdue Promises */}
      {overduePromises.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-red-800 mb-4">⚠️ Overdue Promises ({overduePromises.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overduePromises.map((p) => {
              const daysOverdue = Math.floor((today.getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={p.id} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🚨</span>
                      <Link href={`/invoices/${p.invoice.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {p.invoice.invoiceNumber}
                      </Link>
                    </div>
                    <span className="text-sm font-bold text-red-700">{formatCurrency(p.amount)}</span>
                  </div>
                  <p className="text-xs text-gray-600">{p.customer.name} • {p.customer.company}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-red-600 font-medium">Was due {daysOverdue}d ago</span>
                    <span className="badge badge-danger text-[10px]">Broken Promise</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Promises */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Active Promises ({activePromises.length})</h2>
        {activePromises.length === 0 ? (
          <p className="text-sm text-gray-500">No active commitments</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activePromises.map((p) => {
              const daysUntilDue = Math.ceil((new Date(p.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isUrgent = daysUntilDue <= 2;
              return (
                <div key={p.id} className={`p-4 rounded-lg border ${
                  isUrgent ? 'bg-orange-50 border-orange-100' : 'bg-yellow-50/50 border-yellow-100'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🤝</span>
                      <Link href={`/invoices/${p.invoice.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {p.invoice.invoiceNumber}
                      </Link>
                    </div>
                    <span className="text-sm font-bold text-yellow-700">{formatCurrency(p.amount)}</span>
                  </div>
                  <p className="text-xs text-gray-600">{p.customer.name} • {p.customer.company}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium ${isUrgent ? 'text-orange-600' : 'text-gray-500'}`}>
                      {daysUntilDue <= 0 ? 'Due today' : `Due in ${daysUntilDue}d`}
                    </span>
                    <span className="text-xs text-gray-400">Promised {formatDate(p.promisedAt)}</span>
                  </div>
                  {p.notes && <p className="text-xs text-gray-600 mt-2 italic">{p.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Escalated Invoices */}
      {escalatedInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Active Escalations</h2>
          <div className="space-y-3">
            {escalatedInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm">🚨</span>
                  <div>
                    <Link href={`/invoices/${inv.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-xs text-gray-500">{inv.customer.name} • {inv.customer.company}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.amount)}</p>
                  <p className="text-xs text-red-600 font-medium">
                    Level {inv.escalationLevel}: {inv.escalationLevel === 1 ? 'AI Review' : inv.escalationLevel === 2 ? 'Human Collections' : 'Legal'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Promise Activity */}
      {recentActions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Promise Activity</h2>
          <div className="space-y-3">
            {recentActions.map((action) => {
              const icons: Record<string, string> = {
                create_promise: '🤝', fulfill_promise: '✅', broken_promise: '💔',
                cancel_promise: '❌', escalate: '🚨', auto_escalate: '⚠️',
              };
              return (
                <div key={action.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm mt-0.5">{icons[action.action] || '📋'}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{action.reason}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {action.invoice && (
                        <Link href={`/invoices/${action.invoice.id}`} className="text-blue-600 hover:text-blue-700">
                          {action.invoice.invoiceNumber}
                        </Link>
                      )}
                      {' • '}{formatDateTime(action.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Follow-up Needed */}
      {followUpNeeded.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Invoices Needing Follow-up</h2>
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Follow-ups</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {followUpNeeded.map((inv) => (
                  <tr key={inv.id} className="table-row">
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${inv.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">{inv.customer.name}</td>
                    <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</td>
                    <td className="px-6 py-3 text-center text-sm text-gray-700">{inv.followUpCount}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`badge ${getStatusColor(inv.recoveryStatus)}`}>
                        {formatRecoveryStatus(inv.recoveryStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
