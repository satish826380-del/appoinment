import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convert a base64 VAPID key to a Uint8Array for the Push API.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser supports push notifications.
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current permission state.
 */
export function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

/**
 * Register the service worker and subscribe to push notifications.
 * Stores the subscription endpoint in Supabase for server-side push delivery.
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) {
    console.warn('Push notifications not supported or VAPID key missing.');
    return null;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Push notification permission denied.');
    return null;
  }

  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // Subscribe to push
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  // Store subscription in Supabase
  const subJSON = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subJSON.endpoint,
      p256dh: subJSON.keys?.p256dh || '',
      auth: subJSON.keys?.auth || '',
      subscription_json: JSON.stringify(subJSON)
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.warn('Failed to store push subscription:', error.message);
  }

  return subscription;
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }

  // Remove from Supabase
  await supabase.from('push_subscriptions').delete().eq('user_id', userId);
}
