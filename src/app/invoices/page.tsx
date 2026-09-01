import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate, getDaysOverdue, getRecoveryProbabilityColor, getStatusColor, formatRecoveryStatus } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const statusFilter = searchParams.status;

  const where = statusFilter && statusFilter !== 'all'
    ? { status: statusFilter }
    : {};

  const invoices = await prisma.invoice.findMany({
    where,
    include: { customer: true },
    orderBy: [
      { status: 'asc' },
      { dueAt: 'asc' },
    ],
  });

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track all invoices for recovery</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Invoices</p>
          <p className="text-xl font-bold text-gray-900">{invoices.length}</p>
          <p className="text-xs text-gray-500">{formatCurrency(totalAmount)} total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Overdue</p>
          <p className="text-xl font-bold text-red-600">{invoices.filter(i => i.status === 'overdue').length}</p>
          <p className="text-xs text-red-500">{formatCurrency(overdueAmount)} at risk</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Pending</p>
          <p className="text-xl font-bold text-yellow-600">{invoices.filter(i => i.status === 'pending').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Recovered</p>
          <p className="text-xl font-bold text-green-600">{invoices.filter(i => i.status === 'paid').length}</p>
          <p className="text-xs text-green-600">{formatCurrency(paidAmount)} recovered</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100/50 rounded-lg p-1 w-fit">
        {[
          { label: 'All', value: 'all' },
          { label: 'Overdue', value: 'overdue' },
          { label: 'Pending', value: 'pending' },
          { label: 'Paid', value: 'paid' },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === 'all' ? '/invoices' : `/invoices?status=${tab.value}`}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              (statusFilter || 'all') === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Invoices Table */}
      <div className="table-container">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Overdue</th>
              <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Recovery</th>
              <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">AI Score</th>
              <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const daysOverdue = getDaysOverdue(invoice.dueAt);
              return (
                <tr key={invoice.id} className="table-row">
                  <td className="px-6 py-4">
                    <Link href={`/invoices/${invoice.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      {invoice.invoiceNumber}
                    </Link>
                    <p className="text-xs text-gray-500 truncate max-w-[220px]">{invoice.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{invoice.customer.name}</p>
                    <p className="text-xs text-gray-500">{invoice.customer.company}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.amount)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{formatDate(invoice.dueAt)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {invoice.status === 'overdue' ? (
                      <span className={`text-sm font-bold ${daysOverdue > 30 ? 'text-red-600' : daysOverdue > 14 ? 'text-orange-500' : 'text-yellow-600'}`}>
                        {daysOverdue}d
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge ${getStatusColor(invoice.status)}`}>
                      {formatRecoveryStatus(invoice.recoveryStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (invoice.recoveryProbability ?? 0) >= 0.6 ? 'bg-green-500' :
                            (invoice.recoveryProbability ?? 0) >= 0.3 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(invoice.recoveryProbability ?? 0) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${getRecoveryProbabilityColor(invoice.recoveryProbability ?? 0)}`}>
                        {((invoice.recoveryProbability ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge ${getStatusColor(invoice.status)}`}>
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No invoices found for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
