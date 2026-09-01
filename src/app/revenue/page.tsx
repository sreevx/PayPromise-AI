import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RevenuePage() {
  const metrics = await prisma.revenueMetrics.findFirst();
  const allInvoices = await prisma.invoice.findMany({
    include: { customer: true },
  });

  const overdue = allInvoices.filter(i => i.status === 'overdue');
  const pending = allInvoices.filter(i => i.status === 'pending');
  const paid = allInvoices.filter(i => i.status === 'paid');

  const overdueByAge = {
    '1-7 days': overdue.filter(i => {
      const days = Math.floor((Date.now() - new Date(i.dueAt).getTime()) / (1000 * 60 * 60 * 24));
      return days >= 1 && days <= 7;
    }),
    '8-30 days': overdue.filter(i => {
      const days = Math.floor((Date.now() - new Date(i.dueAt).getTime()) / (1000 * 60 * 60 * 24));
      return days >= 8 && days <= 30;
    }),
    '31-60 days': overdue.filter(i => {
      const days = Math.floor((Date.now() - new Date(i.dueAt).getTime()) / (1000 * 60 * 60 * 24));
      return days >= 31 && days <= 60;
    }),
    '60+ days': overdue.filter(i => {
      const days = Math.floor((Date.now() - new Date(i.dueAt).getTime()) / (1000 * 60 * 60 * 24));
      return days > 60;
    }),
  };

  const recoveryByStatus = {
    'None': overdue.filter(i => i.recoveryStatus === 'none').reduce((s, i) => s + i.amount, 0),
    'AI Analyzing': overdue.filter(i => i.recoveryStatus === 'ai_analyzing').reduce((s, i) => s + i.amount, 0),
    'Message Sent': overdue.filter(i => i.recoveryStatus === 'message_sent').reduce((s, i) => s + i.amount, 0),
    'Follow-up': overdue.filter(i => i.recoveryStatus === 'follow_up').reduce((s, i) => s + i.amount, 0),
    'Promise to Pay': overdue.filter(i => i.recoveryStatus === 'promise_to_pay').reduce((s, i) => s + i.amount, 0),
    'Escalated': overdue.filter(i => i.recoveryStatus === 'escalated').reduce((s, i) => s + i.amount, 0),
    'Payment Initiated': overdue.filter(i => i.recoveryStatus === 'payment_initiated').reduce((s, i) => s + i.amount, 0),
  };

  const totalOverdueAmount = overdue.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Revenue Tracker</h1>
        <p className="text-sm text-gray-500 mt-1">Track revenue at risk and recovery progress</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Revenue (All Invoices)</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics?.totalRevenue ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-medium text-gray-500 mb-1">Revenue at Risk</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(metrics?.revenueAtRisk ?? 0)}</p>
          <p className="text-xs text-red-500 mt-1">{overdue.length} overdue invoices</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-medium text-gray-500 mb-1">Revenue Recovered</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics?.revenueRecovered ?? 0)}</p>
          <p className="text-xs text-green-600 mt-1">{paid.length} invoices recovered</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-medium text-gray-500 mb-1">Recovery Rate</p>
          <p className="text-2xl font-bold text-blue-600">{((metrics?.aiRecoveryRate ?? 0) * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500 mt-1">AI-powered recovery</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue by Age */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue at Risk by Age</h2>
          <div className="space-y-4">
            {Object.entries(overdueByAge).map(([label, invoices]) => {
              const amount = invoices.reduce((s, i) => s + i.amount, 0);
              const pct = totalOverdueAmount > 0 ? (amount / totalOverdueAmount) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(amount)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        label === '60+ days' ? 'bg-red-500' :
                        label === '31-60 days' ? 'bg-orange-500' :
                        label === '8-30 days' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{invoices.length} invoices • {pct.toFixed(0)}% of total</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue by Recovery Stage */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue by Recovery Stage</h2>
          <div className="space-y-3">
            {Object.entries(recoveryByStatus).map(([stage, amount]) => {
              const pct = totalOverdueAmount > 0 ? (amount / totalOverdueAmount) * 100 : 0;
              if (amount === 0) return null;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{stage}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(amount)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue by Customer */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Outstanding by Customer</h2>
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase">Total Outstanding</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Overdue Count</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Risk Score</th>
                  <th className="px-6 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">% of Total Risk</th>
                </tr>
              </thead>
              <tbody>
                {allInvoices
                  .filter(i => i.status === 'overdue')
                  .reduce((acc, inv) => {
                    const existing = acc.find(a => a.customerId === inv.customerId);
                    if (existing) {
                      existing.amount += inv.amount;
                      existing.count += 1;
                    } else {
                      acc.push({
                        customerId: inv.customerId,
                        name: inv.customer.name,
                        company: inv.customer.company,
                        riskScore: inv.customer.riskScore,
                        amount: inv.amount,
                        count: 1,
                      });
                    }
                    return acc;
                  }, [] as Array<{ customerId: string; name: string; company: string; riskScore: number; amount: number; count: number }>)
                  .sort((a, b) => b.amount - a.amount)
                  .map((c) => (
                    <tr key={c.customerId} className="table-row">
                      <td className="px-6 py-3">
                        <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.company}</p>
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-red-600">{formatCurrency(c.amount)}</td>
                      <td className="px-6 py-3 text-center text-sm text-gray-700">{c.count}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`text-sm font-semibold ${
                          c.riskScore > 0.7 ? 'text-red-600' : c.riskScore > 0.4 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {(c.riskScore * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="text-sm font-semibold text-gray-700">
                          {totalOverdueAmount > 0 ? ((c.amount / totalOverdueAmount) * 100).toFixed(0) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
