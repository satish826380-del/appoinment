import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Mail, Phone, Stethoscope, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' });
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);

    const authCall =
      mode === 'register'
        ? supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: { data: { full_name: form.fullName, phone: form.phone } }
          })
        : supabase.auth.signInWithPassword({ email: form.email, password: form.password });

    const { error } = await authCall;
    setBusy(false);

    if (error) return toast.error(error.message);
    toast.success(mode === 'register' ? 'Account created. Check email if confirmation is enabled.' : 'Welcome back.');
    navigate('/book');
  }

  return (
    <section className="animate-fade-up mx-auto max-w-md py-6">
      <div className="ui-card">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white">
            <Stethoscope size={24} />
          </div>
          <h1 className="text-xl font-bold text-navy">
            {mode === 'register' ? 'Create Account' : 'Patient Login'}
          </h1>
          <p className="text-xs text-navy-muted">Access your appointments & queue position</p>
        </div>

        <div className="grid grid-cols-2 rounded-lg bg-surface-bg p-1">
          <button className={mode === 'login' ? 'segment-active' : 'segment'} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'register' ? 'segment-active' : 'segment'} onClick={() => setMode('register')}>Register</button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label className="field-label">
                <span className="flex items-center gap-2"><User size={14} /> Full name</span>
                <input className="field" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </label>
              <label className="field-label">
                <span className="flex items-center gap-2"><Phone size={14} /> Phone</span>
                <input className="field" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
            </>
          )}
          <label className="field-label">
            <span className="flex items-center gap-2"><Mail size={14} /> Email</span>
            <input className="field" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="field-label">
            <span className="flex items-center gap-2"><Lock size={14} /> Password</span>
            <input className="field" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <button className="btn-filled w-full py-3" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Login'}
          </button>
        </form>
      </div>
    </section>
  );
}
