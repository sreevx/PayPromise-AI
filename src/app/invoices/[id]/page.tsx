// PayPromise AI - Invoice Details Page

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import RazorpayPayment from './RazorpayPayment';

type PageProps = {
  params: {
    id: string;
  };
};

export default async function InvoicePage({
  params,
}: PageProps) {
  const invoice = await prisma.invoice.findUnique({
    where: {
      id: params.id,
    },

    include: {
      customer: true,

      payments: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  const existingPayment =
    invoice.payments?.[0] ?? null;

  const amount =
    Number(invoice.amount ?? 0);

  const recoveryProbability =
    Number(
      (invoice as any).recoveryProbability ?? 0
    );

  const recoveryScore =
    Number(
      (invoice as any).recoveryScore ?? 0
    );

  const status =
    String(invoice.status ?? 'unknown');

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <Link
              href="/invoices"
              className="text-sm text-slate-400 hover:text-white"
            >
              ← Back to Invoices
            </Link>

            <h1 className="mt-2 text-2xl font-bold">
              Invoice Details
            </h1>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
            {invoice.invoiceNumber}
          </div>

        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Invoice + Payment */}
        <section className="grid gap-6 lg:grid-cols-3">

          {/* Invoice */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-6">

            <div className="flex flex-col justify-between gap-6 sm:flex-row">

              <div>
                <p className="text-sm text-slate-400">
                  Invoice
                </p>

                <h2 className="mt-1 text-3xl font-bold">
                  {invoice.invoiceNumber}
                </h2>

                <p className="mt-2 text-slate-400">
                  {invoice.customer?.name ??
                    'Unknown Customer'}
                </p>

                {invoice.customer?.email && (
                  <p className="mt-1 text-sm text-slate-500">
                    {invoice.customer.email}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right">

                <p className="text-sm text-slate-400">
                  Invoice Amount
                </p>

                <p className="mt-1 text-3xl font-bold">
                  ₹{amount.toLocaleString('en-IN')}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {invoice.currency ?? 'INR'}
                </p>

              </div>

            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">

              {/* Status */}
              <div className="rounded-xl bg-white/5 p-4">

                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </p>

                <p className="mt-2 font-semibold capitalize">
                  {status.replaceAll('_', ' ')}
                </p>

              </div>

              {/* Due Date */}
              <div className="rounded-xl bg-white/5 p-4">

                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Due Date
                </p>

                <p className="mt-2 font-semibold">
                  {invoice.dueAt
                    ? new Date(
                        invoice.dueAt
                      ).toLocaleDateString(
                        'en-IN'
                      )
                    : '—'}
                </p>

              </div>

              {/* Recovery Score */}
              <div className="rounded-xl bg-white/5 p-4">

                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Recovery Score
                </p>

                <p className="mt-2 font-semibold">
                  {recoveryScore > 0
                    ? recoveryScore
                    : `${(
                        recoveryProbability * 100
                      ).toFixed(0)}%`}
                </p>

              </div>

            </div>
          </div>

          {/* Razorpay Payment */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">

            <h2 className="text-lg font-semibold">
              Payment
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Secure payment through Razorpay
            </p>

            <div className="mt-6">

             <RazorpayPayment
  invoiceId={invoice.id}
  invoiceAmount={amount}
  invoiceNumber={invoice.invoiceNumber}
  existingPayment={
    existingPayment
      ? {
          ...existingPayment,
          createdAt:
            existingPayment.createdAt.toISOString(),
        }
      : null
  }
/>
            </div>

          </div>

        </section>

        {/* Customer */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">

          <h2 className="text-lg font-semibold">
            Customer
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">

            <div>
              <p className="text-xs text-slate-500">
                Name
              </p>

              <p className="mt-1 font-medium">
                {invoice.customer?.name ?? '—'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Email
              </p>

              <p className="mt-1 font-medium">
                {invoice.customer?.email ?? '—'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Phone
              </p>

              <p className="mt-1 font-medium">
                {invoice.customer?.phone ?? '—'}
              </p>
            </div>

          </div>
        </section>

        {/* AI Recovery Analysis */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold">
                AI Recovery Analysis
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                PayPromise AI recovery intelligence
              </p>
            </div>

            <div className="rounded-full bg-white/10 px-4 py-2 text-sm">

              {recoveryProbability > 0
                ? `${(
                    recoveryProbability * 100
                  ).toFixed(0)}% probability`
                : 'Analysis available'}

            </div>

          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">

            {/* Recovery Probability */}
            <div className="rounded-xl bg-white/5 p-4">

              <p className="text-xs uppercase tracking-wide text-slate-500">
                Recovery Probability
              </p>

              <p className="mt-2 text-2xl font-bold">
                {(
                  recoveryProbability * 100
                ).toFixed(0)}
                %
              </p>

            </div>

            {/* Recovery Score */}
            <div className="rounded-xl bg-white/5 p-4">

              <p className="text-xs uppercase tracking-wide text-slate-500">
                Recovery Score
              </p>

              <p className="mt-2 text-2xl font-bold">
                {recoveryScore || '—'}
              </p>

            </div>

            {/* Current Status */}
            <div className="rounded-xl bg-white/5 p-4">

              <p className="text-xs uppercase tracking-wide text-slate-500">
                Current Status
              </p>

              <p className="mt-2 text-lg font-semibold capitalize">
                {status.replaceAll('_', ' ')}
              </p>

            </div>

          </div>

        </section>

        {/* Latest Payment */}
        {existingPayment && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">

            <h2 className="text-lg font-semibold">
              Latest Payment
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">

              {/* Payment ID */}
              <div>

                <p className="text-xs text-slate-500">
                  Payment ID
                </p>

                <p className="mt-1 break-all text-sm">
                  {existingPayment.id}
                </p>

              </div>

              {/* Payment Status */}
              <div>

                <p className="text-xs text-slate-500">
                  Status
                </p>

                <p className="mt-1 font-semibold capitalize">
                  {String(
                    existingPayment.status
                  ).replaceAll('_', ' ')}
                </p>

              </div>

              {/* Created */}
              <div>

                <p className="text-xs text-slate-500">
                  Created
                </p>

                <p className="mt-1 font-semibold">
                  {existingPayment.createdAt
                    ? new Date(
                        existingPayment.createdAt
                      ).toLocaleString(
                        'en-IN'
                      )
                    : '—'}
                </p>

              </div>

            </div>

          </section>
        )}

      </div>
    </main>
  );
}