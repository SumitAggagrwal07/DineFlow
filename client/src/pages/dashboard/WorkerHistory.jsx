import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  History,
  Users,
  Award,
  Calendar,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Droplets,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import { money, timeOf } from '../../util';
import { Spinner } from '../../components/ui.jsx';

export default function WorkerHistory() {
  const { restaurant } = useAuth();
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('workers'); // 'workers' | 'customers' | 'services'
  const cur = restaurant?.currency || '₹';

  useEffect(() => {
    Promise.all([api.get('/panel/staff/history'), api.get('/panel/customers')])
      .then(([sRes, cRes]) => {
        setData(sRes.data);
        setCustomers(cRes.data);
      })
      .catch((e) => toast.error(errMsg(e)));
  }, []);

  if (!data) return <Spinner />;

  const { staff, servedOrders, resolvedCalls, waitingServed } = data;

  // Aggregate stats per worker
  const workerStats = staff.map((s) => {
    const ordersCount = servedOrders.filter((o) => o.status === 'served').length; // served pool
    const callsHandled = resolvedCalls.filter((c) => String(c.resolvedBy?._id) === String(s.id || s._id)).length;
    const waitingHandled = waitingServed.filter((w) => String(w.servedBy?._id) === String(s.id || s._id)).length;

    return {
      ...s,
      callsHandled,
      waitingHandled,
    };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <History size={28} style={{ color: 'var(--brand-primary)' }} />
            <h1>Staff & Customer Intelligence</h1>
          </div>
          <p className="muted">
            Track performance logs of Chefs, Waiters, Receptionists and Customer visit history with repeat loyalty.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="c-tabs" style={{ maxWidth: 500, marginBottom: 18 }}>
        <button className={activeTab === 'workers' ? 'on' : ''} onClick={() => setActiveTab('workers')}>
          Staff Activity Logs
        </button>
        <button className={activeTab === 'customers' ? 'on' : ''} onClick={() => setActiveTab('customers')}>
          Customer Visits ({customers.length})
        </button>
        <button className={activeTab === 'services' ? 'on' : ''} onClick={() => setActiveTab('services')}>
          Service Logs ({resolvedCalls.length})
        </button>
      </div>

      {/* TAB 1: WORKERS HISTORY */}
      {activeTab === 'workers' && (
        <div className="stack" style={{ gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {workerStats.map((w) => {
              const isChef = w.role === 'chef';
              const isWaiter = w.role === 'waiter';
              const isReception = w.role === 'receptionist';

              return (
                <div key={w.id || w._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row between">
                    <div>
                      <b style={{ fontSize: '1.15rem' }}>{w.name}</b>
                      <div className="small muted">
                        {w.role.toUpperCase()} {w.phone ? `· ${w.phone}` : ''}
                      </div>
                    </div>
                    <span className="pill" style={{ textTransform: 'capitalize' }}>
                      {w.role}
                    </span>
                  </div>

                  <div className="stack" style={{ gap: 6, marginTop: 8, background: 'var(--bg2)', padding: 12, borderRadius: 10 }}>
                    {isChef && (
                      <div className="row between small">
                        <span>Kitchen Active Role:</span>
                        <b>Prepares & times dishes</b>
                      </div>
                    )}
                    {isWaiter && (
                      <div className="row between small">
                        <span>Table Calls Resolved:</span>
                        <b style={{ color: 'var(--brand-primary)' }}>{w.callsHandled} requests</b>
                      </div>
                    )}
                    {isReception && (
                      <div className="row between small">
                        <span>Waiting Guests Seated:</span>
                        <b style={{ color: 'var(--accent-live)' }}>{w.waitingHandled} guests</b>
                      </div>
                    )}
                    <div className="row between small">
                      <span>Status:</span>
                      <span className={`pill ${w.active ? 'good' : 'bad'}`}>{w.active ? 'Active' : 'Disabled'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER VISITS */}
      {activeTab === 'customers' && (
        <div className="stack" style={{ gap: 14 }}>
          <p className="small muted">
            Track frequent diners, how many times they visited, tables they sat at, and total spent.
          </p>

          {customers.length === 0 ? (
            <div className="card empty">
              <h3>No customer records yet</h3>
              <p className="muted">Customer details are automatically compiled whenever guests place orders.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Total Visits</th>
                    <th>Total Amount Spent</th>
                    <th>Tables Used</th>
                    <th>Last Visit</th>
                    <th>Loyalty Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <b>{c.name}</b>
                      </td>
                      <td>
                        <span className="pill good">{c.visits} orders</span>
                      </td>
                      <td>
                        <b>{money(c.totalSpent, cur)}</b>
                      </td>
                      <td>{c.tables?.map((t) => `T${t}`).join(', ') || '—'}</td>
                      <td>{timeOf(c.lastVisit)}</td>
                      <td>
                        {c.visits >= 5 ? (
                          <span className="pill good">⭐ VIP Regular</span>
                        ) : c.visits >= 2 ? (
                          <span className="pill warn">Frequent Guest</span>
                        ) : (
                          <span className="pill">New Visitor</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESOLVED SERVICE CALLS */}
      {activeTab === 'services' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Table</th>
                  <th>Request Type</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Served By</th>
                </tr>
              </thead>
              <tbody>
                {resolvedCalls.map((c) => (
                  <tr key={c._id}>
                    <td>{timeOf(c.resolvedAt || c.createdAt)}</td>
                    <td>
                      <b>Table {c.tableNumber}</b>
                    </td>
                    <td>
                      {c.type === 'water' ? (
                        <span style={{ color: '#3b82f6', fontWeight: 700 }}>Water Bottle</span>
                      ) : c.type === 'napkin' ? (
                        <span style={{ color: '#eab308', fontWeight: 700 }}>Napkins</span>
                      ) : c.type === 'bill' ? (
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>Bill Payment</span>
                      ) : (
                        <span style={{ fontWeight: 700 }}>Waiter Call</span>
                      )}
                    </td>
                    <td>{c.quantity || 1}</td>
                    <td>{c.totalPrice ? money(c.totalPrice, cur) : c.type === 'water' ? money((c.quantity || 1) * 20, cur) : 'Free'}</td>
                    <td>
                      <span className="pill good">{c.resolvedBy?.name || 'Staff Member'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
