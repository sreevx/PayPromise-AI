// PayPromise AI - Razorpay Test Mode Client
// Server-only module.
// Never import this file into client components.

import Razorpay from 'razorpay';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || '';

// ─────────────────────────────────────────────────────────────
// Razorpay Client Singleton
// ─────────────────────────────────────────────────────────────

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay | null {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayInstance;
}

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

export function isRazorpayConfigured(): boolean {
  return Boolean(
    RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
  );
}

export function getRazorpayPublicKey(): string {
  return RAZORPAY_KEY_ID;
}

export function getRazorpayStatus(): {
  configured: boolean;
  keyId: string;
  keyIdMasked: string;
  testMode: boolean;
} {
  const configured = isRazorpayConfigured();

  return {
    configured,
    keyId: RAZORPAY_KEY_ID,

    keyIdMasked: configured
      ? `${RAZORPAY_KEY_ID.slice(0, 8)}••••••••${RAZORPAY_KEY_ID.slice(-4)}`
      : 'Not configured',

    testMode: RAZORPAY_KEY_ID.startsWith('rzp_test_'),
  };
}

// ─────────────────────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────────────────────

function getRazorpayAuthHeader(): string {
  return `Basic ${Buffer.from(
    `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`
  ).toString('base64')}`;
}

// ─────────────────────────────────────────────────────────────
// Order Creation
// ─────────────────────────────────────────────────────────────

export interface RazorpayOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export async function createRazorpayOrder(
  params: RazorpayOrderParams
): Promise<RazorpayOrderResult> {
  const client = getRazorpayClient();

  if (!client) {
    throw new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'
    );
  }

  const order = await client.orders.create({
    amount: params.amount,
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes || {},
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    receipt: order.receipt || '',
    status: order.status,
  };
}

// ─────────────────────────────────────────────────────────────
// Individual Payment
// ─────────────────────────────────────────────────────────────

export interface RazorpayPaymentResult {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  createdAt: number;
}

export async function fetchRazorpayPayment(
  paymentId: string
): Promise<RazorpayPaymentResult> {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay is not configured.');
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(
      paymentId
    )}`,
    {
      method: 'GET',
      headers: {
        Authorization: getRazorpayAuthHeader(),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    throw new Error(
      `Failed to fetch payment: ${response.status} ${errorBody}`
    );
  }

  const payment = await response.json();

  return {
    id: payment.id,
    orderId: payment.order_id || '',
    amount: Number(payment.amount || 0),
    currency: payment.currency || 'INR',
    status: payment.status,
    method: payment.method || null,
    createdAt: Number(payment.created_at || 0),
  };
}

// ─────────────────────────────────────────────────────────────
// Webhook Signature Verification
// ─────────────────────────────────────────────────────────────

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secretOverride?: string
): boolean {
  const secret = secretOverride || RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[Razorpay] Webhook secret not configured. Rejecting webhook.'
      );

      return false;
    }

    console.warn(
      '[Razorpay] Webhook secret not configured. Accepting development webhook.'
    );

    return true;
  }

  if (!signature) {
    console.error(
      '[Razorpay] No webhook signature provided.'
    );

    return false;
  }

  const nodeCrypto = require('crypto');

  const expectedSignature = nodeCrypto
    .createHmac(
      'sha256',
      secret
    )
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

// ─────────────────────────────────────────────────────────────
// Amount Helpers
// ─────────────────────────────────────────────────────────────

export function amountToPaise(
  amountInRupees: number
): number {
  return Math.round(amountInRupees * 100);
}

export function paiseToRupees(
  amountInPaise: number
): number {
  return amountInPaise / 100;
}

// ─────────────────────────────────────────────────────────────
// Payment Link Creation
// ─────────────────────────────────────────────────────────────

export interface RazorpayPaymentLinkParams {
  amount: number;
  currency: string;
  description: string;

  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };

  notes?: Record<string, string>;

  expireBy?: number;

  notify?: {
    sms?: boolean;
    email?: boolean;
    whatsapp?: boolean;
  };
}

export interface RazorpayPaymentLinkResult {
  id: string;
  short_url: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  expire_by: number | null;

  // IMPORTANT:
  // Payment Link -> Order -> Payments
  order_id: string | null;

  // Useful for debugging/syncing
  amount_paid?: number;
}

export async function createRazorpayPaymentLink(
  params: RazorpayPaymentLinkParams
): Promise<RazorpayPaymentLinkResult> {
  if (!isRazorpayConfigured()) {
    throw new Error(
      'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.'
    );
  }

  const response = await fetch(
    'https://api.razorpay.com/v1/payment_links',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: getRazorpayAuthHeader(),
      },

      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        description: params.description,

        ...(params.customer
          ? { customer: params.customer }
          : {}),

        notes: params.notes || {},

        ...(params.expireBy
          ? { expire_by: params.expireBy }
          : {}),

        notify: params.notify || {
          sms: false,
          email: true,
          whatsapp: false,
        },
      }),

      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    throw new Error(
      `Failed to create payment link: ${response.status} ${errorBody}`
    );
  }

  const link = await response.json();

  return {
    id: link.id,
    short_url: link.short_url,
    amount: Number(link.amount || 0),
    currency: link.currency || 'INR',
    status: link.status,
    description: link.description || '',
    expire_by: link.expire_by || null,

    // VERY IMPORTANT
    order_id: link.order_id || null,

    amount_paid: Number(link.amount_paid || 0),
  };
}

// ─────────────────────────────────────────────────────────────
// Fetch Payment Link
// ─────────────────────────────────────────────────────────────

export async function fetchRazorpayPaymentLink(
  linkId: string
): Promise<RazorpayPaymentLinkResult> {
  if (!isRazorpayConfigured()) {
    throw new Error(
      'Razorpay is not configured.'
    );
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payment_links/${encodeURIComponent(
      linkId
    )}`,
    {
      method: 'GET',

      headers: {
        Authorization: getRazorpayAuthHeader(),
        'Content-Type': 'application/json',
      },

      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    throw new Error(
      `Failed to fetch payment link: ${response.status} ${errorBody}`
    );
  }

  const link = await response.json();

  console.log('[Razorpay] Payment Link:', {
    id: link.id,
    status: link.status,
    order_id: link.order_id,
    amount: link.amount,
    amount_paid: link.amount_paid,
  });

  return {
    id: link.id,
    short_url: link.short_url,
    amount: Number(link.amount || 0),
    currency: link.currency || 'INR',
    status: link.status,
    description: link.description || '',
    expire_by: link.expire_by || null,

    // CRITICAL
    order_id: link.order_id || null,

    amount_paid: Number(link.amount_paid || 0),
  };
}

