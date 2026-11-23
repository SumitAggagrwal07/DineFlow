import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BellRing,
  Droplets,
  Sparkles,
  Receipt,
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Utensils,
  History,
  Send,
  Flame,
  Check
} from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import { useSocket } from '../../socket.jsx';
import { chime, money, since, timeOf } from '../../util';
import Countdown from '../../components/Countdown.jsx';
import { Modal, Spinner } from '../../components/ui.jsx';

const PRESETS = [10, 15, 20, 30, 40];

export default function Orders() {
  const { user, restaurant } = useAuth();
  const socket = useSocket();
  const [orders, setOrders] = useState(null);
  const [calls, setCalls] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'placed', 'preparing', 'ready', 'closed'
  const [minutesInput, setMinutesInput] = useState({});
  const [busyId, setBusyId] = useState(null);
  const cur = restaurant?.currency || '₹';

  const isChef = user.role === 'chef';
  const isWaiter = user.role === 'waiter';
  const isOwner = user.role === 'owner';
  const isReception = user.role === 'receptionist';

  const load = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([api.get('/panel/orders'), api.get('/panel/calls')]);
      setOrders(o.data);
      setCalls(c.data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/panel/calls/history');
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
    if (isWaiter || isOwner) {
      loadHistory();
    }
  }, [load, loadHistory, isWaiter, isOwner]);

  useEffect(() => {
    if (!socket) return;
    const upsert = (o) =>
      setOrders((list) =>
        list
          ? [o, ...list.filter((x) => x._id !== o._id)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          : [o]
      );

    const onNew = (o) => {
      upsert(o);
      chime();
      toast(`New Order · Table ${o.tableNumber}`, { icon: '🧾' });
    };

    const onCallNew = (c) => {
      setCalls((l) => (l.some((x) => x._id === c._id) ? l : [...l, c]));
      const titles = {
        water: `Table ${c.tableNumber} requested ${c.quantity || 1} Water Bottle(s)!`,
        napkin: `Table ${c.tableNumber} requested ${c.quantity || 1} Napkins!`,
        bill: `Table ${c.tableNumber} requested bill payment`,
        help: `Table ${c.tableNumber} is calling for a waiter!`,
      };
      chime();
      toast(titles[c.type] || `Table ${c.tableNumber} needs service`, { icon: '🔔' });
      if (isWaiter || isOwner) loadHistory();
    };

    const onCallUpdate = (c) => {
      setCalls((l) => (c.status === 'resolved' ? l.filter((x) => x._id !== c._id) : l.map((x) => (x._id === c._id ? c : x))));
      if (isWaiter || isOwner) loadHistory();
    };

    const onAlertWaiter = (data) => {
      if (isWaiter || isOwner) {
        chime();
        toast.success(`🛎️ WAITER ALERT: Table ${data.tableNumber} order is READY! Please serve now.`, {
          duration: 7000,
          style: { background: '#10b981', color: '#fff', fontWeight: 800 },
        });
      }
    };

    const onAlertOwner = (data) => {
      if (isOwner) {
        toast(`✅ OWNER ALERT: Table ${data.tableNumber} order served by ${data.servedBy}`, {
          icon: '👏',
          duration: 5000,
        });
      }
    };

    socket.on('order:new', onNew);
    socket.on('order:update', upsert);
    socket.on('call:new', onCallNew);
    socket.on('call:update', onCallUpdate);
    socket.on('alert:waiter', onAlertWaiter);
    socket.on('alert:owner', onAlertOwner);
    socket.on('connect', load);

    return () => {
      socket.off('order:new', onNew);
      socket.off('order:update', upsert);
      socket.off('call:new', onCallNew);
      socket.off('call:update', onCallUpdate);
      socket.off('alert:waiter', onAlertWaiter);
      socket.off('alert:owner', onAlertOwner);
      socket.off('connect', load);
    };
  }, [socket, load, isWaiter, isOwner, loadHistory]);

  const onAction = async (kind, order, body) => {
    setBusyId(order._id);
    try {
      const { data } = await api.patch(`/panel/orders/${order._id}/${kind}`, body);
      setOrders((list) => list.map((o) => (o._id === data._id ? data : o)));
      if (kind === 'status' && body.status === 'ready') {
        toast.success(`Table ${order.tableNumber} marked READY. Waiter notified to pick up!`);
      } else if (kind === 'status' && body.status === 'served') {
        toast.success(`Table ${order.tableNumber} marked SERVED. Owner notified!`);
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async (call) => {
    try {
      await api.patch(`/panel/calls/${call._id}/resolve`);
      setCalls((l) => l.filter((c) => c._id !== call._id));
      toast.success(`Resolved Table ${call.tableNumber} request`);
      loadHistory();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remainingMin = (order) =>
    order.etaAt ? Math.max(0, Math.ceil((new Date(order.etaAt) - Date.now()) / 60000)) : 0;

  const counts = useMemo(() => {
    const list = orders || [];
    return {
      all: list.length,
      placed: list.filter((o) => o.status === 'placed').length,
      preparing: list.filter((o) => o.status === 'preparing').length,
      ready: list.filter((o) => o.status === 'ready').length,
      closed: list.filter((o) => ['served', 'cancelled'].includes(o.status)).length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const list = orders || [];
    if (activeTab === 'all') return list;
    if (activeTab === 'closed') return list.filter((o) => ['served', 'cancelled'].includes(o.status));
    return list.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  if (!orders) return <Spinner />;

  return (
    <>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            {isChef ? <ChefHat size={28} style={{ color: 'var(--brand-primary)' }} /> : <Utensils size={28} style={{ color: 'var(--brand-primary)' }} />}
            <h1>{isChef ? 'Kitchen Orders' : isWaiter ? 'Floor & Waiter Desk' : 'All Live Orders'}</h1>
          </div>
          <p className="muted">Live updates instant sync across kitchen, waiters & owner.</p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {(isWaiter || isOwner) && (
            <button className={`btn ${showHistory ? 'primary' : ''}`} onClick={() => setShowHistory((h) => !h)}>
              <History size={16} /> Service History ({history.length})
            </button>
          )}
        </div>
      </div>

      {/* Top Filter Buttons / Tabs (Cooking, Ready, Served, etc.) */}
      <div className="order-nav-tabs" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
        {[
          ['all', 'All Orders', counts.all],
          ['placed', 'New / Received', counts.placed],
          ['preparing', 'Cooking / In Progress', counts.preparing],
          ['ready', 'Ready for Waiter', counts.ready],
          ['closed', 'Served / Closed', counts.closed],
        ].map(([key, label, count]) => (
          <button
            key={key}
            className={`btn ${activeTab === key ? 'primary' : 'ghost'}`}
            style={{ borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap', padding: '8px 16px' }}
            onClick={() => setActiveTab(key)}
          >
            {key === 'preparing' && <Flame size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />}
            {key === 'ready' && <CheckCircle2 size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />}
            {label}
            <span
              style={{
                marginLeft: 8,
                background: activeTab === key ? '#ffffff33' : 'var(--line)',
                borderRadius: 20,
                padding: '2px 8px',
                fontSize: '0.8rem',
              }}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Live Service Calls Bar (Water bottle, napkins, call waiter, bill) */}
      {calls.length > 0 && (
        <div className="calls-strip" style={{ marginBottom: 18 }}>
          {calls.map((c) => {
            const isWater = c.type === 'water';
            const isNapkin = c.type === 'napkin';
            const isBill = c.type === 'bill';

            return (
              <div
                key={c._id}
                className={`call ${c.type}`}
                style={{
                  background: isWater ? '#3b82f61a' : isNapkin ? '#eab3081a' : isBill ? '#f2b13420' : '#ff7a6620',
                  border: `1.5px solid ${isWater ? '#3b82f6' : isNapkin ? '#eab308' : isBill ? '#f2b134' : '#ff7a66'}`,
                  borderRadius: 14,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {isWater ? (
                  <Droplets size={24} style={{ color: '#3b82f6' }} />
                ) : isNapkin ? (
                  <Sparkles size={24} style={{ color: '#eab308' }} />
                ) : isBill ? (
                  <Receipt size={24} style={{ color: '#f2b134' }} />
                ) : (
                  <BellRing size={24} style={{ color: 'var(--brand-primary)' }} />
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                    Table {c.tableNumber}
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, marginLeft: 8, color: 'var(--muted)' }}>
                      ({since(c.createdAt)})
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                    {isWater && `Bring ${c.quantity || 1} Water Bottle(s) (₹${(c.quantity || 1) * 20})`}
                    {isNapkin && `Bring ${c.quantity || 1} Napkins`}
                    {isBill && 'Customer requesting Bill Payment'}
                    {c.type === 'help' && 'Waiter requested at Table'}
                  </div>
                </div>

                {(isWaiter || isOwner) && (
                  <button className="btn sm primary" onClick={() => resolve(c)}>
                    <Check size={14} /> Mark Served
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Grid of Dishes & Orders */}
      {filteredOrders.length === 0 ? (
        <div className="card empty" style={{ padding: 40, textAlign: 'center' }}>
          <h3>No orders in this tab</h3>
          <p className="muted">Orders will appear here instantly when placed by customers.</p>
        </div>
      ) : (
        <div className="order-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredOrders.map((order) => {
            const isCooking = order.status === 'preparing';
            const isReady = order.status === 'ready';
            const isPlaced = order.status === 'placed';
            const isServed = order.status === 'served';
            const isCancelled = order.status === 'cancelled';
            const currentMins = minutesInput[order._id] !== undefined ? minutesInput[order._id] : (order.prepMinutes || 15);

            return (
              <div
                key={order._id}
                className="card"
                style={{
                  background: 'var(--panel)',
                  border: isReady ? '2px solid var(--accent-live)' : isCooking ? '2px solid var(--brand-primary)' : '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 18,
                  marginTop: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                }}
              >
                {/* Header: Table No, Guest name & Bill No */}
                <div className="row between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: 'var(--brand-primary)',
                          color: '#fff',
                          fontWeight: 900,
                          fontSize: '1.15rem',
                          padding: '4px 12px',
                          borderRadius: 8,
                          display: 'inline-block',
                        }}
                      >
                        Table {order.tableNumber}
                      </span>
                      {order.customerName && <b style={{ fontSize: '1.05rem' }}>{order.customerName}</b>}
                    </div>
                    <div className="small muted" style={{ marginTop: 6 }}>
                      {timeOf(order.createdAt)} · {order.billNo}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`pill ${isReady || isServed ? 'good' : isCooking ? 'warn' : isCancelled ? 'bad' : ''}`}
                    style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}
                  >
                    {order.status === 'placed' ? 'New Order' : order.status}
                  </span>
                </div>

                {/* Live Countdown if Cooking */}
                {isCooking && (
                  <div style={{ background: 'var(--bg2)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
                    <Countdown startedAt={order.startedAt} etaAt={order.etaAt} label="Kitchen Timer" />
                  </div>
                )}

                {/* Items List (styled nicely with portion tags) */}
                <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 12, border: '1px solid var(--line)' }}>
                  <div className="small muted" style={{ fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                    Order Dishes ({order.items.reduce((s, i) => s + i.qty, 0)} items):
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    {order.items.map((i, idx) => (
                      <div key={idx} className="row between" style={{ alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 800, color: 'var(--brand-primary)', marginRight: 6 }}>
                            {i.qty}×
                          </span>
                          <b>{i.name}</b>
                          {i.portion && (
                            <span className="pill" style={{ marginLeft: 6, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                              {i.portion}
                            </span>
                          )}
                          {i.note && <div className="small" style={{ color: '#eab308' }}>Note: “{i.note}”</div>}
                        </div>
                        <span style={{ fontWeight: 700 }}>{money(i.price * i.qty, cur)}</span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--line)', color: '#f59e0b', fontSize: '0.88rem' }}>
                      <b>Chef Instructions:</b> {order.notes}
                    </div>
                  )}
                </div>

                {/* Total & Payment info */}
                <div className="row between" style={{ fontWeight: 800, fontSize: '1.05rem', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
                  <span>Total Bill:</span>
                  <span>{money(order.total, cur)}</span>
                </div>

                <div className="row wrap" style={{ gap: 6 }}>
                  <span className={`pill ${order.payment?.status === 'paid' ? 'good' : 'warn'}`}>
                    {order.payment?.status === 'paid'
                      ? `Paid (${order.payment.method})`
                      : order.payment?.status === 'cash_requested'
                      ? 'Cash Requested'
                      : 'Unpaid'}
                  </span>
                </div>

                {/* Action Controls for Chef & Waiter */}
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  {/* CHEF: Accept and Start cooking timer */}
                  {isPlaced && (isChef || isOwner) && (
                    <div className="stack" style={{ gap: 8 }}>
                      <div className="small muted">Set Cooking Time:</div>
                      <div className="chips">
                        {PRESETS.map((p) => (
                          <button
                            key={p}
                            className={`chip ${currentMins === p ? 'on' : ''}`}
                            onClick={() => setMinutesInput((m) => ({ ...m, [order._id]: p }))}
                          >
                            {p} min
                          </button>
                        ))}
                      </div>
                      <div className="row">
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={180}
                          value={currentMins}
                          onChange={(e) => setMinutesInput((m) => ({ ...m, [order._id]: Number(e.target.value) }))}
                          style={{ width: 80 }}
                        />
                        <button
                          className="btn primary grow"
                          disabled={busyId === order._id}
                          onClick={() => onAction('prep', order, { minutes: currentMins })}
                        >
                          <Flame size={16} /> Start Cooking ({currentMins} min)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CHEF: Mark Ready (triggers live alert to Waiter) */}
                  {isCooking && (isChef || isOwner) && (
                    <div className="row wrap" style={{ gap: 8 }}>
                      <button
                        className="btn sm"
                        onClick={() => onAction('prep', order, { minutes: remainingMin(order) + 5 })}
                      >
                        +5m
                      </button>
                      <button
                        className="btn sm"
                        onClick={() => onAction('prep', order, { minutes: Math.max(1, remainingMin(order) - 5) })}
                      >
                        -5m
                      </button>
                      <button
                        className="btn primary grow"
                        style={{ background: 'var(--accent-live)', borderColor: 'var(--accent-live)', fontWeight: 800 }}
                        disabled={busyId === order._id}
                        onClick={() => onAction('status', order, { status: 'ready' })}
                      >
                        <BellRing size={16} /> Ready - Alert Waiter
                      </button>
                    </div>
                  )}

                  {/* WAITER: Mark Served (triggers live alert to Owner) */}
                  {isReady && (isWaiter || isOwner) && (
                    <button
                      className="btn primary block lg"
                      style={{ background: 'var(--brand-primary)', fontWeight: 800 }}
                      disabled={busyId === order._id}
                      onClick={() => onAction('status', order, { status: 'served' })}
                    >
                      <CheckCircle2 size={18} /> Order Served - Notify Owner
                    </button>
                  )}

                  {/* WAITER, OWNER & RECEPTIONIST: Payment collection if served or uncollected */}
                  {order.payment?.status !== 'paid' && (isWaiter || isOwner || isReception) && (
                    <div className="stack" style={{ gap: 6, marginTop: 6, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
                      <div className="small muted" style={{ fontWeight: 700 }}>Counter & Cash Payment Tick:</div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        <button className="btn sm good grow" onClick={() => onAction('pay', order, { method: 'cash' })}>
                          <CheckCircle2 size={14} /> Tick Paid Cash
                        </button>
                        <button className="btn sm grow" onClick={() => onAction('pay', order, { method: 'upi' })}>
                          UPI / Razorpay
                        </button>
                        <button className="btn sm grow" onClick={() => onAction('pay', order, { method: 'card' })}>
                          Card
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Service History Modal (Shows which table used water bottles, napkins, etc.) */}
      {showHistory && (
        <Modal title="Table Service Call History (Water, Napkins & Help)" onClose={() => setShowHistory(false)}>
          <div className="stack" style={{ gap: 12 }}>
            <p className="small muted">Complete log of all water bottles, napkins and waiter assistance requests.</p>

            {history.length === 0 ? (
              <div className="muted small">No service requests recorded yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Table</th>
                      <th>Request Item</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Served By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h._id}>
                        <td>{timeOf(h.createdAt)}</td>
                        <td><b>Table {h.tableNumber}</b></td>
                        <td>
                          {h.type === 'water' ? (
                            <span style={{ color: '#3b82f6', fontWeight: 700 }}>Water Bottle</span>
                          ) : h.type === 'napkin' ? (
                            <span style={{ color: '#eab308', fontWeight: 700 }}>Napkins</span>
                          ) : h.type === 'bill' ? (
                            <span style={{ color: '#f59e0b', fontWeight: 700 }}>Bill Request</span>
                          ) : (
                            <span style={{ fontWeight: 700 }}>Waiter Call</span>
                          )}
                        </td>
                        <td><b>{h.quantity || 1}</b></td>
                        <td>{h.type === 'water' ? `₹${(h.quantity || 1) * 20}` : 'Free'}</td>
                        <td>
                          <span className={`pill ${h.status === 'resolved' ? 'good' : 'warn'}`}>
                            {h.status === 'resolved' ? 'Served' : 'Pending'}
                          </span>
                        </td>
                        <td>{h.resolvedBy?.name || 'Staff'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
