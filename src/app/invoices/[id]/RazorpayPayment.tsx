'use client';

import { useState } from 'react';
import {
  createPaymentAction,
  confirmPaymentSuccessAction,
} from './actions';

interface ExistingPayment {
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
}

interface RazorpayPaymentProps {
  invoiceId: string;
  invoiceAmount: number;
  invoiceNumber: string;
  isDemo?: boolean;
  existingPayment?: ExistingPayment | null;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

declare global {
  interface Window {
    Razorpay: new (
      options: RazorpayCheckoutOptions
    ) => {
      open: () => void;
    };
  }
}

export default function RazorpayPayment({
  invoiceId,
  invoiceAmount,
  invoiceNumber,
  existingPayment,
}: RazorpayPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }

      const script = document.createElement('script');

      script.src =
        'https://checkout.razorpay.com/v1/checkout.js';

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (loading) return;

    setLoading(true);
    setError('');
    setStatus('');

    try {
      /*
       * Load Razorpay Checkout.js
       */
      setStatus('Loading secure payment...');

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          'Unable to load Razorpay Checkout. Please check your internet connection.'
        );
      }

      /*
       * Create the Razorpay Order on the server.
       *
       * The server creates the order using the invoice amount
       * and returns the official Razorpay Order ID.
       */
      setStatus('Creating secure payment...');

      const result = await createPaymentAction(invoiceId);

      if (!result.success) {
        throw new Error(
          result.message || 'Unable to create payment.'
        );
      }

      /*
       * This component is specifically for Razorpay Test Mode.
       * If no Razorpay key was returned, configuration is missing.
       */
      if (!result.razorpayKeyId) {
        throw new Error(
          'Razorpay Test Mode is not configured on the server.'
        );
      }

      if (!result.orderId) {
        throw new Error(
          'Razorpay order was not created.'
        );
      }

      /*
       * Use the amount returned by the server.
       *
       * Razorpay expects the amount in paise.
       */
      const checkoutAmount =
        typeof result.amount === 'number'
          ? Math.round(result.amount)
          : Math.round(invoiceAmount * 100);

      const checkoutCurrency =
        result.currency || 'INR';

      /*
       * Open Razorpay Checkout.
       */
      setStatus('Opening Razorpay Checkout...');

      const options: RazorpayCheckoutOptions = {
        key: result.razorpayKeyId,

        amount: checkoutAmount,

        currency: checkoutCurrency,

        name: 'PayPromise AI',

        description: `Payment for ${invoiceNumber}`,

        order_id: result.orderId,

        handler: async (response) => {
          try {
            setLoading(true);
            setError('');
            setStatus(
              'Payment received. Verifying securely...'
            );

            /*
             * Razorpay returns:
             *
             * razorpay_payment_id
             * razorpay_order_id
             * razorpay_signature
             *
             * Send all three to the server.
             *
             * The server is responsible for verifying
             * the Razorpay signature before changing the
             * invoice status to PAID.
             */
            const confirmation =
              await confirmPaymentSuccessAction(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature
              );

            if (!confirmation.success) {
              throw new Error(
                confirmation.message ||
                  'Payment verification failed.'
              );
            }

            setStatus(
              'Payment successful! Invoice marked as paid.'
            );

            /*
             * Refresh the page so the updated payment
             * and invoice status are displayed.
             */
            window.location.reload();
          } catch (err) {
            console.error(
              'Payment verification error:',
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : 'Payment verification failed.'
            );

            setStatus('');
          } finally {
            setLoading(false);
          }
        },

        notes: {
          invoiceNumber,
          invoiceId,
        },

        theme: {
          color: '#3399cc',
        },

        modal: {
          ondismiss: () => {
            setLoading(false);
            setStatus('');
          },
        },
      };

      const razorpay =
        new window.Razorpay(options);

      razorpay.open();
    } catch (err) {
      console.error(
        'Razorpay payment error:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to start payment.'
      );

      setStatus('');
      setLoading(false);
    }
  };

  /*
   * If the invoice already has a successful payment,
   * don't show the payment button again.
   */
  if (existingPayment?.status === 'paid') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-xl">
            ✓
          </div>

          <div>
            <p className="font-semibold text-green-800">
              Payment Received
            </p>

            <p className="text-sm text-green-700">
              This invoice has already been paid.
            </p>
          </div>
        </div>

        {existingPayment.razorpayPaymentId && (
          <p className="mt-3 text-xs text-green-700">
            Razorpay Payment ID:{' '}
            <span className="font-mono">
              {existingPayment.razorpayPaymentId}
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">💳</span>

          <h3 className="font-semibold text-gray-900">
            Razorpay Test Payment
          </h3>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          Secure payment through Razorpay Test Mode.
          No real money will be charged.
        </p>
      </div>

      <div className="mb-4 rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Amount
          </span>

          <span className="text-xl font-bold text-gray-900">
            ₹{invoiceAmount.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Invoice
          </span>

          <span className="text-sm font-medium text-gray-800">
            {invoiceNumber}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {status && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {status}
        </div>
      )}

      <button
        type="button"
        onClick={handlePayment}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? 'Processing...'
          : `Pay ₹${invoiceAmount.toLocaleString(
              'en-IN'
            )}`}
      </button>

      <p className="mt-3 text-center text-xs text-gray-500">
        Razorpay Test Mode • No real money involved
      </p>
    </div>
  );
}