// ─────────────────────────────────────────────────────────────
// Fetch Payments for Payment Link
// ─────────────────────────────────────────────────────────────
//
// IMPORTANT:
//
// Razorpay does NOT use:
//
// /v1/payment_links/{linkId}/payments
//
// Instead:
//
// Payment Link
//      ↓
// order_id
//      ↓
// /v1/orders/{order_id}/payments
//
// ─────────────────────────────────────────────────────────────

export interface RazorpayPaymentFromLink {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  created_at: number;
}

export async function fetchPaymentsForLink(
  linkId: string
): Promise<RazorpayPaymentFromLink[]> {
  if (!isRazorpayConfigured()) {
    throw new Error(
      'Razorpay is not configured.'
    );
  }

  // ----------------------------------------------------------
  // STEP 1 — Fetch Payment Link
  // ----------------------------------------------------------

  const link = await fetchRazorpayPaymentLink(
    linkId
  );

  const orderId = link.order_id;

  console.log('[Razorpay] Payment Link → Order:', {
    linkId,
    orderId,
    linkStatus: link.status,
  });

  // ----------------------------------------------------------
  // STEP 2 — If no order ID exists
  // ----------------------------------------------------------

  if (!orderId) {
    console.warn(
      `[Razorpay] Payment Link ${linkId} does not have an order_id.`
    );

    return [];
  }

  // ----------------------------------------------------------
  // STEP 3 — Fetch payments using ORDER endpoint
  // ----------------------------------------------------------

  const response = await fetch(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(
      orderId
    )}/payments`,
    {
      method: 'GET',

      headers: {
        Authorization: getRazorpayAuthHeader(),
        'Content-Type': 'application/json',
      },

      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    throw new Error(
      `Failed to fetch payments for order ${orderId}: ${response.status} ${errorBody}`
    );
  }

  const data = await response.json();

  const items = Array.isArray(data.items)
    ? data.items
    : [];

  console.log(
    `[Razorpay] Found ${items.length} payment(s) for order ${orderId}`
  );

  // ----------------------------------------------------------
  // STEP 4 — Normalize payments
  // ----------------------------------------------------------

  return items.map((p: any) => ({
    id: p.id,

    order_id:
      p.order_id || orderId,

    amount:
      Number(p.amount || 0),

    currency:
      p.currency || 'INR',

    status:
      p.status,

    method:
      p.method || null,

    created_at:
      Number(p.created_at || 0),
  }));
}

// ─────────────────────────────────────────────────────────────
// Fetch Individual Payment By ID
// ─────────────────────────────────────────────────────────────

export async function fetchPaymentById(
  paymentId: string
): Promise<RazorpayPaymentFromLink> {
  if (!isRazorpayConfigured()) {
    throw new Error(
      'Razorpay is not configured.'
    );
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(
      paymentId
    )}`,
    {
      method: 'GET',

      headers: {
        Authorization: getRazorpayAuthHeader(),
        'Content-Type': 'application/json',
      },

      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    throw new Error(
      `Failed to fetch payment: ${response.status} ${errorBody}`
    );
  }

  const payment = await response.json();

  return {
    id: payment.id,

    order_id:
      payment.order_id || '',

    amount:
      Number(payment.amount || 0),

    currency:
      payment.currency || 'INR',

    status:
      payment.status,

    method:
      payment.method || null,

    created_at:
      Number(payment.created_at || 0),
  };
}