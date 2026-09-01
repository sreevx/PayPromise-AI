'use client';

import { useState, useEffect } from 'react';
import { createPaymentAction, completeDemoPaymentAction, syncPaymentStatus } from './actions';

interface RazorpayPaymentProps {
  invoiceId: string;
  invoiceAmount: number;
  invoiceNumber: string;
  isDemo: boolean;
  existingPayment?: {
    id: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    paymentLinkId: string | null;
    paymentLinkUrl: string | null;
    amount: number;
    status: string;
    method: string | null;
    isDemo: boolean;
    createdAt: string;
  } | null;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function RazorpayPayment({
  invoiceId,
  invoiceAmount,
  invoiceNumber,
  isDemo,
  existingPayment,
}: RazorpayPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    orderId?: string;
    razorpayKeyId?: string;
    paymentId?: string;
    demo?: boolean;
    paymentLinkUrl?: string;
  } | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Razorpay checkout script
  useEffect(() => {
    if (isDemo) return;
    if (typeof window !== 'undefined' && window.Razorpay) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error('Failed to load Razorpay checkout script');
    document.body.appendChild(script);
  }, [isDemo]);

  const handleCreatePayment = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await createPaymentAction(invoiceId);
      setResult({ success: res.success, message: res.message });
      if (res.success && res.details) {
        setPaymentData({
          orderId: res.details.orderId as string,
          razorpayKeyId: res.details.razorpayKeyId as string,
          paymentId: res.details.paymentId as string,
          demo: res.details.demo as boolean,
        });
      }
    } catch (err) {
      setResult({ success: false, message: 'An error occurred.' });
    }
    setLoading(false);
  };

  const handleRazorpayCheckout = () => {
    if (!paymentData?.orderId || !paymentData?.razorpayKeyId) return;

    const options = {
      key: paymentData.razorpayKeyId,
      amount: invoiceAmount * 100, // paise
      currency: 'INR',
      name: 'PayPromise AI',
      description: `Payment for Invoice ${invoiceNumber}`,
      order_id: paymentData.orderId,
      handler: async function (response: any) {
        setResult({
          success: true,
          message: `Payment successful! Razorpay Payment ID: ${response.razorpay_payment_id}. Verifying...`,
        });
      },
      prefill: {
        name: 'Demo Customer',
        email: 'demo@paypromise.ai',
        contact: '9876543210',
      },
      notes: {
        invoice: invoiceNumber,
      },
      theme: {
        color: '#338dff',
      },
      modal: {
        ondismiss: function () {
          setResult({ success: false, message: 'Payment cancelled by user.' });
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setResult({ success: false, message: 'Failed to open Razorpay checkout. Ensure the Razorpay script is loaded.' });
    }
  };

  const handleDemoComplete = async () => {
    if (!paymentData?.paymentId) return;
    setLoading(true);
    try {
      const res = await completeDemoPaymentAction(paymentData.paymentId);
      setResult({ success: res.success, message: res.message });
    } catch (err) {
      setResult({ success: false, message: 'An error occurred.' });
    }
    setLoading(false);
  };

  const handleSyncPayment = async () => {
    if (!existingPayment) return;
    setSyncing(true);
    try {
      const res = await syncPaymentStatus(existingPayment.id);
      setResult({ success: res.success, message: res.message });
      if (res.success) {
        window.location.reload();
      }
    } catch (err) {
      setResult({ success: false, message: 'Sync failed.' });
    }
    setSyncing(false);
  };

  // ── Show existing payment status ─────────────────────────
  if (existingPayment) {
    const isReal = !existingPayment.isDemo;
    const statusColor = existingPayment.status === 'paid' ? 'badge-success'
      : existingPayment.status === 'failed' ? 'badge-danger'
      : existingPayment.status === 'active' || existingPayment.status === 'created' ? 'badge-info'
      : 'badge-warning';

    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">💳 Payment Status</h3>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            isReal ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {isReal ? '🟢 Razorpay Test Mode' : '🟡 DEMO SIMULATION'}
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <span className={`badge ${statusColor}`}>{existingPayment.status.toUpperCase()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Amount</span>
            <span className="text-sm font-semibold text-gray-900">₹{existingPayment.amount.toLocaleString('en-IN')}</span>
          </div>
          {existingPayment.paymentLinkUrl && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Payment Link</span>
              <a
                href={existingPayment.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Open Link ↗
              </a>
            </div>
          )}
          {existingPayment.paymentLinkId && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Link ID</span>
              <span className="text-xs font-mono text-gray-600">{existingPayment.paymentLinkId}</span>
            </div>
          )}
          {existingPayment.razorpayOrderId && !existingPayment.paymentLinkId && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Order ID</span>
              <span className="text-xs font-mono text-gray-600">{existingPayment.razorpayOrderId}</span>
            </div>
          )}
          {existingPayment.razorpayPaymentId && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Payment ID</span>
              <span className="text-xs font-mono text-gray-600">{existingPayment.razorpayPaymentId}</span>
            </div>
          )}
          {existingPayment.method && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Method</span>
              <span className="text-xs font-medium text-gray-700 uppercase">{existingPayment.method}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Created</span>
            <span className="text-xs text-gray-600">{new Date(existingPayment.createdAt).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Real payment sync button */}
        {!existingPayment.isDemo && (existingPayment.status === 'active' || existingPayment.status === 'created') && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
              <p className="text-xs text-green-700">
                ✅ <strong>RAZORPAY TEST MODE</strong> — Real payment link created. Customer should pay via the link.
              </p>
            </div>
            <button
              onClick={handleSyncPayment}
              disabled={syncing}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? 'Syncing with Razorpay...' : '🔄 Sync Payment Status'}
            </button>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Click after customer completes payment to verify and recover invoice
            </p>
          </div>
        )}

        {/* Demo-specific actions */}
        {existingPayment.isDemo && existingPayment.status === 'active' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-3">
              <p className="text-xs text-yellow-700">
                ⚠️ <strong>DEMO SIMULATION</strong> — Razorpay Test Mode is not configured. This is not a real payment link.
              </p>
            </div>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await completeDemoPaymentAction(existingPayment.id);
                  setResult({ success: res.success, message: res.message });
                } catch (err) {
                  setResult({ success: false, message: 'An error occurred.' });
                }
                setLoading(false);
              }}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : '✅ Simulate Successful Payment'}
            </button>
          </div>
        )}

        {result && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            result.success ? 'bg-green-50 text-green-800 border border-green-200' :
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {result.success ? '✅' : '❌'} {result.message}
          </div>
        )}
      </div>
    );
  }

  // ── Create new payment ────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {isDemo ? '💳 Demo Payment' : '💳 Razorpay Test Mode'}
        </h3>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          isDemo ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
        }`}>
          {isDemo ? '🟡 DEMO SIMULATION' : '🟢 TEST MODE'}
        </span>
      </div>

      {result && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          result.success ? 'bg-green-50 text-green-800 border border-green-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {result.success ? '✅' : '❌'} {result.message}
        </div>
      )}

      {!paymentData ? (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            Create a {isDemo ? 'simulated' : 'Razorpay Test Mode'} payment link for ₹{invoiceAmount.toLocaleString('en-IN')}.
          </p>
          <button
            onClick={handleCreatePayment}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : isDemo ? 'Create Demo Payment' : 'Create Razorpay Payment Link'}
          </button>
        </div>
      ) : paymentData.demo ? (
        <div>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-3">
            <p className="text-xs text-yellow-700">
              ⚠️ <strong>DEMO SIMULATION</strong> — Razorpay Test Mode is not configured.
              No real payment link has been created. Set <code className="bg-yellow-100 px-1 rounded">RAZORPAY_KEY_ID</code> and{' '}
              <code className="bg-yellow-100 px-1 rounded">RAZORPAY_KEY_SECRET</code> for real Razorpay integration.
            </p>
          </div>
          <button
            onClick={handleDemoComplete}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : '✅ Simulate Successful Payment'}
          </button>
        </div>
      ) : (
        <div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
            <p className="text-xs text-green-700">
              ✅ Real Razorpay Test Mode payment link created. Customer can pay using the checkout below.
            </p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Order: <code className="text-gray-700">{paymentData.orderId}</code>
          </p>
          <button
            onClick={handleRazorpayCheckout}
            disabled={!scriptLoaded}
            className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {!scriptLoaded ? 'Loading Razorpay...' : 'Open Razorpay Test Checkout'}
          </button>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Test card: 4111 1111 1111 1111, CVV: 123, Expiry: Any future date
          </p>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3 text-center">
        {isDemo
          ? 'All payments are simulated — no real money is involved'
          : 'All payments are in Razorpay Test Mode — no real money is involved'}
      </p>
    </div>
  );
}
