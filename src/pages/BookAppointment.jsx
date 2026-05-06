import { useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import toast from 'react-hot-toast';
import { CalendarDays, Clock, FileText, Phone, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { readableSlot, slotToDate, toDateInput } from '../lib/dates';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'en-US': enUS } });

export default function BookAppointment() {
  const { user, profile, refreshProfile } = useAuth();
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toDateInput());
  const [form, setForm] = useState({ name: profile?.full_name ?? '', phone: profile?.phone ?? '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  async function loadSlots() {
    const { data, error } = await supabase.from('time_slots').select('*').gte('slot_date', toDateInput()).order('slot_date').order('slot_time');
    if (error) return toast.error(error.message);
    setSlots(data ?? []);
  }

  useEffect(() => {
    loadSlots();
    const channel = supabase
      .channel('patient-slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_slots' }, loadSlots)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const events = useMemo(
    () =>
      slots.map((slot) => {
        const start = slotToDate(slot);
        return {
          id: slot.id,
          title: slot.is_available ? 'Available' : 'Unavailable',
          start,
          end: new Date(start.getTime() + 30 * 60000),
          resource: slot
        };
      }),
    [slots]
  );

  const daySlots = slots.filter((slot) => slot.slot_date === selectedDate);

  async function book(event) {
    event.preventDefault();
    if (!selectedSlot) return toast.error('Choose an available slot.');
    setBusy(true);

    // Upsert profile to handle both new and existing profiles
    await supabase.from('profiles').upsert({ id: user.id, full_name: form.name, phone: form.phone }, { onConflict: 'id' });

    const { data, error } = await supabase
      .from('appointments')
      .insert({ patient_id: user.id, slot_id: selectedSlot.id, reason: form.reason })
      .select('queue_number')
      .single();

    setBusy(false);
    if (error) {
      // Reload slots to reflect latest availability
      await loadSlots();
      setSelectedSlot(null);
      const msg = error.message.includes('duplicate') || error.message.includes('unique') || error.code === '23505' || error.code === '409'
        ? 'That slot was just booked by someone else. Please pick another time.'
        : error.message;
      return toast.error(msg);
    }
    await refreshProfile();
    setSelectedSlot(null);
    setForm({ ...form, reason: '' });
    await loadSlots();
    toast.success(`Appointment confirmed. Queue number ${data.queue_number}.`);
  }

  return (
    <div className="animate-fade-up space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-brand-500">
            <CalendarDays size={18} />
          </div>
          <h1 className="text-lg font-bold text-navy">Book Appointment</h1>
        </div>
        <input className="field max-w-full sm:max-w-[170px]" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      {/* Mobile: toggle calendar view */}
      <div className="lg:hidden">
        <button
          className="btn-outline w-full"
          onClick={() => setShowCalendar(!showCalendar)}
        >
          <CalendarDays size={16} />
          {showCalendar ? 'Hide Calendar' : 'Show Calendar View'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Calendar — always visible on desktop, toggleable on mobile */}
        <section className={`ui-card ${showCalendar ? '' : 'hidden lg:block'}`}>
          <div className="calendar-shell">
            <Calendar localizer={localizer} events={events} startAccessor="start" endAccessor="end" views={['month', 'week', 'day']} onSelectEvent={(event) => event.resource.is_available && setSelectedSlot(event.resource)} eventPropGetter={(event) => ({ className: event.resource.is_available ? 'cal-available' : 'cal-unavailable' })} />
          </div>
        </section>

        {/* Right panel */}
        <aside className="space-y-4">
          {/* Slots */}
          <section className="ui-card">
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
              <Clock size={15} className="text-brand-500" /> Available Slots
            </h2>
            <div className="mt-3 grid gap-2">
              {daySlots.length === 0 && <p className="text-xs text-navy-muted">No slots for this date.</p>}
              {daySlots.map((slot) => (
                <button key={slot.id} disabled={!slot.is_available} onClick={() => setSelectedSlot(slot)} className={`slot-button ${selectedSlot?.id === slot.id ? 'slot-selected' : ''}`}>
                  <span className="flex items-center gap-2">
                    <Clock size={14} className="text-navy-muted" />
                    {slot.slot_time.slice(0, 5)}
                  </span>
                  <span className={`status ${slot.is_available ? 'status-done' : 'status-cancelled'}`}>
                    {slot.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Form */}
          <form className="ui-card" onSubmit={book}>
            <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
              <FileText size={15} className="text-brand-500" /> Booking Form
            </h2>
            <p className="mt-1 text-xs text-navy-muted">
              {selectedSlot ? readableSlot(selectedSlot) : 'Select an available slot.'}
            </p>
            <div className="mt-3 space-y-3">
              <label className="field-label">
                <span className="flex items-center gap-2"><User size={13} /> Name</span>
                <input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="field-label">
                <span className="flex items-center gap-2"><Phone size={13} /> Phone</span>
                <input className="field" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="field-label">
                <span className="flex items-center gap-2"><FileText size={13} /> Reason</span>
                <textarea className="field min-h-20" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </label>
              <button className="btn-filled w-full py-3" disabled={busy || !selectedSlot}>
                {busy ? 'Booking...' : 'Confirm booking'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
