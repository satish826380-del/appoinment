import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Heart, ShieldCheck, Users } from 'lucide-react';

const features = [
  { icon: CalendarClock, title: 'Easy Scheduling', desc: 'Pick an available slot and book in seconds.', bg: 'bg-blue-50', color: 'text-brand-500' },
  { icon: Users, title: 'Live Queue', desc: 'Track your position and get real-time updates.', bg: 'bg-green-50', color: 'text-success' },
  { icon: Heart, title: 'Instant Alerts', desc: 'Get notified the moment your turn arrives.', bg: 'bg-orange-50', color: 'text-warn' }
];

export default function Home() {
  return (
    <section className="animate-fade-up space-y-8 py-4">
      {/* Hero */}
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-brand-500">
            <CalendarClock size={15} />
            Live clinic queue booking
          </span>

          <h1 className="text-3xl font-extrabold leading-tight text-navy sm:text-4xl md:text-5xl">
            CareQueue Clinic
          </h1>

          <p className="max-w-md text-sm leading-relaxed text-navy-muted sm:text-base">
            Book an available appointment slot, follow your place in the queue, and get a live in-app alert when your turn is next.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="btn-filled px-6 py-3">
              Book Appointment <ArrowRight size={16} />
            </Link>
            <Link to="/admin/login" className="btn-outline px-6 py-3">
              Clinic Staff <ShieldCheck size={16} />
            </Link>
          </div>
        </div>

        {/* Demo schedule card */}
        <div className="ui-card space-y-2.5">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-navy-muted">Today's Schedule</p>
          {[
            ['09:00', 'Available', 'General consultation'],
            ['09:30', 'Booked', 'Unavailable'],
            ['10:00', 'Available', 'Follow-up visit'],
            ['10:30', 'Next', 'Patient notified']
          ].map(([time, state, note]) => (
            <div
              key={time}
              className="flex items-center justify-between rounded-xl border border-surface-border p-3.5 transition hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3">
                <div className={`grid h-9 w-9 place-items-center rounded-lg text-sm ${
                  state === 'Booked' ? 'bg-red-50 text-danger' : state === 'Next' ? 'bg-orange-50 text-warn' : 'bg-blue-50 text-brand-500'
                }`}>
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">{time}</p>
                  <p className="text-xs text-navy-muted">{note}</p>
                </div>
              </div>
              <span className={`status ${
                state === 'Booked' ? 'status-cancelled' : state === 'Next' ? 'status-progress' : 'status-done'
              }`}>{state}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3.5 text-success">
            <CheckCircle2 size={18} />
            <span className="text-xs font-semibold">One slot accepts exactly one patient.</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, desc, bg, color }) => (
          <div key={title} className="ui-card flex items-start gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${bg} ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-navy-muted">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
