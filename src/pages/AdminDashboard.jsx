import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Activity, CalendarCheck, CheckCircle, Clock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { readableSlot, toDateInput } from '../lib/dates';
import { sendPushToSubscription } from '../lib/webpush';

const statuses = ['pending', 'in_progress', 'done', 'cancelled'];
const tabs = ['upcoming', 'all', 'cancelled'];

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [date, setDate] = useState(toDateInput());
  const [busyId, setBusyId] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming');

  async function loadAppointments() {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, reason, status, queue_number, patient_id, profiles(full_name, phone), time_slots(id, slot_date, slot_time)')
      .order('queue_number');
    if (error) return toast.error(error.message);
    setAppointments(data ?? []);
  }

  async function loadAvailableSlots() {
    const { data, error } = await supabase
      .from('time_slots')
      .select('*')
      .gte('slot_date', toDateInput())
      .eq('is_available', true)
      .order('slot_date')
      .order('slot_time');
    if (error) return toast.error(error.message);
    setAvailableSlots(data ?? []);
  }

  useEffect(() => {
    loadAppointments();
    loadAvailableSlots();
    const channel = supabase
      .channel('admin-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, loadAppointments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_slots' }, loadAvailableSlots)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filtered = appointments.filter((a) => a.time_slots?.slot_date === date);
  const tabFiltered = useMemo(() => {
    if (activeTab === 'upcoming') return filtered.filter((a) => a.status === 'pending' || a.status === 'in_progress');
    if (activeTab === 'cancelled') return filtered.filter((a) => a.status === 'cancelled');
    return filtered;
  }, [filtered, activeTab]);

  const metrics = useMemo(
    () => ({
      today: filtered.length,
      pending: filtered.filter((i) => i.status === 'pending').length,
      inProgress: filtered.filter((i) => i.status === 'in_progress').length,
      done: filtered.filter((i) => i.status === 'done').length
    }),
    [filtered]
  );

  async function setStatus(appointment, status) {
    setBusyId(appointment.id);
    const { error } = await supabase.from('appointments').update({ status }).eq('id', appointment.id);
    if (error) {
      setBusyId(null);
      return toast.error(error.message);
    }

    // When marked "done", notify the next pending patient in queue for the same date
    if (status === 'done' && appointment.time_slots?.slot_date) {
      const slotDate = appointment.time_slots.slot_date;
      const currentQueue = appointment.queue_number;

      // Find next pending appointment on the same date with a higher queue number
      const { data: nextAppts } = await supabase
        .from('appointments')
        .select('id, patient_id, queue_number, profiles(full_name), time_slots(slot_date, slot_time)')
        .eq('status', 'pending')
        .gt('queue_number', currentQueue)
        .order('queue_number', { ascending: true })
        .limit(5);

      // Filter to same-date appointments (since we can't filter by joined table in Supabase easily)
      const nextOnSameDate = nextAppts?.find((a) => a.time_slots?.slot_date === slotDate);

      if (nextOnSameDate) {
        // Also mark the next appointment as in_progress
        await supabase.from('appointments').update({ status: 'in_progress' }).eq('id', nextOnSameDate.id);

        const slotTime = nextOnSameDate.time_slots?.slot_time?.slice(0, 5) || '';
        const notifMessage = `You are next! Your appointment (Queue #${nextOnSameDate.queue_number}) at ${slotTime} is coming up. Please be ready.`;

        // 1) Insert in-app notification (realtime listener picks this up if tab is open)
        const { error: notifError } = await supabase.from('appointment_notifications').insert({
          patient_id: nextOnSameDate.patient_id,
          appointment_id: nextOnSameDate.id,
          message: notifMessage
        });

        if (notifError) {
          console.warn('In-app notification insert error:', notifError.message);
        }

        // 2) Send Web Push notification (works even if patient has left the site)
        try {
          const { data: pushSub } = await supabase
            .from('push_subscriptions')
            .select('subscription_json')
            .eq('user_id', nextOnSameDate.patient_id)
            .single();

          if (pushSub?.subscription_json) {
            const result = await sendPushToSubscription(pushSub.subscription_json);
            if (result.ok) {
              console.log('Push notification sent successfully');
            } else {
              console.warn('Push notification failed with status:', result.status);
            }
          } else {
            console.warn('No push subscription found for patient');
          }
        } catch (pushErr) {
          console.warn('Push notification error:', pushErr.message);
        }

        toast.success(`Done! Next patient (Queue #${nextOnSameDate.queue_number}) has been notified.`);
      } else {
        toast.success('Marked done. No more patients in queue for this date.');
      }
    } else {
      toast.success('Status updated.');
    }

    setBusyId(null);
    loadAppointments();
  }

  async function reschedule(appointment, slotId) {
    if (!slotId) return;
    setBusyId(appointment.id);
    const { error } = await supabase.from('appointments').update({ slot_id: slotId, status: 'pending' }).eq('id', appointment.id);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success('Appointment rescheduled.');
    loadAppointments();
    loadAvailableSlots();
  }

  return (
    <div className="animate-fade-up space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-bold text-navy sm:text-xl">Dashboard</h1>
        <input className="field max-w-full sm:max-w-[180px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {/* Metric cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Users} label="Total" value={metrics.today} iconBg="bg-blue-50" iconColor="text-brand-500" pct={100} />
        <MetricCard icon={Clock} label="Pending" value={metrics.pending} iconBg="bg-orange-50" iconColor="text-warn" pct={metrics.today ? Math.round((metrics.pending / metrics.today) * 100) : 0} />
        <MetricCard icon={Activity} label="In Progress" value={metrics.inProgress} iconBg="bg-purple-50" iconColor="text-purple-500" pct={metrics.today ? Math.round((metrics.inProgress / metrics.today) * 100) : 0} />
        <MetricCard icon={CheckCircle} label="Done" value={metrics.done} iconBg="bg-green-50" iconColor="text-success" pct={metrics.today ? Math.round((metrics.done / metrics.today) * 100) : 0} />
      </section>

      {/* Tab bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-white p-1.5 shadow-card">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'segment-active' : 'segment'}>
            {tab === 'upcoming' ? 'Upcoming' : tab === 'all' ? 'All' : 'Cancelled'}
          </button>
        ))}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 px-2 text-[10px] font-semibold text-brand-500 sm:text-xs">
          <CalendarCheck size={13} /> {availableSlots.length} open
        </span>
      </div>

      {/* Desktop: Table */}
      <section className="hidden overflow-hidden rounded-xl bg-white shadow-card md:block">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Reason</th>
                <th>Time</th>
                <th>Phone</th>
                <th>Queue</th>
                <th>Status</th>
                <th>Update</th>
                <th>Reschedule</th>
              </tr>
            </thead>
            <tbody>
              {tabFiltered.map((appt) => (
                <tr key={appt.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-[10px] font-bold text-brand-500">
                        {(appt.profiles?.full_name || 'P')[0].toUpperCase()}
                      </div>
                      <span className="truncate font-semibold">{appt.profiles?.full_name || 'Patient'}</span>
                    </div>
                  </td>
                  <td className="max-w-[160px] truncate">{appt.reason}</td>
                  <td className="whitespace-nowrap text-xs">{readableSlot(appt.time_slots)}</td>
                  <td className="text-xs text-navy-muted">{appt.profiles?.phone || '-'}</td>
                  <td><span className="text-xs font-bold text-brand-500">#{appt.queue_number}</span></td>
                  <td><span className={`status status-${appt.status}`}>{appt.status.replace('_', ' ')}</span></td>
                  <td>
                    <select className="field min-w-[120px] text-xs" disabled={busyId === appt.id} value={appt.status} onChange={(e) => setStatus(appt, e.target.value)}>
                      {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="field min-w-[150px] text-xs" disabled={busyId === appt.id} defaultValue="" onChange={(e) => reschedule(appt, e.target.value)}>
                      <option value="">Choose slot</option>
                      {availableSlots.map((slot) => (
                        <option key={slot.id} value={slot.id}>{slot.slot_date} {slot.slot_time.slice(0, 5)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {tabFiltered.length === 0 && (
                <tr><td colSpan="8" className="py-10 text-center text-sm text-navy-muted">No appointments for this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile: Card list */}
      <section className="space-y-3 md:hidden">
        {tabFiltered.length === 0 && (
          <div className="rounded-xl bg-white p-8 text-center shadow-card">
            <p className="text-sm text-navy-muted">No appointments for this view.</p>
          </div>
        )}
        {tabFiltered.map((appt) => (
          <div key={appt.id} className="appt-card-mobile space-y-3">
            {/* Top: name + status */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-brand-500">
                  {(appt.profiles?.full_name || 'P')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy">{appt.profiles?.full_name || 'Patient'}</p>
                  <p className="text-[11px] text-navy-muted">{appt.profiles?.phone || '-'}</p>
                </div>
              </div>
              <span className={`status status-${appt.status}`}>{appt.status.replace('_', ' ')}</span>
            </div>

            {/* Info row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase text-navy-muted">Time</p>
                <p className="font-semibold text-navy">{readableSlot(appt.time_slots)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-navy-muted">Queue</p>
                <p className="font-bold text-brand-500">#{appt.queue_number}</p>
              </div>
            </div>

            {/* Reason */}
            <div className="text-xs">
              <p className="text-[10px] font-semibold uppercase text-navy-muted">Reason</p>
              <p className="text-navy">{appt.reason}</p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <select className="field text-xs" disabled={busyId === appt.id} value={appt.status} onChange={(e) => setStatus(appt, e.target.value)}>
                {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <select className="field text-xs" disabled={busyId === appt.id} defaultValue="" onChange={(e) => reschedule(appt, e.target.value)}>
                <option value="">Reschedule</option>
                {availableSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>{slot.slot_date} {slot.slot_time.slice(0, 5)}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, iconBg, iconColor, pct }) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-navy-muted sm:text-xs">{label}</p>
          <p className="mt-1 text-xl font-extrabold text-navy sm:mt-2 sm:text-3xl">{String(value).padStart(2, '0')}</p>
        </div>
        <div className={`grid h-8 w-8 place-items-center rounded-full sm:h-10 sm:w-10 ${iconBg} ${iconColor}`}>
          <Icon size={16} className="sm:hidden" />
          <Icon size={18} className="hidden sm:block" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 sm:mt-3">
        <div className="h-1 flex-1 rounded-full bg-surface-bg sm:h-1.5">
          <div className="h-1 rounded-full bg-brand-500 transition-all sm:h-1.5" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className="text-[9px] font-bold text-success sm:text-[10px]">{pct}%</span>
      </div>
    </div>
  );
}
