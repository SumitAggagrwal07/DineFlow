import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Brand } from '../components/ui.jsx';
import { useAuth, homeFor } from '../auth.jsx';
import { errMsg } from '../api';

export default function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ ownerName: '', restaurantName: '', email: '', password: '', tableCount: 10, phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(f);
      toast.success('Your restaurant is ready. Add your menu next.');
      nav('/app/menu', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Brand />
        <h2>Set up your restaurant in a few minutes.</h2>
        <p className="muted">Tell us your name and how many tables you have. You will add the menu and print QR codes next.</p>
      </aside>
      <main className="auth-main">
        <form className="auth-box stack" onSubmit={submit}>
          <div>
            <h1>Register your restaurant</h1>
            <p className="muted">You become the owner and can add chef and waiter logins later.</p>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="o">Your name</label><input id="o" className="input" value={f.ownerName} onChange={set('ownerName')} required /></div>
            <div className="field"><label htmlFor="r">Restaurant name</label><input id="r" className="input" value={f.restaurantName} onChange={set('restaurantName')} required /></div>
          </div>
          <div className="field"><label htmlFor="e">Email</label><input id="e" className="input" type="email" autoComplete="username" value={f.email} onChange={set('email')} required /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="p">Password</label><input id="p" className="input" type="password" autoComplete="new-password" minLength={6} value={f.password} onChange={set('password')} required /><span className="hint">At least 6 characters</span></div>
            <div className="field"><label htmlFor="t">Number of tables</label><input id="t" className="input" type="number" min={1} max={200} value={f.tableCount} onChange={set('tableCount')} required /></div>
          </div>
          <div className="field"><label htmlFor="ph">Phone (optional)</label><input id="ph" className="input" value={f.phone} onChange={set('phone')} /></div>
          {error && <div className="error-text" role="alert">{error}</div>}
          <button className="btn primary lg block" disabled={busy}>{busy ? 'Creating…' : 'Create restaurant'}</button>
          <p className="muted small center">Already registered? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link></p>
        </form>
      </main>
    </div>
  );
}
