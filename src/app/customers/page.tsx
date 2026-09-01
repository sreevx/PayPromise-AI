import { prisma } from '@/lib/prisma';
import { formatCurrency, getRecoveryProbabilityColor } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    include: {
      invoices: {
        select: { amount: true, status: true },
      },
    },
    orderBy: { totalDue: 'desc' },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-500 mt-1">View customer payment profiles and history</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Customers</p>
          <p className="text-xl font-bold text-gray-900">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">High Risk Customers</p>
          <p className="text-xl font-bold text-red-600">{customers.filter(c => c.riskScore > 0.7).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Outstanding</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(customers.reduce((sum, c) => sum + c.totalDue, 0))}</p>
        </div>
      </div>

      {/* Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => {
          const overdueCount = customer.invoices.filter(i => i.status === 'overdue').length;
          const riskColor = customer.riskScore > 0.7 ? 'text-red-600' : customer.riskScore > 0.4 ? 'text-yellow-600' : 'text-green-600';
          const riskBg = customer.riskScore > 0.7 ? 'bg-red-50' : customer.riskScore > 0.4 ? 'bg-yellow-50' : 'bg-green-50';
          const riskLabel = customer.riskScore > 0.7 ? 'High Risk' : customer.riskScore > 0.4 ? 'Medium Risk' : 'Low Risk';

          return (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="bg-white rounded-xl border border-gray-100 p-5 card-hover block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700">
                    {customer.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
                    <p className="text-xs text-gray-500">{customer.company}</p>
                  </div>
                </div>
                <span className={`badge ${riskBg} ${riskColor}`}>
                  {riskLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Outstanding</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(customer.totalDue)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Total Paid</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(customer.totalPaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Avg Days to Pay</p>
                  <p className="text-sm font-semibold text-gray-700">{customer.avgDaysToPay} days</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Late / Total</p>
                  <p className="text-sm font-semibold text-gray-700">{customer.latePayments}/{customer.paymentCount}</p>
                </div>
              </div>

              {overdueCount > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs font-medium text-red-600">
                    ⚠️ {overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
