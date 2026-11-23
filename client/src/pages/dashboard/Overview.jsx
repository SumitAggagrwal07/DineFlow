import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import { money } from '../../util';
import { Spinner } from '../../components/ui.jsx';

export default function Overview() {
  const { restaurant, setRestaurant } = useAuth();
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get('/panel/stats').then((r) => setS(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!s || !restaurant) return <Spinner />;
  const cur = restaurant.currency;
  const link = `${window.location.origin}/r/${restaurant.slug}`;

  const toggleOpen = async () => {
    try {
      const { data } = await api.put('/panel/restaurant', { isOpen: !restaurant.isOpen });
      setRestaurant(data);
      toast.success(data.isOpen ? 'Now taking orders' : 'Orders paused');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{restaurant.name}</h1>
          <p className="muted">Today at a glance</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={restaurant.isOpen} onChange={toggleOpen} />
          {restaurant.isOpen ? 'Taking orders' : 'Orders paused'}
        </label>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="k">Orders today</div><div className="v">{s.ordersToday}</div></div>
        <div className="stat"><div className="k">Paid today</div><div className="v">{money(s.revenueToday, cur)}</div></div>
        <div className="stat"><div className="k">Waiting for payment</div><div className="v">{money(s.pendingToday, cur)}</div></div>
        <div className="stat"><div className="k">Active orders</div><div className="v">{s.activeOrders}</div></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Most ordered this week</h3>
          {s.topItems.length === 0 ? (
            <div className="empty"><h3>No orders yet</h3><p>Scan a table QR to place a test order.</p></div>
          ) : (
            s.topItems.map((i) => (
              <div className="list-line" key={i.name}><span>{i.name}</span><b>{i.qty}</b></div>
            ))
          )}
        </div>
        <div className="card stack">
          <h3>Your customer link</h3>
          <p className="muted small">This is the menu page guests reach from your wall QR. Table QR codes add the table number to it.</p>
          <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
          <div className="row wrap">
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(link); toast.success('Link copied'); }}><Copy size={14} /> Copy link</button>
            <a className="btn sm" href={link} target="_blank" rel="noreferrer">Open menu</a>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
          {restaurant.staffCode && (
            <div className="card flat stack" style={{ padding: '12px' }}>
              <div className="row between">
                <div>
                  <div className="small muted">Staff Restaurant Code</div>
                  <b style={{ letterSpacing: '0.08em', color: 'var(--accent)', fontSize: '1.1rem' }}>{restaurant.staffCode}</b>
                </div>
                <button
                  className="btn sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(restaurant.staffCode);
                    toast.success('Staff code copied');
                  }}
                >
                  <Copy size={13} /> Copy
                </button>
              </div>
              <p className="small muted" style={{ fontSize: '0.8rem' }}>Chefs & waiters need this code to log into your restaurant.</p>
            </div>
          )}
          <div className="small muted">{s.menuCount} menu items · {restaurant.tableCount} tables · {s.staffCount} staff</div>
          <div className="row wrap">
            <Link className="btn sm" to="/app/menu">Edit menu</Link>
            <Link className="btn sm" to="/app/tables">Print QR codes</Link>
            <Link className="btn sm" to="/app/staff">Add staff</Link>
          </div>
        </div>
      </div>
    </>
  );
}
