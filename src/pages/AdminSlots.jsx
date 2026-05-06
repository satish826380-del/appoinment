import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarPlus, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toDateInput, toTimeInput } from '../lib/dates';

export default function AdminSlots() {
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({ slot_date: toDateInput(), slot_time: toTimeInput() });
  const [busy, setBusy] = useState(false);

  async function loadSlots() {
    const { data, error } = await supabase.from('time_slots').select('*').gte('slot_date', toDateInput()).order('slot_date').order('slot_time');
    if (error) return toast.error(error.message);
    setSlots(data ?? []);
  }

  useEffect(() => {
    loadSlots();
    const channel = supabase
      .channel('admin-slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_slots' }, loadSlots)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function addSlot(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('time_slots').insert(form);
    setBusy(false);
    if (error) return toast.error(error.message.includes('duplicate') ? 'That slot already exists.' : error.message);
    toast.success('Slot added.');
    loadSlots();
  }

  async function toggleSlot(slot) {
    const { error } = await supabase.from('time_slots').update({ is_available: !slot.is_available }).eq('id', slot.id);
    if (error) return toast.error(error.message);
    loadSlots();
  }

  return (
    <div className="animate-fade-up space-y-4">
      {/* Add slot form */}
      <form className="ui-card" onSubmit={addSlot}>
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-brand-500">
            <CalendarPlus size={18} />
          </div>
          <h1 className="text-lg font-bold text-navy">Add Slot</h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="field-label">Date
            <input className="field" type="date" required value={form.slot_date} onChange={(e) => setForm({ ...form, slot_date: e.target.value })} />
          </label>
          <label className="field-label">Time
            <input className="field" type="time" required value={form.slot_time} onChange={(e) => setForm({ ...form, slot_time: e.target.value })} />
          </label>
          <button className="btn-filled self-end py-3 sm:px-8" disabled={busy}>
            {busy ? 'Adding...' : 'Add Slot'}
          </button>
        </div>
      </form>

      {/* Slot grid */}
      <section className="ui-card">
        <h2 className="text-lg font-bold text-navy">Upcoming Slots</h2>
        <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => (
            <article
              key={slot.id}
              className={`rounded-xl border p-3.5 transition ${
                slot.is_available ? 'border-blue-100 bg-blue-50/30' : 'border-red-100 bg-red-50/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg ${
                    slot.is_available ? 'bg-brand-500 text-white' : 'bg-red-100 text-danger'
                  }`}>
                    <Clock size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy">{slot.slot_date}</p>
                    <p className="text-xs text-navy-muted">{slot.slot_time.slice(0, 5)}</p>
                  </div>
                </div>
                <span className={`status ${slot.is_available ? 'status-done' : 'status-cancelled'}`}>
                  {slot.is_available ? 'Open' : 'Closed'}
                </span>
              </div>
              <button
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
                  slot.is_available ? 'bg-red-50 text-danger hover:bg-red-100' : 'bg-blue-50 text-brand-500 hover:bg-blue-100'
                }`}
                onClick={() => toggleSlot(slot)}
              >
                {slot.is_available ? <><ToggleRight size={15} /> Unavailable</> : <><ToggleLeft size={15} /> Available</>}
              </button>
            </article>
          ))}
          {slots.length === 0 && <p className="col-span-full text-sm text-navy-muted">No upcoming slots.</p>}
        </div>
      </section>
    </div>
  );
}
