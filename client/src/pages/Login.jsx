import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Brand, ThemeToggle } from '../components/ui.jsx';
import { useAuth, homeFor } from '../auth.jsx';
import { errMsg } from '../api';

const DEMO = [
  ['Platform admin', 'admin@dineflow.com', 'Admin@123', 'superadmin', ''],
  ['Restaurant owner', 'owner@demo.com', 'Owner@123', 'owner', ''],
  ['Chef', 'chef@demo.com', 'Chef@123', 'chef', 'DF-DEMO'],
  ['Waiter', 'waiter@demo.com', 'Waiter@123', 'waiter', 'DF-DEMO'],
  ['Receptionist', 'reception@demo.com', 'Reception@123', 'receptionist', 'DF-DEMO'],
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState('owner'); // 'owner' | 'chef' | 'waiter' | 'receptionist' | 'superadmin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const isStaff = role === 'chef' || role === 'waiter' || role === 'receptionist';

  const submit = async (e, creds) => {
    e?.preventDefault();
    const em = creds?.[1] ?? email;
    const pw = creds?.[2] ?? password;
    const r = creds?.[3] ?? role;
    const code = creds?.[4] ?? staffCode;

    setBusy(true);
    setError('');
    try {
      const u = await login(em, pw, r, code);
      toast.success(`Welcome, ${u.name.split(' ')[0]}`);
      nav(homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleSelect = (r) => {
    setRole(r);
    setError('');
  };

  return (
    <div className="auth-page">
      <aside className="auth-side">
        <div className="row between">
          <Brand />
          <ThemeToggle />
        </div>
        <h2>Welcome to your restaurant hub.</h2>
        <p className="muted">
          Restaurant owners register and manage their outlet. Chefs and waiters login securely using their email, password, and restaurant code.
        </p>
      </aside>
      <main className="auth-main">
        <form className="auth-box stack" onSubmit={submit}>
          <div className="hide-desktop"><Brand /></div>
          <div>
            <h1>Sign in</h1>
            <p className="muted">Choose your role and enter your credentials.</p>
          </div>

          <div className="field">
            <label>Select Role</label>
            <div className="role-selector" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <button
                type="button"
                className={`role-tab ${role === 'owner' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('owner')}
              >
                Owner
              </button>
              <button
                type="button"
                className={`role-tab ${role === 'chef' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('chef')}
              >
                Chef
              </button>
              <button
                type="button"
                className={`role-tab ${role === 'waiter' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('waiter')}
              >
                Waiter
              </button>
              <button
                type="button"
                className={`role-tab ${role === 'receptionist' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('receptionist')}
              >
                Receptionist
              </button>
              <button
                type="button"
                className={`role-tab ${role === 'superadmin' ? 'active' : ''}`}
                onClick={() => handleRoleSelect('superadmin')}
              >
                Admin
              </button>
            </div>
          </div>

          {isStaff && (
            <div className="field">
              <label htmlFor="staffCode">Restaurant Code</label>
              <input
                id="staffCode"
                className="input code-input"
                type="text"
                placeholder="e.g. DF-XXXX"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
                required
              />
              <span className="hint">Provided by your restaurant owner</span>
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-text" role="alert">{error}</div>}

          <button className="btn primary lg block" disabled={busy}>
            {busy ? 'Signing in…' : `Sign in as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
          </button>

          {role === 'owner' && (
            <p className="muted small center">
              New restaurant owner? <Link to="/register" style={{ color: 'var(--accent)' }}>Register restaurant here</Link>
            </p>
          )}

          {isStaff && (
            <p className="muted small center" style={{ fontSize: '0.82rem' }}>
              ℹ️ Chefs and waiters cannot register a new restaurant. Contact your restaurant owner to receive your account and restaurant code.
            </p>
          )}

          {import.meta.env.DEV && (
            <div className="demo-box">
              <div className="small muted">Quick test accounts (development only)</div>
              {DEMO.map(([label, em, pw, r, code]) => (
                <div className="row between" key={em}>
                  <span className="small">{label} {code && <small style={{ opacity: 0.7 }}>({code})</small>}</span>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() => {
                      setRole(r);
                      setEmail(em);
                      setPassword(pw);
                      setStaffCode(code);
                      submit(null, [label, em, pw, r, code]);
                    }}
                  >
                    Sign in
                  </button>
                </div>
              ))}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
