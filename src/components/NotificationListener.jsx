import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bell, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getPushPermission, isPushSupported, subscribeToPush } from '../lib/pushNotifications';

export default function NotificationListener() {
  const { user } = useAuth();
  const [pushStatus, setPushStatus] = useState('unknown'); // 'unknown' | 'granted' | 'denied' | 'default' | 'unsupported'

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

          await supabase
            .from('appointment_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', payload.new.id);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // Auto-subscribe to Web Push when user is logged in
  useEffect(() => {
    if (!user) return;

    if (!isPushSupported()) {
      setPushStatus('unsupported');
      return;
    }

    const permission = getPushPermission();
    setPushStatus(permission);

    // If already granted, subscribe silently
    if (permission === 'granted') {
      subscribeToPush(user.id).catch(console.warn);
    }
  }, [user]);

  if (!user) return null;

  // Show a push notification opt-in prompt if permission is 'default' (not yet asked)
  if (pushStatus === 'default' && isPushSupported()) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-fade-up sm:left-auto sm:right-6 sm:bottom-6">
        <div className="flex items-start gap-3 rounded-xl bg-navy p-4 text-white shadow-float">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-500">
            <Bell size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Enable Notifications</p>
            <p className="mt-1 text-xs opacity-80">Get notified when it's your turn — even if you leave this page.</p>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
                onClick={async () => {
                  await subscribeToPush(user.id);
                  setPushStatus(getPushPermission());
                }}
              >
                Enable
              </button>
              <button
                className="rounded-lg bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                onClick={() => setPushStatus('dismissed')}
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
