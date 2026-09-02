import Link from 'next/link';
import { prisma } from '@/lib/prisma';

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
  const normalized = status.toLowerCase();

  if (
    normalized === 'paid' ||
    normalized === 'recovered' ||
    normalized === 'captured'
  ) {
    return 'bg-green-100 text-green-800';
  }

  if (
    normalized === 'overdue' ||
    normalized === 'failed' ||
    normalized === 'cancelled'
  ) {
    return 'bg-red-100 text-red-800';
  }

  return 'bg-yellow-100 text-yellow-800';
}

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: true,

      payments: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },

    orderBy: {
      createdAt: 'desc',
    },
  });

  const totalInvoices = invoices.length;

  const totalAmount = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount),
    0
  );

  /*
   * Determine paid invoices
   */
  const paidInvoices = invoices.filter((invoice) => {
    const payment = invoice.payments[0];

    return (
      invoice.recoveryStatus === 'paid' ||
      invoice.status === 'paid' ||
      payment?.status === 'paid' ||
      payment?.status === 'captured'
    );
  });

  const paidAmount = paidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount),
    0
  );

  /*
   * Determine overdue invoices
   */
  const overdueInvoices = invoices.filter((invoice) => {
    const payment = invoice.payments[0];

    const isPaid =
      invoice.recoveryStatus === 'paid' ||
      invoice.status === 'paid' ||
      payment?.status === 'paid' ||
      payment?.status === 'captured';

    return !isPaid && new Date(invoice.dueAt) < new Date();
  });

  const overdueAmount = overdueInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount),
    0
  );

  /*
   * Recovery rate
   */
  const recoveryRate =
    totalAmount > 0
      ? Math.round((paidAmount / totalAmount) * 100)
      : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              PayPromise AI
            </p>

            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              Invoices
            </h1>

            <p className="mt-2 text-gray-600">
              Monitor invoices, payment recovery and customer risk.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total Invoices */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Invoices
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {totalInvoices}
            </p>
          </section>

          {/* Total Value */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Value
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCurrency(totalAmount)}
            </p>
          </section>

          {/* Recovered */}
          <section className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <p className="text-sm text-green-700">
              Recovered
            </p>

            <p className="mt-2 text-2xl font-bold text-green-900">
              {formatCurrency(paidAmount)}
            </p>

            <p className="mt-1 text-xs text-green-700">
              {recoveryRate}% of invoice value
            </p>
          </section>

          {/* Overdue */}
          <section className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm text-red-700">
              Overdue
            </p>

            <p className="mt-2 text-2xl font-bold text-red-900">
              {formatCurrency(overdueAmount)}
            </p>

            <p className="mt-1 text-xs text-red-700">
              {overdueInvoices.length} invoice
              {overdueInvoices.length === 1 ? '' : 's'}
            </p>
          </section>

        </div>

        {/* Invoice Table */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

          {/* Table Header */}
          <div className="border-b border-gray-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-gray-900">
              All Invoices
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select an invoice to view its AI analysis and payment options.
            </p>
          </div>

          {/* Empty State */}
          {invoices.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-gray-900">
                No invoices found
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Invoices will appear here once they are created.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="min-w-full divide-y divide-gray-200">

                {/* Table Head */}
                <thead className="bg-gray-50">
                  <tr>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Invoice
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Customer
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Amount
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Due Date
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Recovery
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>

                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-gray-200 bg-white">

                  {invoices.map((invoice) => {
                    const payment = invoice.payments[0];

                    /*
                     * recoveryAnalyses does not exist as an
                     * Invoice Prisma relation, so recoveryScore
                     * is taken directly from the invoice.
                     */
                    const isPaid =
                      invoice.recoveryStatus === 'paid' ||
                      invoice.status === 'paid' ||
                      payment?.status === 'paid' ||
                      payment?.status === 'captured';

                    const dueDate = new Date(invoice.dueAt);

                    const isOverdue =
                      !isPaid && dueDate < new Date();

                    const status = isPaid
                      ? 'Paid'
                      : isOverdue
                        ? 'Overdue'
                        : invoice.status || 'Pending';

                    /*
                     * Use the invoice recovery score directly.
                     * Fall back to 33 if no score is available.
                     */
                    const recoveryScore =
  invoice.customer?.riskScore != null
    ? Number(invoice.customer.riskScore)
    : 33;

                    return (
                      <tr
                        key={invoice.id}
                        className="transition hover:bg-gray-50"
                      >

                        {/* Invoice */}
                        <td className="whitespace-nowrap px-6 py-4">

                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="font-semibold text-blue-600 hover:text-blue-800"
                          >
                            {invoice.invoiceNumber}
                          </Link>

                          <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                            {invoice.description}
                          </p>

                        </td>

                        {/* Customer */}
                        <td className="whitespace-nowrap px-6 py-4">

                          <p className="font-medium text-gray-900">
                            {invoice.customer?.name ??
                              'Unknown Customer'}
                          </p>

                          {invoice.customer?.email && (
                            <p className="mt-1 text-xs text-gray-500">
                              {invoice.customer.email}
                            </p>
                          )}

                        </td>

                        {/* Amount */}
                        <td className="whitespace-nowrap px-6 py-4">

                          <span className="font-semibold text-gray-900">
                            {formatCurrency(
                              Number(invoice.amount)
                            )}
                          </span>

                        </td>

                        {/* Due Date */}
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {formatDate(invoice.dueAt)}
                        </td>

                        {/* Recovery */}
                        <td className="whitespace-nowrap px-6 py-4">

                          <div className="flex items-center gap-3">

                            <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">

                              <div
                                className="h-full rounded-full bg-blue-600"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      recoveryScore
                                    )
                                  )}%`,
                                }}
                              />

                            </div>

                            <span className="text-sm font-semibold text-gray-700">
                              {Math.round(
                                recoveryScore
                              )}
                              %
                            </span>

                          </div>

                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-6 py-4">

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(
                              status
                            )}`}
                          >
                            {status}
                          </span>

                        </td>

                        {/* Action */}
                        <td className="whitespace-nowrap px-6 py-4 text-right">

                          <Link
                            href={`/invoices/${invoice.id}`}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                          >
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