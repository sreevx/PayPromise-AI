'use client';

import { useState } from 'react';
import { triggerRecoveryAction, createPromiseToPay, markPromiseFulfilled } from './actions';

interface RecoveryActionsProps {
  invoiceId: string;
  invoiceStatus: string;
  isActionable: boolean;
  escalationLevel: number;
  activePromises: number;
  invoiceAmount: number;
}

export function RecoveryActions({
  invoiceId,
  invoiceStatus,
  isActionable,
  escalationLevel,
  activePromises,
  invoiceAmount,
}: RecoveryActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPromiseForm, setShowPromiseForm] = useState(false);
  const [promiseAmount, setPromiseAmount] = useState(invoiceAmount);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseNotes, setPromiseNotes] = useState('');

  const handleAction = async (action: string) => {
    setLoading(action);
    setResult(null);
    try {
      const res = await triggerRecoveryAction(invoiceId);
      setResult({ success: res.success, message: res.message });
    } catch (err) {
      setResult({ success: false, message: 'An error occurred.' });
    }
    setLoading(null);
  };

  const handlePromiseSubmit = async () => {
    if (!promiseDate) {
      setResult({ success: false, message: 'Please select a date.' });
      return;
    }
    setLoading('promise');
    setResult(null);
    try {
      const res = await createPromiseToPay(invoiceId, promiseAmount, promiseDate, promiseNotes);
      setResult({ success: res.success, message: res.message });
      if (res.success) {
        setShowPromiseForm(false);
        setPromiseNotes('');
      }
    } catch (err) {
      setResult({ success: false, message: 'An error occurred.' });
    }
    setLoading(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Recovery Actions</h3>

      {/* Result Banner */}
      {result && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          result.success ? 'bg-green-50 text-green-800 border border-green-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {result.success ? '✅' : '❌'} {result.message}
        </div>
      )}

      {!isActionable ? (
        <p className="text-sm text-gray-500 mb-4">
          {invoiceStatus === 'paid' ? 'This invoice is already paid.' :
           invoiceStatus === 'pending' ? 'This invoice is not yet overdue.' :
           'No recovery action needed.'}
        </p>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => handleAction('SEND_REMINDER')}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 border border-gray-100 text-left disabled:opacity-50"
          >
            <span className="text-sm">📧</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Send Reminder</p>
              <p className="text-xs text-gray-500">AI-generated payment reminder</p>
            </div>
            {loading === 'SEND_REMINDER' && <span className="text-xs text-blue-600">Running...</span>}
          </button>

          <button
            onClick={() => handleAction('REQUEST_PROMISE')}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 border border-gray-100 text-left disabled:opacity-50"
          >
            <span className="text-sm">🤝</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Request Promise</p>
              <p className="text-xs text-gray-500">Ask customer for a payment commitment</p>
            </div>
            {loading === 'REQUEST_PROMISE' && <span className="text-xs text-green-600">Running...</span>}
          </button>

          <button
            onClick={() => handleAction('CREATE_PAYMENT_LINK')}
            disabled={loading !== null}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-yellow-50 border border-gray-100 text-left disabled:opacity-50"
          >
            <span className="text-sm">💳</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Create Payment Link</p>
              <p className="text-xs text-gray-500">Generate Razorpay test payment link</p>
            </div>
            {loading === 'CREATE_PAYMENT_LINK' && <span className="text-xs text-yellow-600">Running...</span>}
          </button>

          <button
            onClick={() => setShowPromiseForm(!showPromiseForm)}
            disabled={loading !== null || activePromises > 0}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 border border-gray-100 text-left disabled:opacity-50"
          >
            <span className="text-sm">📝</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Record Promise to Pay</p>
              <p className="text-xs text-gray-500">
                {activePromises > 0 ? 'Active promise already exists' : 'Log a payment commitment'}
              </p>
            </div>
          </button>

          <button
            onClick={() => handleAction('ESCALATE')}
            disabled={loading !== null || escalationLevel >= 3}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 border border-gray-100 text-left disabled:opacity-50"
          >
            <span className="text-sm">🚨</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Escalate to Human</p>
              <p className="text-xs text-gray-500">
                {escalationLevel >= 3 ? 'Maximum escalation reached' : 'Escalate to collections team'}
              </p>
            </div>
            {loading === 'ESCALATE' && <span className="text-xs text-red-600">Running...</span>}
          </button>
        </div>
      )}

      {/* Promise-to-Pay Form */}
      {showPromiseForm && (
        <div className="mt-4 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Promise to Pay</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Amount (₹)</label>
              <input
                type="number"
                value={promiseAmount}
                onChange={(e) => setPromiseAmount(Number(e.target.value))}
                max={invoiceAmount}
                min={1}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <p className="text-[10px] text-gray-500 mt-0.5">Max: ₹{invoiceAmount.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Promise Date</label>
              <input
                type="date"
                value={promiseDate}
                onChange={(e) => setPromiseDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Notes (optional)</label>
              <textarea
                value={promiseNotes}
                onChange={(e) => setPromiseNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="e.g., Customer prefers NEFT transfer"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePromiseSubmit}
                disabled={loading === 'promise'}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {loading === 'promise' ? 'Creating...' : 'Create Promise'}
              </button>
              <button
                onClick={() => setShowPromiseForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3 text-center">
        Actions pass through the policy engine before execution
      </p>
    </div>
  );
}
