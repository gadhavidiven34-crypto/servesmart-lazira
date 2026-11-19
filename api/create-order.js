const RAZORPAY_ORDERS_API_URL = 'https://api.razorpay.com/v1/orders';

export function parseJsonBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export async function createRazorpayOrder(
  { amount, receipt },
  {
    keyId = process.env.RAZORPAY_KEY_ID,
    keySecret = process.env.RAZORPAY_KEY_SECRET,
    fetchImpl = fetch,
  } = {}
) {
  if (!keyId || !keySecret) {
    return {
      status: 500,
      body: {
        error:
          'Razorpay credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured on the server.',
      },
    };
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return {
      status: 400,
      body: { error: 'A valid positive amount in INR is required.' },
    };
  }

  const amountInPaise = Math.round(numericAmount * 100);
  const safeReceipt = String(receipt || `rcpt_${Date.now()}`).slice(0, 40);
  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

  const response = await fetchImpl(RAZORPAY_ORDERS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: safeReceipt,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.id) {
    const razorpayMessage =
      data?.error?.description ||
      data?.error?.reason ||
      'Failed to create Razorpay order.';
    return {
      status: response.status >= 400 ? response.status : 502,
      body: { error: razorpayMessage },
    };
  }

  return {
    status: 200,
    body: {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency || 'INR',
      keyId,
    },
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const payload = parseJsonBody(req.body);
    const result = await createRazorpayOrder({
      amount: payload.amount,
      receipt: payload.receipt,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Unexpected server error while creating Razorpay order.',
    });
  }
}
