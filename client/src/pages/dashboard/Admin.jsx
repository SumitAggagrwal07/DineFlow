import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, errMsg } from '../../api';
import { money } from '../../util';
import { Spinner } from '../../components/ui.jsx';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/restaurants')])
      .then(([s, l]) => {
        setStats(s.data);
        setList(l.data);
      })
      .catch((e) => toast.error(errMsg(e)));
  }, []);

  const toggle = async (r) => {
    try {
      await api.patch(`/admin/restaurants/${r.id}/active`, { isActive: !r.isActive });
      setList((l) => l.map((x) => (x.id === r.id ? { ...x, isActive: !r.isActive } : x)));
      toast.success(r.isActive ? `${r.name} suspended` : `${r.name} reactivated`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!stats || !list) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h1>Restaurants on DineFlow</h1><p className="muted">Everyone who has registered, and how much they use the platform.</p></div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="k">Restaurants</div><div className="v">{stats.restaurants}</div></div>
        <div className="stat"><div className="k">Owners</div><div className="v">{stats.owners}</div></div>
        <div className="stat"><div className="k">Staff accounts</div><div className="v">{stats.staff}</div></div>
        <div className="stat"><div className="k">Orders · paid volume</div><div className="v">{stats.orders} · {money(stats.revenue)}</div></div>
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table className="t">
          <thead><tr><th>Restaurant</th><th>Owner</th><th>Tables</th><th>Menu</th><th>Staff</th><th>Orders</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name}</b><div className="small muted">/r/{r.slug}</div></td>
                <td>{r.owner?.name}<div className="small muted">{r.owner?.email}</div></td>
                <td>{r.tableCount}</td>
                <td>{r.menuItems}</td>
                <td>{r.staff}</td>
                <td>{r.orders}</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  <label className="switch">
                    <input type="checkbox" checked={r.isActive} onChange={() => toggle(r)} aria-label={`${r.name} active`} />
                    {r.isActive ? 'Active' : 'Suspended'}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
