import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function NotificationListener() {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [pushReady, setPushReady] = useState(false);

  // Subscribe to realtime in-app notifications (when tab is open)
  useEffect(() => {
    if (!user) return undefined;

    const channel = supabase
      .channel(`appointment-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointment_notifications',
          filter: `patient_id=eq.${user.id}`
        },
        async (payload) => {
          // Show in-app toast
          toast.custom(
            (toastItem) => (
              <div className={`notification-toast ${toastItem.visible ? 'animate-enter' : 'animate-leave'}`}>
                <BellRing size={22} />
                <div>
                  <p className="font-semibold">You are next!</p>
                  <p className="text-sm opacity-90">{payload.new.message}</p>
                </div>
              </div>
            ),
            { duration: 9000 }
          );

          // Also show a native browser notification if permission is granted
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('🔔 CareQueue — Your Turn!', {
                body: payload.new.message,
                icon: '/favicon.ico',
                tag: 'carequeue-turn',
                requireInteraction: true
              });
            } catch (e) {
              console.warn('Native notification failed:', e);
            }
          }

          await supabase
            .from('appointment_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', payload.new.id);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // Check notification support on mount
  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window)) return;

    const permission = Notification.permission;
    if (permission === 'default') {
      // Haven't asked yet — show the prompt
      setShowPrompt(true);
    } else if (permission === 'granted') {
      setPushReady(true);
      // Register service worker for background push
      registerServiceWorker();
    }
  }, [user]);

  async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('Service Worker registered');

        // Try subscribing to push
        const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (VAPID_KEY && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            const padding = '='.repeat((4 - (VAPID_KEY.length % 4)) % 4);
            const base64 = (VAPID_KEY + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            const keyArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; i++) keyArray[i] = rawData.charCodeAt(i);

            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: keyArray
            });
          }
          // Store subscription in Supabase
          const subJSON = sub.toJSON();
          await supabase.from('push_subscriptions').upsert(
            {
              user_id: user.id,
              endpoint: subJSON.endpoint,
              p256dh: subJSON.keys?.p256dh || '',
              auth: subJSON.keys?.auth || '',
              subscription_json: JSON.stringify(subJSON)
            },
            { onConflict: 'user_id' }
          );
        }
      } catch (err) {
        console.warn('SW/Push registration error:', err.message);
      }
    }
  }

  async function enableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushReady(true);
        setShowPrompt(false);
        await registerServiceWorker();
        toast.success('Notifications enabled! You\'ll be notified when it\'s your turn.');
      } else {
        setShowPrompt(false);
        toast.error('Notification permission denied.');
      }
    } catch (err) {
      console.warn('Permission request error:', err);
      setShowPrompt(false);
    }
  }

  if (!user) return null;

  // Show notification opt-in prompt
  if (showPrompt) {
    return (
      <div
        style={{ position: 'fixed', bottom: '88px', left: '16px', right: '16px', zIndex: 9999, maxWidth: '380px', margin: '0 auto' }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          borderRadius: '14px', background: '#1B2559', padding: '16px',
          color: '#fff', boxShadow: '0 8px 30px rgba(27,37,89,0.25)'
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: '#4A6CF7', display: 'grid', placeItems: 'center', flexShrink: 0
          }}>
            <Bell size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '14px', margin: 0 }}>Enable Notifications</p>
            <p style={{ fontSize: '12px', opacity: 0.8, margin: '4px 0 0' }}>
              Get notified when it's your turn — even if you leave this page.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={enableNotifications}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: '#4A6CF7', color: '#fff', fontWeight: 600,
                  fontSize: '13px', cursor: 'pointer'
                }}
              >
                Enable
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 600,
                  fontSize: '13px', cursor: 'pointer'
                }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
