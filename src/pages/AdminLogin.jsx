import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword(form);
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    await refreshProfile();
    setBusy(false);

    if (profile?.role !== 'admin') {
      await supabase.auth.signOut();
      return toast.error('This account is not an admin.');
    }

    navigate('/admin/dashboard');
  }

  return (
    <section className="animate-fade-up mx-auto max-w-md py-6">
      <div className="ui-card">
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-xl font-bold text-navy">Admin Login</h1>
          <p className="text-xs text-navy-muted">Staff-only dashboard access</p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <label className="field-label">
            <span className="flex items-center gap-2"><Mail size={14} /> Email</span>
            <input className="field" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="field-label">
            <span className="flex items-center gap-2"><Lock size={14} /> Password</span>
            <input className="field" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <button className="btn-filled w-full py-3" disabled={busy}>
            {busy ? 'Checking...' : 'Enter dashboard'}
          </button>
        </form>
      </div>
    </section>
  );
}
