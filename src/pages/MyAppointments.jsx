import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarCheck, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { readableSlot } from '../lib/dates';

export default function MyAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);

  async function loadAppointments() {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, reason, status, queue_number, created_at, time_slots(slot_date, slot_time)')
      .eq('patient_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false });
    if (error) return toast.error(error.message);
    setAppointments(data ?? []);
  }

  useEffect(() => {
    loadAppointments();
    const channel = supabase
      .channel(`my-appointments-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `patient_id=eq.${user.id}` }, loadAppointments)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user.id]);

  async function cancelAppointment(id) {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Appointment cancelled.');
    loadAppointments();
  }

  return (
    <section className="animate-fade-up">
      <div className="ui-card">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand-500">
            <CalendarCheck size={20} />
          </div>
          <h1 className="text-lg font-bold text-navy sm:text-xl">My Appointments</h1>
        </div>

        <div className="grid gap-3">
          {appointments.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-border py-12 text-center">
              <Clock size={32} className="text-navy-muted" />
              <p className="text-sm text-navy-muted">No upcoming appointments.</p>
            </div>
          )}

          {appointments.map((appointment) => (
            <article
              key={appointment.id}
              className="grid gap-3 rounded-xl border border-surface-border p-4 transition hover:bg-surface-hover sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-brand-500">
                      <Clock size={15} />
                    </div>
                    <p className="text-sm font-bold text-navy">{readableSlot(appointment.time_slots)}</p>
                  </div>
                  <span className={`status status-${appointment.status}`}>{appointment.status.replace('_', ' ')}</span>
                </div>
                <p className="ml-10 mt-1 text-xs font-semibold text-brand-500">Queue #{appointment.queue_number}</p>
                <p className="ml-10 mt-0.5 text-xs text-navy-muted">{appointment.reason}</p>
              </div>

              <button
                className="flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-xs font-semibold text-danger transition hover:bg-red-100"
                onClick={() => cancelAppointment(appointment.id)}
              >
                <XCircle size={14} /> Cancel
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
