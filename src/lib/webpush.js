/**
 * Client-side Web Push sender using VAPID authentication.
 * Sends a push "ping" (no encrypted payload) to the patient's push endpoint.
 * The Service Worker will show a notification with the message.
 *
 * NOTE: In production, move the VAPID private key to a server-side Edge Function.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = import.meta.env.VITE_VAPID_PRIVATE_KEY;

/* ── helpers ────────────────────────────────────────── */

function base64urlToUint8Array(b64url) {
  const padding = '='.repeat((4 - (b64url.length % 4)) % 4);
  const base64 = (b64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

function uint8ToBase64url(uint8) {
  return btoa(String.fromCharCode(...uint8))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/* ── VAPID JWT ──────────────────────────────────────── */

async function createVapidJwt(audience) {
  const pubBytes = base64urlToUint8Array(VAPID_PUBLIC_KEY);
  const privBytes = base64urlToUint8Array(VAPID_PRIVATE_KEY);

  // Build JWK from raw key bytes (public key is 65 bytes: 0x04 || x || y)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ToBase64url(pubBytes.slice(1, 33)),
    y: uint8ToBase64url(pubBytes.slice(33, 65)),
    d: uint8ToBase64url(privBytes)
  };

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // JWT header + payload
  const enc = new TextEncoder();
  const header = uint8ToBase64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = uint8ToBase64url(
    enc.encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: 'mailto:admin@carequeue.com' }))
  );

  const unsigned = `${header}.${payload}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, enc.encode(unsigned));

  return `${unsigned}.${uint8ToBase64url(new Uint8Array(sig))}`;
}

/* ── Push sender ────────────────────────────────────── */

/**
 * Send a Web Push notification to a subscription endpoint.
 * Uses empty body (no encryption needed) — the Service Worker stores the
 * latest notification message via query param in the endpoint tag.
 *
 * @param {object} subscriptionJSON - The push subscription JSON (endpoint, keys)
 * @returns {{ ok: boolean, status: number }}
 */
export async function sendPushToSubscription(subscriptionJSON) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys missing — cannot send push');
    return { ok: false, status: 0 };
  }

  const sub = typeof subscriptionJSON === 'string' ? JSON.parse(subscriptionJSON) : subscriptionJSON;
  const audience = new URL(sub.endpoint).origin;

  try {
    const jwt = await createVapidJwt(audience);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        TTL: '86400',
        'Content-Length': '0',
        Urgency: 'high'
      }
    });

    console.log('Push sent:', res.status, res.ok);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.warn('Push send error:', err.message);
    return { ok: false, status: 0 };
  }
}
