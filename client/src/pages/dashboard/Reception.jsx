import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  QrCode,
  Sparkles,
  Phone,
  Utensils,
  Receipt,
  UserCheck
} from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import { useSocket } from '../../socket.jsx';
import { money, timeOf, since } from '../../util';
import { Modal, Spinner } from '../../components/ui.jsx';

export default function Reception() {
  const { restaurant } = useAuth();
  const socket = useSocket();

  const [waiting, setWaiting] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('waiting'); // 'waiting' | 'orders' | 'history'

  // Add waiting customer modal
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ customerName: '', phone: '', partySize: 2, notes: '', estimatedWaitMinutes: 15 });
  const [busy, setBusy] = useState(false);

  // Seat customer modal
  const [seatModalEntry, setSeatModalEntry] = useState(null);
  const [seatTable, setSeatTable] = useState(1);

  const cur = restaurant?.currency || '₹';

  const loadData = useCallback(async () => {
    try {
      const [wRes, oRes, hRes] = await Promise.all([
        api.get('/panel/waiting'),
        api.get('/panel/orders'),
        api.get('/panel/waiting/history'),
      ]);
      setWaiting(wRes.data);
      setActiveOrders(oRes.data);
      setHistory(hRes.data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Socket events
  useEffect(() => {
    if (!socket) return;
    const onWaitingNew = (entry) => {
      setWaiting((l) => [entry, ...l.filter((x) => x._id !== entry._id)]);
      toast(`New Waiting Customer: ${entry.customerName} (${entry.partySize} guests)`, { icon: '📋' });
    };
    const onWaitingUpdate = (entry) => {
      setWaiting((l) => (entry.status === 'waiting' ? l.map((x) => (x._id === entry._id ? entry : x)) : l.filter((x) => x._id !== entry._id)));
      setHistory((l) => [entry, ...l.filter((x) => x._id !== entry._id)]);
    };
    const onOrderUpdate = (o) => {
      setActiveOrders((list) => [o, ...list.filter((x) => x._id !== o._id)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    };

    socket.on('waiting:new', onWaitingNew);
    socket.on('waiting:update', onWaitingUpdate);
    socket.on('order:update', onOrderUpdate);
    socket.on('order:new', onOrderUpdate);

    return () => {
      socket.off('waiting:new', onWaitingNew);
      socket.off('waiting:update', onWaitingUpdate);
      socket.off('order:update', onOrderUpdate);
      socket.off('order:new', onOrderUpdate);
    };
  }, [socket]);

  // Calculate smart estimated wait time for new table
  // Look at currently cooking / active orders and find when next table frees up + 10 min
  const calculateSmartWaitMinutes = () => {
    const cooking = activeOrders.filter((o) => ['preparing', 'placed'].includes(o.status));
    if (cooking.length === 0) return 10;
    // Find min remaining time from cooking orders
    let minRemaining = 15;
    for (const o of cooking) {
      if (o.etaAt) {
        const rem = Math.max(0, Math.ceil((new Date(o.etaAt) - Date.now()) / 60000));
        if (rem < minRemaining) minRemaining = rem;
      }
    }
    return minRemaining + 10; // add 10 min buffer as requested!
  };

  const openAddCustomer = () => {
    const smartWait = calculateSmartWaitMinutes();
    setForm({ customerName: '', phone: '', partySize: 2, notes: '', estimatedWaitMinutes: smartWait });
    setAddModal(true);
  };

  const createWaitingEntry = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/panel/waiting', form);
      setWaiting((l) => [...l, data]);
      setAddModal(false);
      toast.success(`${data.customerName} added to waiting list! Est. ${data.estimatedWaitMinutes} min`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const seatCustomer = async () => {
    if (!seatModalEntry) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/panel/waiting/${seatModalEntry._id}`, {
        status: 'seated',
        tableNumber: seatTable,
      });
      setWaiting((l) => l.filter((x) => x._id !== data._id));
      setHistory((l) => [data, ...l]);
      toast.success(`${seatModalEntry.customerName} seated at Table ${seatTable}!`);
      setSeatModalEntry(null);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelWaiting = async (entry, status = 'cancelled') => {
    try {
      const { data } = await api.patch(`/panel/waiting/${entry._id}`, { status });
      setWaiting((l) => l.filter((x) => x._id !== data._id));
      setHistory((l) => [data, ...l]);
      toast(status === 'no_show' ? 'Marked as No Show' : 'Customer removed from waiting list');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  // Receptionist / Cashier can mark cash payment collected
  const markCashPaid = async (order) => {
    try {
      const { data } = await api.patch(`/panel/orders/${order._id}/pay`, { method: 'cash' });
      setActiveOrders((l) => l.map((o) => (o._id === data._id ? data : o)));
      toast.success(`Payment confirmed for Table ${order.tableNumber} (${money(order.total, cur)})`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (loading) return <Spinner />;

  // Busy tables vs free tables
  const occupiedTables = new Set(
    activeOrders.filter((o) => ['placed', 'preparing', 'ready', 'served'].includes(o.status) && o.payment?.status !== 'paid').map((o) => o.tableNumber)
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <UserCheck size={28} style={{ color: 'var(--brand-primary)' }} />
            <h1>Reception & Front Desk</h1>
          </div>
          <p className="muted">
            Manage customer arrivals, table assignments, smart waiting list time calculations & counter cash settlements.
          </p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn primary" onClick={openAddCustomer}>
            <Plus size={16} /> Add Waiting Customer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="c-tabs" style={{ maxWidth: 540, marginBottom: 18 }}>
        <button className={tab === 'waiting' ? 'on' : ''} onClick={() => setTab('waiting')}>
          Waiting List ({waiting.length})
        </button>
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>
          Counter Cash & Orders ({activeOrders.filter((o) => o.payment?.status !== 'paid' && o.status !== 'cancelled').length})
        </button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
          Seated History ({history.length})
        </button>
      </div>

      {/* TAB 1: WAITING LIST */}
      {tab === 'waiting' && (
        <div className="stack" style={{ gap: 16 }}>
          {/* Table summary bar */}
          <div className="card" style={{ background: 'var(--bg2)', padding: 14 }}>
            <div className="row between wrap" style={{ gap: 10 }}>
              <div>
                <b>Table Occupancy:</b> {occupiedTables.size} of {restaurant?.tableCount || 10} tables occupied
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                {Array.from({ length: restaurant?.tableCount || 8 }, (_, i) => i + 1).map((t) => {
                  const isOcc = occupiedTables.has(t);
                  return (
                    <span
                      key={t}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: isOcc ? '#ef444426' : '#10b98126',
                        color: isOcc ? '#ef4444' : '#10b981',
                        border: `1px solid ${isOcc ? '#ef444455' : '#10b98155'}`,
                      }}
                    >
                      T{t} {isOcc ? '• Busy' : '• Free'}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {waiting.length === 0 ? (
            <div className="card empty">
              <h3>No customers waiting right now</h3>
              <p className="muted">Click "Add Waiting Customer" or customers can scan the Wall QR to join the queue.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {waiting.map((entry, idx) => (
                <div
                  key={entry._id}
                  className="card"
                  style={{
                    background: 'var(--panel)',
                    border: '1.5px solid var(--line)',
                    borderRadius: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div className="row between">
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span
                        style={{
                          background: 'var(--brand-primary)',
                          color: '#fff',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <b style={{ fontSize: '1.1rem' }}>{entry.customerName}</b>
                    </div>
                    {entry.source === 'qr' && (
                      <span className="pill warn" style={{ fontSize: '0.72rem' }}>
                        <QrCode size={12} /> Wall QR Request
                      </span>
                    )}
                  </div>

                  <div className="small muted stack" style={{ gap: 4 }}>
                    {entry.phone && (
                      <div className="row" style={{ gap: 6 }}>
                        <Phone size={14} /> {entry.phone}
                      </div>
                    )}
                    <div className="row" style={{ gap: 6 }}>
                      <Users size={14} /> <b>{entry.partySize} Guests</b>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <Clock size={14} /> Joined {since(entry.createdAt)} · Est. Wait:{' '}
                      <b style={{ color: 'var(--brand-primary)' }}>{entry.estimatedWaitMinutes} mins</b>
                    </div>
                    {entry.notes && <div style={{ color: '#eab308' }}>Note: “{entry.notes}”</div>}
                  </div>

                  <div className="row wrap" style={{ marginTop: 'auto', gap: 8, paddingTop: 8, borderTop: '1px dashed var(--line)' }}>
                    <button
                      className="btn primary sm grow"
                      onClick={() => {
                        // find first unoccupied table
                        const freeTable = Array.from({ length: restaurant?.tableCount || 8 }, (_, i) => i + 1).find((t) => !occupiedTables.has(t)) || 1;
                        setSeatTable(freeTable);
                        setSeatModalEntry(entry);
                      }}
                    >
                      <CheckCircle2 size={15} /> Seat at Table
                    </button>
                    <button className="btn sm ghost" onClick={() => cancelWaiting(entry, 'no_show')}>
                      No Show
                    </button>
                    <button className="btn sm danger ghost" onClick={() => cancelWaiting(entry, 'cancelled')}>
                      <XCircle size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE ORDERS & COUNTER CASH TICKING */}
      {tab === 'orders' && (
        <div className="stack" style={{ gap: 14 }}>
          <p className="small muted">
            Receptionist & Owner can tick any order when customer pays cash at the counter or card terminal.
          </p>

          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Bill No</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Order Status</th>
                  <th>Payment Status</th>
                  <th>Counter Action</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders
                  .filter((o) => o.status !== 'cancelled')
                  .slice(0, 50)
                  .map((o) => {
                    const isPaid = o.payment?.status === 'paid';
                    return (
                      <tr key={o._id}>
                        <td>
                          <b>Table {o.tableNumber}</b>
                        </td>
                        <td>{o.billNo}</td>
                        <td>{o.customerName || 'Guest'}</td>
                        <td>
                          <b>{money(o.total, cur)}</b>
                        </td>
                        <td>
                          <span className={`pill ${o.status === 'served' ? 'good' : o.status === 'ready' ? 'good' : 'warn'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <span className={`pill ${isPaid ? 'good' : 'bad'}`}>
                            {isPaid ? `Paid (${o.payment.method})` : 'Unpaid'}
                          </span>
                        </td>
                        <td>
                          {!isPaid ? (
                            <button className="btn sm good" onClick={() => markCashPaid(o)}>
                              <CheckCircle2 size={14} /> Tick as Paid (Cash / Counter)
                            </button>
                          ) : (
                            <span className="small muted">✓ Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SEATED HISTORY */}
      {tab === 'history' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Party</th>
                  <th>Assigned Table</th>
                  <th>Wait Time</th>
                  <th>Status</th>
                  <th>Handled By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id}>
                    <td>{timeOf(h.createdAt)}</td>
                    <td>
                      <b>{h.customerName}</b>
                    </td>
                    <td>{h.partySize} guests</td>
                    <td>{h.tableNumber ? `Table ${h.tableNumber}` : '—'}</td>
                    <td>{h.estimatedWaitMinutes} mins</td>
                    <td>
                      <span className={`pill ${h.status === 'seated' ? 'good' : 'bad'}`}>{h.status}</span>
                    </td>
                    <td>{h.servedBy?.name || 'Reception'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Customer */}
      {addModal && (
        <Modal title="Add Customer to Waiting List" onClose={() => setAddModal(false)}>
          <form className="stack" onSubmit={createWaitingEntry}>
            <div className="field">
              <label>Customer Name</label>
              <input
                className="input"
                required
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Guest name"
                autoFocus
              />
            </div>
            <div className="row wrap" style={{ gap: 12 }}>
              <div className="field grow">
                <label>Phone Number (optional)</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 00000"
                />
              </div>
              <div className="field" style={{ width: 120 }}>
                <label>Party Size</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={30}
                  value={form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg2)', padding: 12 }}>
              <div className="field">
                <label>
                  Estimated Wait Time (mins) <small className="muted">— auto-calculated + 10 min buffer</small>
                </label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={180}
                  value={form.estimatedWaitMinutes}
                  onChange={(e) => setForm({ ...form, estimatedWaitMinutes: Number(e.target.value) })}
                />
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>
                Based on current kitchen orders completing in approx. {Math.max(1, form.estimatedWaitMinutes - 10)} min + 10 min table prep.
              </div>
            </div>

            <div className="field">
              <label>Special Requests / Notes</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="High chair needed, window table, birthday..."
              />
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setAddModal(false)}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? 'Adding…' : 'Add to Queue'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Seat Customer */}
      {seatModalEntry && (
        <Modal title={`Seat ${seatModalEntry.customerName}`} onClose={() => setSeatModalEntry(null)}>
          <div className="stack" style={{ gap: 16 }}>
            <div>
              Party of <b>{seatModalEntry.partySize} guests</b>. Choose which table to seat them at:
            </div>
            <div className="field">
              <label>Assign Table Number</label>
              <select className="input" value={seatTable} onChange={(e) => setSeatTable(Number(e.target.value))}>
                {Array.from({ length: restaurant?.tableCount || 8 }, (_, i) => i + 1).map((t) => (
                  <option key={t} value={t}>
                    Table {t} {occupiedTables.has(t) ? '(Currently Occupied)' : '(Free)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn ghost" onClick={() => setSeatModalEntry(null)}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy} onClick={seatCustomer}>
                {busy ? 'Seating…' : `Confirm Seat at Table ${seatTable}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
