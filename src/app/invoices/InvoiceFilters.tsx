'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

interface Props {
  currentQuery: string;
  currentStatus: string;
  currentRisk: string;
  currentSort: string;
}

export function InvoiceFilters({ currentQuery, currentStatus, currentRisk, currentSort }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(currentQuery);

  const applyFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/invoices?${params.toString()}`);
    });
  }, [router, searchParams, startTransition]);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    startTransition(() => {
      router.push(`/invoices?${params.toString()}`);
    });
  }, [query, router, searchParams, startTransition]);

  const clearAll = useCallback(() => {
    setQuery('');
    startTransition(() => {
      router.push('/invoices');
    });
  }, [router, startTransition]);

  const hasFilters = currentQuery || currentStatus !== 'all' || currentRisk !== 'all' || currentSort !== 'newest';

  return (
    <div className="mb-6 space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by invoice number, customer name, or company..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          Search
        </button>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Status:</label>
          <select
            value={currentStatus}
            onChange={(e) => applyFilter('status', e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
          >
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>

        {/* Risk filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Risk:</label>
          <select
            value={currentRisk}
            onChange={(e) => applyFilter('risk', e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Sort:</label>
          <select
            value={currentSort}
            onChange={(e) => applyFilter('sort', e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
            <option value="overdue">Most overdue</option>
          </select>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
