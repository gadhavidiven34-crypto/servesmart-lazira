import crypto from 'node:crypto';

function parseJsonBody(body) {
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

export function computeRazorpaySignature(orderId, paymentId, keySecret) {
  return crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export function verifyRazorpayHmac(
  { razorpay_order_id, razorpay_payment_id, razorpay_signature },
  keySecret = process.env.RAZORPAY_KEY_SECRET
) {
  if (!keySecret) {
    return {
      status: 500,
      body: {
        verified: false,
        error: 'RAZORPAY_KEY_SECRET is not configured on the server.',
      },
    };
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return {
      status: 400,
      body: {
        verified: false,
        error:
          'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature.',
      },
    };
  }

  const expectedSignature = computeRazorpaySignature(
    String(razorpay_order_id),
    String(razorpay_payment_id),
    keySecret
  );

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const providedBuffer = Buffer.from(String(razorpay_signature).trim(), 'utf8');

  const isMatch =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!isMatch) {
    return {
      status: 400,
      body: {
        verified: false,
        error: 'Invalid Razorpay payment signature.',
      },
    };
  }

  return {
    status: 200,
    body: {
      verified: true,
      razorpay_order_id: String(razorpay_order_id),
      razorpay_payment_id: String(razorpay_payment_id),
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
    return res.status(405).json({ verified: false, error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const payload = parseJsonBody(req.body);
    const result = verifyRazorpayHmac({
      razorpay_order_id: payload.razorpay_order_id,
      razorpay_payment_id: payload.razorpay_payment_id,
      razorpay_signature: payload.razorpay_signature,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({
      verified: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unexpected server error while verifying Razorpay payment.',
    });
  }
}
