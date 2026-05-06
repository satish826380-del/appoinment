// Supabase Edge Function: send-push-notification
// Deploy: supabase functions deploy send-push-notification --project-ref yxwvhkislhyqoybkhyve
//
// This function receives a patient_id and message, looks up their push subscription,
// and sends a Web Push notification using the VAPID keys.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/**
 * Encode a Uint8Array to base64url
 */
function base64urlEncode(data) {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Import a base64url-encoded key as a CryptoKey
 */
async function importVapidKey(base64urlKey) {
  const padding = '='.repeat((4 - (base64urlKey.length % 4)) % 4);
  const base64 = (base64urlKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawKey = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', rawKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/**
 * Send a Web Push notification using the Web Push Protocol (RFC 8291)
 * This is a simplified implementation using the fetch API.
 */
async function sendWebPush(subscription, payload) {
  const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;

  // For a simple implementation, we'll use the subscription endpoint directly
  // with the VAPID JWT authorization
  const audience = new URL(sub.endpoint).origin;

  // Create VAPID JWT
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: 'mailto:carequeue@clinic.com'
  };

  const encoder = new TextEncoder();
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(jwtPayload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const privateKeyData = (() => {
    const padding = '='.repeat((4 - (VAPID_PRIVATE_KEY.length % 4)) % 4);
    const base64 = (VAPID_PRIVATE_KEY + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  })();

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    await convertRawToPrivateKey(privateKeyData),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;

  // Send the push message
  const response = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      'TTL': '86400'
    },
    body: JSON.stringify(payload)
  });

  return { status: response.status, ok: response.ok };
}

/**
 * Convert a 32-byte raw private key to PKCS8 format for P-256
 */
async function convertRawToPrivateKey(rawKey) {
  // PKCS8 wrapping for EC P-256 private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00
  ]);

  // We need the public key too - derive it
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: base64urlEncode(rawKey),
    x: '', // Will be filled
    y: ''  // Will be filled
  };

  // Import as JWK to get the full key pair
  const keyPair = await crypto.subtle.importKey(
    'jwk',
    { ...jwk, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  );

  const exported = await crypto.subtle.exportKey('pkcs8', keyPair);
  return exported;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patient_id, message, title } = await req.json();

    if (!patient_id || !message) {
      return new Response(
        JSON.stringify({ error: 'patient_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the patient's push subscription from Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: sub, error } = await supabase
      .from('push_subscriptions')
      .select('subscription_json')
      .eq('user_id', patient_id)
      .single();

    if (error || !sub) {
      return new Response(
        JSON.stringify({ error: 'No push subscription found for this patient', detail: error?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send the push notification
    const result = await sendWebPush(sub.subscription_json, {
      title: title || 'CareQueue Clinic',
      body: message,
      url: '/my-appointments'
    });

    return new Response(
      JSON.stringify({ success: result.ok, status: result.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
