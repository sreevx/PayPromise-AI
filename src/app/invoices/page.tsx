import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { InvoiceFilters } from './InvoiceFilters';

export const dynamic = 'force-dynamic';

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusStyles(status: string) {
  const n = status.toLowerCase();
  if (n === 'paid' || n === 'recovered' || n === 'captured') return 'bg-green-100 text-green-800';
  if (n === 'overdue' || n === 'failed' || n === 'cancelled') return 'bg-red-100 text-red-800';
  return 'bg-yellow-100 text-yellow-800';
}

function getRiskBadge(prob: number) {
  if (prob >= 0.5) return { label: 'Low', cls: 'bg-green-100 text-green-700' };
  if (prob >= 0.3) return { label: 'Medium', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'High', cls: 'bg-red-100 text-red-700' };
}

type PageProps = {
  searchParams: { q?: string; status?: string; risk?: string; sort?: string };
};

export default async function InvoicesPage({ searchParams }: PageProps) {
  const q = searchParams.q || '';
  const statusFilter = searchParams.status || 'all';
  const riskFilter = searchParams.risk || 'all';
  const sortBy = searchParams.sort || 'newest';

  const invoices = await prisma.invoice.findMany({
    include: {
      customer: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: sortBy === 'oldest' ? { createdAt: 'asc' }
      : sortBy === 'amount-desc' ? { amount: 'desc' }
      : sortBy === 'amount-asc' ? { amount: 'asc' }
      : sortBy === 'overdue' ? { dueAt: 'asc' }
      : { createdAt: 'desc' },
  });

  const filtered = invoices.filter((inv) => {
    if (q) {
      const query = q.toLowerCase();
      const mi = inv.invoiceNumber.toLowerCase().includes(query);
      const mc = inv.customer?.name?.toLowerCase().includes(query) ?? false;
      const co = inv.customer?.company?.toLowerCase().includes(query) ?? false;
      if (!mi && !mc && !co) return false;
    }
    if (statusFilter !== 'all') {
      const isPaid = inv.status === 'paid' || inv.recoveryStatus === 'recovered';
      const isOverdue = !isPaid && new Date(inv.dueAt) < new Date();
      if (statusFilter === 'paid' && !isPaid) return false;
      if (statusFilter === 'overdue' && !isOverdue) return false;
      if (statusFilter === 'pending' && (isPaid || isOverdue)) return false;
      if (statusFilter === 'escalated' && inv.escalationLevel < 1) return false;
    }
    if (riskFilter !== 'all') {
      const prob = inv.recoveryProbability ?? 0;
      if (riskFilter === 'high' && prob >= 0.3) return false;
      if (riskFilter === 'medium' && (prob < 0.3 || prob >= 0.5)) return false;
      if (riskFilter === 'low' && prob < 0.5) return false;
    }
    return true;
  });

  const totalInvoices = invoices.length;
  const overdueCount = invoices.filter(i => {
    const isPaid = i.status === 'paid' || i.recoveryStatus === 'recovered';
    return !isPaid && new Date(i.dueAt) < new Date();
  }).length;
  const paidCount = invoices.filter(i => i.status === 'paid' || i.recoveryStatus === 'recovered').length;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm font-medium text-blue-600">PayPromise AI</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mt-1">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">All Invoices</h1>
              <p className="mt-1 text-gray-500">Search, filter and manage every invoice in your receivables.</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">{filtered.length} of {totalInvoices} shown</span>
              <span className="text-gray-300">|</span>
              <span className="text-red-600 font-medium">{overdueCount} overdue</span>
              <span className="text-green-600 font-medium">{paidCount} paid</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <InvoiceFilters
          currentQuery={q}
          currentStatus={statusFilter}
          currentRisk={riskFilter}
          currentSort={sortBy}
        />

        {/* Invoice Table */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-medium text-gray-900">No invoices match your filters</p>
              <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Invoice</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Customer</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Due Date</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recovery</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">Risk</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">Action</th>
                    <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.map((invoice) => {
                    const payment = invoice.payments[0];
                    const isPaid = invoice.status === 'paid' || invoice.recoveryStatus === 'recovered' || payment?.status === 'paid' || payment?.status === 'captured';
                    const dueDate = new Date(invoice.dueAt);
                    const isOverdue = !isPaid && dueDate < new Date();
                    const displayStatus = isPaid ? 'Paid' : isOverdue ? 'Overdue' : invoice.status || 'Pending';
                    const prob = invoice.recoveryProbability ?? 0;
                    const probPct = Math.round(prob * 100);
                    const risk = getRiskBadge(prob);
                    const action = invoice.recommendedAction?.split(':')[0]?.replace(/_/g, ' ') ?? '—';
                    const daysOverdue = isOverdue ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000)) : 0;

                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50/60 transition">
                        <td className="px-5 py-3.5">
                          <Link href={`/invoices/${invoice.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                            {invoice.invoiceNumber}
                          </Link>
                          <p className="text-[11px] text-gray-400 truncate max-w-[160px] mt-0.5">{invoice.description}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-gray-900">{invoice.customer?.name ?? '—'}</p>
                          <p className="text-[11px] text-gray-400">{invoice.customer?.company}</p>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(Number(invoice.amount))}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm text-gray-600">{formatDate(invoice.dueAt)}</span>
                          {isOverdue && <p className="text-[11px] text-red-500 font-medium">{daysOverdue}d overdue</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-1.5 w-14 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, probPct)}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{probPct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${risk.cls}`}>
                            {risk.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                            {action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusStyles(displayStatus)}`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link href={`/invoices/${invoice.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
