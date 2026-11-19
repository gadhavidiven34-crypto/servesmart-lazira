export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color: string;
  };
  config?: {
    display: {
      blocks: Record<
        string,
        {
          name: string;
          instruments: Array<{
            method: string;
            flows?: string[];
            apps?: string[];
          }>;
        }
      >;
      hide?: Array<{ method: string }>;
      sequence: string[];
      preferences: {
        show_default_blocks: boolean;
      };
    };
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    confirm_close?: boolean;
  };
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
}

export interface RazorpayInstance {
  open: () => void;
  close?: () => void;
  on?: (
    event: 'payment.failed',
    callback: (response: RazorpayFailureResponse) => void
  ) => void;
}

export type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions
) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

export interface CreateOrderApiResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentApiResponse {
  verified: boolean;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  error?: string;
}

export function buildRazorpayCheckoutOptions(params: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  restaurantName: string;
  orderNumber: string;
  tableNumber: number;
  onSuccess: (response: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss?: () => void;
}): RazorpayCheckoutOptions {
  return {
    key: params.keyId,
    amount: params.amountPaise,
    currency: params.currency || 'INR',
    name: params.restaurantName,
    description: `Table ${params.tableNumber} · Order ${params.orderNumber}`,
    order_id: params.orderId,
    prefill: {
      name: `Table ${params.tableNumber} Guest`,
    },
    notes: {
      tableNumber: String(params.tableNumber),
      orderNumber: params.orderNumber,
      restaurant: params.restaurantName,
    },
    theme: {
      color: '#047857',
    },
    config: {
      display: {
        blocks: {
          upi_apps: {
            name: 'Pay via UPI Apps (GPay / PhonePe / Paytm)',
            instruments: [
              {
                method: 'upi',
                flows: ['intent', 'qr', 'collect'],
                apps: ['google_pay', 'phonepe', 'paytm'],
              },
            ],
          },
        },
        hide: [
          { method: 'emi' },
          { method: 'paylater' },
          { method: 'cardless_emi' },
        ],
        sequence: ['block.upi_apps'],
        preferences: {
          show_default_blocks: false,
        },
      },
    },
    modal: {
      ondismiss: params.onDismiss,
      escape: true,
    },
    handler: params.onSuccess,
  };
}

export async function requestRazorpayOrder(
  amountInr: number,
  receipt: string
): Promise<CreateOrderApiResponse> {
  const res = await fetch('/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountInr, receipt }),
  });

  const data = (await res.json().catch(() => null)) as
    | (CreateOrderApiResponse & { error?: string })
    | null;

  if (!res.ok || !data?.orderId || !data?.keyId) {
    throw new Error(
      data?.error || 'Could not initialize Razorpay order. Please check server credentials.'
    );
  }

  return data;
}

export async function verifyRazorpayPayment(
  payload: RazorpaySuccessResponse
): Promise<VerifyPaymentApiResponse> {
  const res = await fetch('/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => null)) as
    | VerifyPaymentApiResponse
    | null;

  if (!res.ok || !data?.verified) {
    throw new Error(
      data?.error || 'Payment signature verification failed. Please contact reception.'
    );
  }

  return data;
}
