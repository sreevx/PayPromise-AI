import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate, getStatusColor, formatRecoveryStatus, getRecoveryProbabilityColor } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      invoices: {
        orderBy: { issuedAt: 'desc' },
      },
      commitments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) notFound();

  const riskColor = customer.riskScore > 0.7 ? 'text-red-600 bg-red-50' :
    customer.riskScore > 0.4 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50';
  const riskLabel = customer.riskScore > 0.7 ? 'High Risk' : customer.riskScore > 0.4 ? 'Medium Risk' : 'Low Risk';

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/customers" className="text-sm text-blue-600 hover:text-blue-700">← Back to Customers</Link>
      </div>

      {/* Customer Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center text-lg font-bold text-blue-700">
              {customer.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
              <p className="text-sm text-gray-500">{customer.company}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">📧 {customer.email}</span>
                {customer.phone && <span className="text-xs text-gray-500">📱 {customer.phone}</span>}
              </div>
            </div>
          </div>
          <span className={`badge ${riskColor}`}>{riskLabel} ({(customer.riskScore * 100).toFixed(0)}%)</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Total Paid</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(customer.totalPaid)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Total Due</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(customer.totalDue)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Avg Days to Pay</p>
            <p className="text-lg font-bold text-gray-900">{customer.avgDaysToPay}d</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Payment Count</p>
            <p className="text-lg font-bold text-gray-900">{customer.paymentCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Late Payments</p>
            <p className="text-lg font-bold text-orange-600">{customer.latePayments}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoices */}
        <div className="lg:col-span-2">
          <div className="table-container">
            <div className="px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Invoice History</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Due</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Recovery</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {customer.invoices.map((inv) => (
                  <tr key={inv.id} className="table-row">
                    <td className="px-6 py-3">
                      <Link href={`/invoices/${inv.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{inv.description}</p>
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{formatDate(inv.dueAt)}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`text-xs font-semibold ${getRecoveryProbabilityColor(inv.recoveryProbability ?? 0)}`}>
                        {((inv.recoveryProbability ?? 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`badge ${getStatusColor(inv.status)}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History & Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Customer Info</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-[10px] font-medium text-gray-500 uppercase">GST Number</dt>
                <dd className="text-sm font-mono text-gray-900">{customer.gstNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium text-gray-500 uppercase">Address</dt>
                <dd className="text-sm text-gray-900">{customer.address || '—'}</dd>
              </div>
            </dl>
          </div>

          {customer.commitments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Promise to Pay History</h3>
              <div className="space-y-3">
                {customer.commitments.map((c) => (
                  <div key={c.id} className={`p-3 rounded-lg border ${
                    c.status === 'fulfilled' ? 'bg-green-50 border-green-100' :
                    c.status === 'broken' ? 'bg-red-50 border-red-100' :
                    'bg-yellow-50 border-yellow-100'
                  }`}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(c.amount)}</span>
                      <span className={`badge text-[10px] ${
                        c.status === 'fulfilled' ? 'badge-success' :
                        c.status === 'broken' ? 'badge-danger' : 'badge-warning'
                      }`}>{c.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">Due: {formatDate(c.dueDate)}</p>
                    {c.notes && <p className="text-xs text-gray-600 mt-1">{c.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
