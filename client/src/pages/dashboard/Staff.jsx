import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, KeyRound, ShieldAlert, Trash2, UserPlus } from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import { Modal, Spinner } from '../../components/ui.jsx';

export default function Staff() {
  const { restaurant } = useAuth();
  const [staff, setStaff] = useState(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', role: 'chef' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    api.get('/panel/staff').then((r) => setStaff(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/panel/staff', f);
      setStaff((l) => [data, ...l]);
      setAdding(false);
      setF({ name: '', phone: '', email: '', password: '', role: 'chef' });
      toast.success(`${data.name} can now sign in`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const patch = async (s, body, msg) => {
    try {
      const { data } = await api.patch(`/panel/staff/${s.id}`, body);
      setStaff((l) => l.map((x) => (x.id === data.id ? data : x)));
      toast.success(msg);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const resetPw = (s) => {
    const pw = prompt(`New password for ${s.name} (at least 6 characters)`);
    if (pw) patch(s, { password: pw }, 'Password changed');
  };

  const remove = async (s) => {
    if (!confirm(`Remove ${s.name}? They will no longer be able to sign in.`)) return;
    try {
      await api.delete(`/panel/staff/${s.id}`);
      setStaff((l) => l.filter((x) => x.id !== s.id));
      toast.success('Staff member removed');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!staff) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff</h1>
          <p className="muted">Chefs set preparation times. Waiters answer calls and serve. Each person signs in with their own email.</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)}><UserPlus size={16} /> Add staff</button>
      </div>

      {restaurant?.staffCode && (
        <div className="card staff-code-banner">
          <div>
            <div className="small muted">YOUR RESTAURANT STAFF CODE</div>
            <div className="staff-code-display">{restaurant.staffCode}</div>
            <p className="small muted">Share this code with your chefs and waiters. They need it along with their email & password to sign in to your restaurant.</p>
          </div>
          <button
            className="btn sm"
            onClick={() => {
              navigator.clipboard?.writeText(restaurant.staffCode);
              toast.success('Staff code copied to clipboard!');
            }}
          >
            <Copy size={15} /> Copy Code
          </button>
        </div>
      )}

      {staff.length === 0 ? (
        <div className="card empty"><h3>No staff yet</h3><p>Add a chef so someone can accept orders and set timers.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Name</th><th>Role</th><th>Phone No.</th><th>Email</th><th>Access</th><th /></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td>
                    <span className="pill">
                      {s.role === 'chef' ? 'Chef' : s.role === 'waiter' ? 'Waiter' : 'Receptionist'}
                    </span>
                  </td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.email}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={s.active} onChange={() => patch(s, { active: !s.active }, s.active ? 'Access turned off' : 'Access turned on')} aria-label={`${s.name} can sign in`} />
                      {s.active ? 'On' : 'Off'}
                    </label>
                  </td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <button className="icon-btn" onClick={() => resetPw(s)} aria-label={`Reset password for ${s.name}`}><KeyRound size={16} /></button>
                      <button className="icon-btn" onClick={() => remove(s)} aria-label={`Remove ${s.name}`}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <Modal title="Add staff member" onClose={() => setAdding(false)}>
          <form className="stack" onSubmit={create}>
            <div className="field"><label htmlFor="sn">Name</label><input id="sn" className="input" value={f.name} onChange={set('name')} required autoFocus /></div>
            <div className="field"><label htmlFor="spn">Phone number</label><input id="spn" className="input" type="tel" placeholder="+91 98765 00000" value={f.phone} onChange={set('phone')} /></div>
            <div className="field">
              <label htmlFor="sr">Role</label>
              <select id="sr" className="input" value={f.role} onChange={set('role')}>
                <option value="chef">Chef (kitchen screen, sets timers)</option>
                <option value="waiter">Waiter (help calls, serving, cash)</option>
                <option value="receptionist">Receptionist (front desk, waiting list, tables, cash payments)</option>
              </select>
            </div>
            <div className="field"><label htmlFor="se">Email (their login)</label><input id="se" className="input" type="email" value={f.email} onChange={set('email')} required /></div>
            <div className="field"><label htmlFor="sp">Password</label><input id="sp" className="input" type="text" minLength={6} value={f.password} onChange={set('password')} required /><span className="hint">Share this with them. They can ask you to change it later.</span></div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create login'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
