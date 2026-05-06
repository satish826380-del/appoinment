import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function NotificationListener() {
  const { user } = useAuth();

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
                <Bell size={22} />
                <div>
                  <p className="font-semibold">You are next</p>
                  <p className="text-sm">{payload.new.message}</p>
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

  return null;
}
