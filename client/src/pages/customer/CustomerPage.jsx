import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BellRing, CheckCircle2, Search, ShoppingBag, Droplets, Sparkles, QrCode, CreditCard, Clock } from 'lucide-react';
import { api, errMsg, makeSocket } from '../../api';
import { groupBy, inkFor, money, timeOf } from '../../util';
import Countdown from '../../components/Countdown.jsx';
import { Modal, RestaurantLogo, Spinner, VegDot } from '../../components/ui.jsx';

const STEPS = [
  ['placed', 'Sent'],
  ['preparing', 'Cooking'],
  ['ready', 'Ready'],
  ['served', 'Served'],
];

const readTokens = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

function OrderCard({ order, restaurant, cur, onPay }) {
  const idx = STEPS.findIndex(([k]) => k === order.status);
  const paid = order.payment?.status === 'paid';
  const cash = order.payment?.status === 'cash_requested';

  const printBill = () => {
    window.print();
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row between">
        <div>
          <b>Table {order.tableNumber}</b>
          <div className="small muted">{timeOf(order.createdAt)} · {order.billNo}</div>
        </div>
        {order.status === 'cancelled' && <span className="pill bad">Cancelled</span>}
      </div>

      {order.status !== 'cancelled' && (
        <div className="status-track" aria-label={`Order status: ${order.status}`}>
          {STEPS.map(([k, label], i) => (
            <div key={k} className={i <= idx ? 'done' : ''}><i />{label}</div>
          ))}
        </div>
      )}

      {order.status === 'placed' && (
        <div className="banner warn" style={{ marginTop: 10 }}>
          <Clock size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Chef will confirm preparation time shortly. Order is in kitchen!
        </div>
      )}
      {order.status === 'preparing' && (
        <div className="on-dark" style={{ marginTop: 10 }}>
          <Countdown startedAt={order.startedAt} etaAt={order.etaAt} label="Your food will be ready in" />
        </div>
      )}
      {order.status === 'ready' && (
        <div className="banner" style={{ background: '#10b98122', borderColor: '#10b981', marginTop: 10, fontWeight: 700 }}>
          Your order is ready! Waiter is bringing it to your table.
        </div>
      )}
      {order.status === 'served' && <p className="muted small" style={{ marginTop: 8 }}>Enjoy your meal!</p>}

      {/* Structured Customer Tax Invoice / Bill */}
      <div className="bill printable-bill" style={{ marginTop: 16 }}>
        {/* Restaurant Header (Center) */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {restaurant?.name || 'Spice Route Kitchen'}
          </div>
          {restaurant?.address && <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 2 }}>{restaurant.address}</div>}
          {restaurant?.phone && <div style={{ fontSize: '0.78rem', color: '#555' }}>Tel: {restaurant.phone}</div>}
          <div style={{ fontSize: '0.75rem', fontWeight: 700, borderTop: '1px dashed var(--paper-line)', borderBottom: '1px dashed var(--paper-line)', margin: '8px 0', padding: '4px 0' }}>
            TAX INVOICE / GUEST BILL
          </div>
        </div>

        {/* Entry & Table Details */}
        <div style={{ fontSize: '0.82rem', marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
          <div><b>Table:</b> Table {order.tableNumber}</div>
          <div style={{ textAlign: 'right' }}><b>Bill No:</b> {order.billNo}</div>
          <div><b>Guest:</b> {order.customerName || 'Guest'}</div>
          <div style={{ textAlign: 'right' }}><b>Entry Time:</b> {timeOf(order.createdAt)}</div>
        </div>

        {/* Order Items Table */}
        <div style={{ borderTop: '1px solid var(--paper-line)', borderBottom: '1px solid var(--paper-line)', padding: '6px 0', margin: '6px 0' }}>
          <div className="ln" style={{ fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: '#444' }}>
            <span>Item & Qty</span>
            <span style={{ textAlign: 'right' }}>Price</span>
          </div>
          {order.items.map((i, k) => (
            <div className="ln" key={k} style={{ padding: '3px 0' }}>
              <span>
                <b>{i.qty}×</b> {i.name}
              </span>
              <span style={{ textAlign: 'right', fontWeight: 700 }}>
                {money(i.price * i.qty, cur)}
              </span>
            </div>
          ))}
        </div>

        {/* Calculation & GST Breakdown */}
        <div className="ln" style={{ marginTop: 4 }}>
          <span>Subtotal</span>
          <span>{money(order.subtotal, cur)}</span>
        </div>
        <div className="ln">
          <span>GST / Tax ({order.taxPercent}%)</span>
          <span>{money(order.tax, cur)}</span>
        </div>
        <div className="ln tot">
          <span>TOTAL BILL</span>
          <span>{money(order.total, cur)}</span>
        </div>

        {/* Payment Stamp or Action */}
        <div style={{ marginTop: 12 }}>
          {paid && (
            <div className="row between" style={{ background: '#d4efe0', padding: '8px 12px', borderRadius: 8 }}>
              <span className="stamp" style={{ borderColor: '#1b6b47', color: '#1b6b47' }}>PAID</span>
              <span className="small" style={{ fontWeight: 700 }}>{order.payment.method?.toUpperCase()} · {order.payment.reference}</span>
            </div>
          )}
          {cash && <div className="small" style={{ background: '#fbe9bf', padding: '6px 10px', borderRadius: 6, color: '#7a5600' }}>A waiter is coming to collect cash at your table.</div>}
          {!paid && !cash && order.status !== 'cancelled' && (
            <button className="btn primary block" onClick={() => onPay(order)}>
              Pay {money(order.total, cur)}
            </button>
          )}
        </div>

        {/* Bottom Message (Center) */}
        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 10, borderTop: '1px dashed var(--paper-line)' }}>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.05em' }}>VISIT AGAIN</div>
          <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 2 }}>Thank you for dining with us!</div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPage() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const storeKey = `df_orders_${slug}`;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('menu');
  // cart format: { [cartKey]: { item, portion: 'full' | 'half', qty: number, unitPrice: number } }
  const [cart, setCart] = useState({});
  const [q, setQ] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [name, setName] = useState(() => localStorage.getItem('df_guest_name') || '');
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [tokens, setTokens] = useState(() => readTokens(storeKey));
  const [orders, setOrders] = useState([]);
  const [payFor, setPayFor] = useState(null);
  const [method, setMethod] = useState('phonepe');
  const [paying, setPaying] = useState(false);
  const [help, setHelp] = useState('idle'); // idle | sent | coming
  const [orderModalItem, setOrderModalItem] = useState(null); // Item being configured in modal
  const [portionSelection, setPortionSelection] = useState({ full: 1, half: 0 }); // for configure modal
  const [waterModal, setWaterModal] = useState(false);
  const [waterQty, setWaterQty] = useState(1);
  const [napkinModal, setNapkinModal] = useState(false);
  const [napkinQty, setNapkinQty] = useState(4);
  const [tableRequestModal, setTableRequestModal] = useState(false);
  const [requestPartySize, setRequestPartySize] = useState(2);
  const [requestGuestName, setRequestGuestName] = useState(() => localStorage.getItem('df_guest_name') || '');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(null); // { waitMins, status }
  const prevStatus = useRef({});

  const r = data?.restaurant;
  const items = data?.items || [];
  const tp = parseInt(sp.get('table'), 10);
  const table = r && Number.isInteger(tp) && tp >= 1 && tp <= r.tableCount ? tp : null;
  const cur = r?.currency || '₹';

  const saveTokens = useCallback(
    (list) => {
      setTokens(list);
      localStorage.setItem(storeKey, JSON.stringify(list.slice(0, 20)));
    },
    [storeKey]
  );

  const loadMenu = useCallback(
    () =>
      api
        .get(`/public/r/${slug}`)
        .then((res) => setData(res.data))
        .catch((e) => setError(errMsg(e))),
    [slug]
  );

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const loadOrders = useCallback(async () => {
    if (!tokens.length) return setOrders([]);
    const res = await Promise.allSettled(tokens.map((t) => api.get(`/public/orders/${t}`)));
    const ok = [];
    const keep = [];
    res.forEach((x, i) => {
      if (x.status === 'fulfilled') {
        ok.push(x.value.data);
        keep.push(tokens[i]);
        prevStatus.current[x.value.data._id] = x.value.data.status;
      } else if (x.reason?.response?.status !== 404) keep.push(tokens[i]);
    });
    setOrders(ok.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    if (keep.length !== tokens.length) saveTokens(keep);
  }, [tokens, saveTokens]);

  useEffect(() => {
    loadOrders();
    const id = setInterval(loadOrders, 30000);
    return () => clearInterval(id);
  }, [loadOrders]);

  // live updates
  useEffect(() => {
    const s = makeSocket(null);
    const join = () => {
      s.emit('join:menu', slug);
      if (table) s.emit('join:table', { slug, table });
      tokens.forEach((t) => s.emit('join:order', t));
    };
    s.on('connect', join);
    s.on('menu:update', loadMenu);
    s.on('order:update', (o) => {
      const before = prevStatus.current[o._id];
      if (before && before !== o.status) {
        if (o.status === 'preparing') toast(`Kitchen accepted order! Est. ${o.prepMinutes} min.`, { icon: '👨‍🍳' });
        if (o.status === 'ready') toast.success('Your order is ready to serve!');
      }
      prevStatus.current[o._id] = o.status;
      setOrders((l) => l.map((x) => (x._id === o._id ? o : x)));
    });
    s.on('call:update', (c) => {
      if (c.status === 'resolved') {
        setHelp('coming');
        setTimeout(() => setHelp('idle'), 6000);
      }
    });
    return () => s.disconnect();
  }, [slug, table, tokens, loadMenu]);

  // Drop sold out items from cart
  useEffect(() => {
    setCart((c) => {
      const next = { ...c };
      let changed = false;
      for (const key of Object.keys(next)) {
        const entry = next[key];
        const it = items.find((i) => i._id === entry.item._id);
        if (!it || !it.available) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : c;
    });
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (!vegOnly || i.veg) && (!s || `${i.name} ${i.description} ${i.category}`.toLowerCase().includes(s)));
  }, [items, q, vegOnly]);
  const grouped = useMemo(() => groupBy(filtered, (i) => i.category), [filtered]);
  const cats = Object.keys(grouped);

  // Cart helper functions
  const openAddModal = (item) => {
    setOrderModalItem(item);
    // check existing full / half counts in cart
    const fullKey = `${item._id}_full`;
    const halfKey = `${item._id}_half`;
    setPortionSelection({
      full: cart[fullKey]?.qty || 1,
      half: cart[halfKey]?.qty || 0,
    });
  };

  const confirmAddToCart = () => {
    if (!orderModalItem) return;
    const item = orderModalItem;
    const fullKey = `${item._id}_full`;
    const halfKey = `${item._id}_half`;

    setCart((c) => {
      const next = { ...c };
      if (portionSelection.full > 0) {
        next[fullKey] = {
          item,
          portion: 'full',
          qty: portionSelection.full,
          unitPrice: item.price,
        };
      } else {
        delete next[fullKey];
      }

      if (portionSelection.half > 0) {
        next[halfKey] = {
          item,
          portion: 'half',
          qty: portionSelection.half,
          unitPrice: Math.round(item.price * 0.6),
        };
      } else {
        delete next[halfKey];
      }

      return next;
    });

    toast.success(`Updated order for ${item.name}`);
    setOrderModalItem(null);
  };

  const updateCartLineQty = (cartKey, delta) => {
    setCart((c) => {
      const current = c[cartKey];
      if (!current) return c;
      const nextQty = current.qty + delta;
      const next = { ...c };
      if (nextQty > 0) {
        next[cartKey] = { ...current, qty: Math.min(20, nextQty) };
      } else {
        delete next[cartKey];
      }
      return next;
    });
  };

  const lines = Object.values(cart);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const tax = (subtotal * (r?.taxPercent || 0)) / 100;

  // Place order
  const place = async () => {
    setPlacing(true);
    try {
      localStorage.setItem('df_guest_name', name);
      const { data: o } = await api.post(`/public/r/${slug}/orders`, {
        tableNumber: table,
        customerName: name,
        notes: note,
        items: lines.map((l) => ({
          menuItemId: l.item._id,
          qty: l.qty,
          portion: l.portion,
        })),
      });
      prevStatus.current[o._id] = o.status;
      setOrders((l) => [o, ...l]);
      saveTokens([o.accessToken, ...tokens]);
      setCart({});
      setNote('');
      setCartOpen(false);
      setTab('orders');
      toast.success('Order sent to the kitchen!');
    } catch (e) {
      toast.error(errMsg(e));
      loadMenu();
    } finally {
      setPlacing(false);
    }
  };

  // Staff calling buttons (waiter, water, napkin, bill)
  const callStaff = async (type, quantity = 1) => {
    try {
      await api.post(`/public/r/${slug}/calls`, { tableNumber: table, type, quantity });
      setHelp('sent');
      const messages = {
        bill: 'Waiter requested for bill',
        water: `Requested ${quantity} Water Bottle${quantity > 1 ? 's' : ''} (₹${quantity * 20})`,
        napkin: `Requested ${quantity} Napkins (Free)`,
        help: 'Waiter called to Table ' + table,
      };
      toast.success(messages[type] || 'Staff notified');
      setWaterModal(false);
      setNapkinModal(false);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const submitTableRequest = async (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('df_guest_name', requestGuestName);
      const res = await api.post(`/public/r/${slug}/request-table`, {
        customerName: requestGuestName,
        phone: requestPhone,
        partySize: requestPartySize,
      });
      setRequestSubmitted(res.data);
      toast.success(`Table request sent! Est wait: ${res.data.estimatedWaitMinutes} mins`);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const { data: o } = await api.post(`/public/orders/${payFor.accessToken}/pay`, { method });
      setOrders((l) => l.map((x) => (x._id === o._id ? o : x)));
      setPayFor(null);
      toast.success(o.payment.status === 'paid' ? 'Payment received. Thank you!' : 'A waiter will come to collect cash');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setPaying(false);
    }
  };

  if (error)
    return (
      <div className="splash">
        <div className="empty"><h3>This menu is not available</h3><p>{error}. Check the QR code or ask a member of staff.</p></div>
      </div>
    );
  if (!data) return <Spinner />;

  const showTabs = table || orders.length > 0;
  const ordering = !!table && r.isOpen;

  // calculate how many items total for a given item in cart
  const getItemCartSummary = (itemId) => {
    const full = cart[`${itemId}_full`]?.qty || 0;
    const half = cart[`${itemId}_half`]?.qty || 0;
    if (full > 0 && half > 0) return `${full} Full, ${half} Half`;
    if (full > 0) return `${full} Full`;
    if (half > 0) return `${half} Half`;
    return null;
  };

  return (
    <div className="cust" style={{ '--accent': r.accent, '--accent-ink': inkFor(r.accent) }}>
      <header className="c-head">
        <RestaurantLogo restaurant={r} />
        <div className="grow">
          <h1>{r.name}</h1>
          <div className="small muted">
            {table ? (
              <span className="pill good" style={{ fontWeight: 800, padding: '3px 10px', fontSize: '0.85rem' }}>
                📍 You are on Table {table}
              </span>
            ) : (
              'Menu'
            )}
            {r.address ? ` · ${r.address}` : ''}
          </div>
        </div>
      </header>

      <div className="c-body">
        {!r.isOpen && <div className="banner bad">This restaurant is not taking orders right now. You can still look at the menu.</div>}
        {r.isOpen && !table && (
          <div className="stack" style={{ gap: 10, marginBottom: 14 }}>
            <div className="banner warn" style={{ margin: 0 }}>
              {sp.get('table') ? `Table ${sp.get('table')} does not exist at this restaurant. ` : ''}
              You are viewing the menu only from the entrance or wall QR.
            </div>

            {requestSubmitted ? (
              <div className="card" style={{ background: '#10b98118', border: '1.5px solid #10b981', padding: 14 }}>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                  <div>
                    <b style={{ fontSize: '1.05rem' }}>Table Request Sent to Receptionist!</b>
                    <div className="small muted" style={{ marginTop: 2 }}>
                      Estimated Waiting Time:{' '}
                      <b style={{ color: 'var(--brand-primary)', fontSize: '1rem' }}>
                        ~{requestSubmitted.estimatedWaitMinutes} minutes
                      </b>
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>
                      Our receptionist will call your name when your table is prepared. Feel free to browse dishes below!
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: 14 }}>
                <div className="row between wrap" style={{ gap: 10, alignItems: 'center' }}>
                  <div>
                    <b>Need a Table?</b>
                    <div className="small muted">Request a table now — receptionist will calculate your wait time.</div>
                  </div>
                  <button className="btn primary sm" onClick={() => setTableRequestModal(true)}>
                    Request a Table
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Table Service buttons when seated */}
        {table && (
          <div className="card" style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '12px 14px', marginBottom: 14 }}>
            <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
              <div className="small muted" style={{ fontWeight: 700 }}>Quick Service for Table {table}</div>
              <span className="small muted">Need anything? Tap below</span>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <button className="btn sm" onClick={() => callStaff('help')}>
                <BellRing size={14} style={{ color: 'var(--brand-primary)' }} /> Call Waiter
              </button>
              <button className="btn sm" onClick={() => setWaterModal(true)}>
                <Droplets size={14} style={{ color: '#3b82f6' }} /> Water Bottle (₹20)
              </button>
              <button className="btn sm" onClick={() => setNapkinModal(true)}>
                <Sparkles size={14} style={{ color: '#eab308' }} /> Napkins (Free)
              </button>
            </div>
          </div>
        )}

        {showTabs && (
          <div className="c-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'menu'} className={tab === 'menu' ? 'on' : ''} onClick={() => setTab('menu')}>Menu</button>
            <button role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>My orders{orders.length ? ` (${orders.length})` : ''}</button>
          </div>
        )}

        {tab === 'menu' && (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="grow" style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--muted)' }} />
                <input className="input" style={{ paddingLeft: 36 }} placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search dishes" />
              </div>
              <button className={`chip ${vegOnly ? 'on' : ''}`} onClick={() => setVegOnly((v) => !v)} aria-pressed={vegOnly}>Veg only</button>
            </div>

            {cats.length > 1 && (
              <div className="cat-scroll">
                {cats.map((c) => (
                  <button key={c} className="chip" onClick={() => document.getElementById(`cat-${c}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{c}</button>
                ))}
              </div>
            )}

            {items.length === 0 && <div className="empty"><h3>The menu is being set up</h3><p>Please check back in a little while.</p></div>}
            {items.length > 0 && filtered.length === 0 && <div className="empty"><h3>No dishes match</h3><p>Try a different word or turn off the veg filter.</p></div>}

            {cats.map((c) => (
              <section key={c}>
                <h2 className="c-cat" id={`cat-${c}`}>{c}</h2>
                {grouped[c].map((i) => {
                  const summary = getItemCartSummary(i._id);
                  return (
                    <div className={`c-item ${i.available ? '' : 'sold'}`} key={i._id}>
                      <div className="info">
                        <div className="nm"><VegDot veg={i.veg} /> {i.name}</div>
                        {i.description && <div className="desc">{i.description}</div>}
                        <div className="pr">
                          <span>{money(i.price, cur)} <small className="muted" style={{ fontWeight: 400 }}>(Full)</small></span>
                          <span style={{ marginLeft: 10, fontSize: '0.88rem', color: 'var(--muted)' }}>
                            {money(Math.round(i.price * 0.6), cur)} <small>(Half)</small>
                          </span>
                        </div>
                        {summary && (
                          <div style={{ marginTop: 4 }}>
                            <span className="pill good" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                              In order: {summary}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="side">
                        {i.image && <img className="pic" src={i.image} alt="" loading="lazy" />}
                        {!i.available ? (
                          <span className="pill bad">Sold out</span>
                        ) : ordering ? (
                          <button className="add-btn" onClick={() => openAddModal(i)}>
                            {summary ? 'Edit order' : '+ Add in order'}
                          </button>
                        ) : (
                          <span className="pill good">Available</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </>
        )}

        {tab === 'orders' && (
          <>
            {orders.length === 0 && <div className="empty"><h3>No orders yet</h3><p>Add dishes from the menu and confirm your order.</p></div>}
            {orders.map((o) => (
              <OrderCard key={o._id} order={o} restaurant={r} cur={cur} onPay={(ord) => { setPayFor(ord); setMethod('phonepe'); }} />
            ))}
            {table && orders.some((o) => o.payment?.status !== 'paid' && o.status !== 'cancelled') && (
              <button className="btn block" onClick={() => callStaff('bill')} disabled={help === 'sent'}>
                Ask the waiter to bring the bill
              </button>
            )}
          </>
        )}
      </div>

      {table && (
        <button className={`help-fab ${help !== 'idle' ? 'sent' : ''} ${cartCount && tab === 'menu' ? '' : 'noCart'}`} onClick={() => callStaff('help')} disabled={help !== 'idle'}>
          {help === 'idle' ? <><BellRing size={18} /> Call waiter</> : <><CheckCircle2 size={18} /> {help === 'sent' ? 'Waiter notified' : 'Waiter is on the way'}</>}
        </button>
      )}

      {/* View Cart Bar */}
      {ordering && tab === 'menu' && cartCount > 0 && (
        <div className="cart-bar">
          <button className="btn primary lg" onClick={() => setCartOpen(true)}>
            <span><ShoppingBag size={18} style={{ verticalAlign: '-3px' }} /> Review Order · {cartCount} item{cartCount > 1 ? 's' : ''}</span>
            <b>{money(subtotal + tax, cur)}</b>
          </button>
        </div>
      )}

      {/* Add in order / Select Half & Full Modal */}
      {orderModalItem && (
        <Modal sheet title={`Select Portion: ${orderModalItem.name}`} onClose={() => setOrderModalItem(null)}>
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <VegDot veg={orderModalItem.veg} />
                <b>{orderModalItem.name}</b>
              </div>
              {orderModalItem.description && <div className="small muted" style={{ marginTop: 4 }}>{orderModalItem.description}</div>}
            </div>

            {/* Full Option */}
            <div className="card" style={{ background: 'var(--bg2)', padding: 12, border: '1px solid var(--line)' }}>
              <div className="row between">
                <div>
                  <b>Full Portion</b>
                  <div className="small muted">{money(orderModalItem.price, cur)} each</div>
                </div>
                <div className="stepper">
                  <button onClick={() => setPortionSelection((p) => ({ ...p, full: Math.max(0, p.full - 1) }))}>−</button>
                  <span>{portionSelection.full}</span>
                  <button onClick={() => setPortionSelection((p) => ({ ...p, full: Math.min(20, p.full + 1) }))}>+</button>
                </div>
              </div>
            </div>

            {/* Half Option */}
            <div className="card" style={{ background: 'var(--bg2)', padding: 12, border: '1px solid var(--line)' }}>
              <div className="row between">
                <div>
                  <b>Half Portion</b>
                  <div className="small muted">{money(Math.round(orderModalItem.price * 0.6), cur)} each</div>
                </div>
                <div className="stepper">
                  <button onClick={() => setPortionSelection((p) => ({ ...p, half: Math.max(0, p.half - 1) }))}>−</button>
                  <span>{portionSelection.half}</span>
                  <button onClick={() => setPortionSelection((p) => ({ ...p, half: Math.min(20, p.half + 1) }))}>+</button>
                </div>
              </div>
            </div>

            <div className="row between" style={{ fontWeight: 700, fontSize: '1.05rem', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span>Item Total</span>
              <span>{money(portionSelection.full * orderModalItem.price + portionSelection.half * Math.round(orderModalItem.price * 0.6), cur)}</span>
            </div>

            <button
              className="btn primary lg block"
              disabled={portionSelection.full === 0 && portionSelection.half === 0}
              onClick={confirmAddToCart}
            >
              Confirm and Add to Order
            </button>
          </div>
        </Modal>
      )}

      {/* Cart / Check the Order & Order Confirmed Modal */}
      {cartOpen && (
        <Modal sheet title={`Check Your Order (Table ${table})`} onClose={() => setCartOpen(false)}>
          <div className="stack">
            <div className="small muted" style={{ marginBottom: 4 }}>
              Please review all items and portions before confirming your order.
            </div>

            {lines.map((l) => {
              const cartKey = `${l.item._id}_${l.portion}`;
              return (
                <div className="row between" key={cartKey} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                  <div className="grow">
                    <VegDot veg={l.item.veg} /> <b>{l.item.name}</b>
                    <span className="pill" style={{ marginLeft: 6, fontSize: '0.72rem', textTransform: 'uppercase' }}>{l.portion}</span>
                    <div className="small muted">{money(l.unitPrice, cur)} each</div>
                  </div>
                  <div className="stepper">
                    <button onClick={() => updateCartLineQty(cartKey, -1)} aria-label="Decrease">−</button>
                    <span>{l.qty}</span>
                    <button onClick={() => updateCartLineQty(cartKey, 1)} aria-label="Increase">+</button>
                  </div>
                  <b style={{ minWidth: 70, textAlign: 'right' }}>{money(l.unitPrice * l.qty, cur)}</b>
                </div>
              );
            })}

            <div className="field">
              <label htmlFor="gn">Your name (optional)</label>
              <input id="gn" className="input" placeholder="Guest name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="gx">Special instructions / notes for chef</label>
              <input id="gx" className="input" placeholder="Less spicy, no onion, extra crispy…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
            </div>

            <div className="card" style={{ background: 'var(--panel2)', padding: 12 }}>
              <div className="row between"><span className="muted">Subtotal</span><span>{money(subtotal, cur)}</span></div>
              <div className="row between"><span className="muted">Tax ({r.taxPercent}%)</span><span>{money(tax, cur)}</span></div>
              <div className="row between" style={{ fontWeight: 800, fontSize: '1.15rem', marginTop: 6, borderTop: '1px dashed var(--line)', paddingTop: 6 }}>
                <span>Grand Total</span>
                <span>{money(subtotal + tax, cur)}</span>
              </div>
            </div>

            <button
              className="btn primary lg block"
              disabled={placing || cartCount === 0}
              onClick={place}
            >
              {placing ? 'Sending to Kitchen…' : 'Order Confirmed - Send to Chef'}
            </button>
          </div>
        </Modal>
      )}

      {/* Payment Modal with Business QR & Payment options */}
      {payFor && (
        <Modal sheet title={`Pay Bill: ${money(payFor.total, cur)}`} onClose={() => setPayFor(null)}>
          <div className="stack" style={{ gap: 14 }}>
            {/* Show restaurant business payment QR if uploaded */}
            {r.paymentQr ? (
              <div className="card" style={{ textAlign: 'center', background: '#fff', color: '#111', padding: 16, borderRadius: 14 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>
                  Scan Merchant QR to Pay
                </div>
                <img
                  src={r.paymentQr}
                  alt="Business Payment QR"
                  style={{ width: 180, height: 180, objectFit: 'contain', margin: '0 auto', display: 'block', borderRadius: 8, border: '1px solid #ddd' }}
                />
                <div className="small muted" style={{ marginTop: 6, color: '#444' }}>
                  Supports PhonePe, Google Pay, Apple Pay, Paytm & Cards
                </div>
              </div>
            ) : (
              <div className="banner warn" style={{ fontSize: '0.88rem' }}>
                <QrCode size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
                Scan and pay using any UPI app or card machine at the counter.
              </div>
            )}

            <div className="small muted" style={{ fontWeight: 700 }}>Choose payment method:</div>

            {[
              ['razorpay', 'Razorpay Gateway', 'Pay securely with UPI, NetBanking, Credit/Debit Cards, Wallets'],
              ['phonepe', 'PhonePe', 'Pay using PhonePe UPI or Wallet'],
              ['googlepay', 'Google Pay', 'Pay using GPay UPI'],
              ['applepay', 'Apple Pay', 'Pay with Apple Pay or Wallet'],
              ['card', 'Credit / Debit Card', 'Swipe or tap card with waiter'],
              ['cash', 'Cash at the table', 'A waiter will come to collect cash'],
            ].map(([v, label, sub]) => (
              <label key={v} className={`pay-opt ${method === v ? 'on' : ''}`}>
                <input type="radio" name="m" value={v} checked={method === v} onChange={() => setMethod(v)} />
                <div className="grow">
                  <b>{label}</b>
                  <div className="small muted">{sub}</div>
                </div>
              </label>
            ))}

            <button className="btn primary lg block" disabled={paying} onClick={pay}>
              {paying ? 'Processing…' : method === 'cash' ? 'Request Cash Collection' : `Complete Payment (${money(payFor.total, cur)})`}
            </button>
          </div>
        </Modal>
      )}

      {/* Water Bottle Request Modal */}
      {waterModal && (
        <Modal sheet title={`Water Bottle for Table ${table}`} onClose={() => setWaterModal(false)}>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card" style={{ background: 'var(--bg2)', padding: 14, border: '1px solid var(--line)' }}>
              <div className="row between" style={{ alignItems: 'center' }}>
                <div>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <Droplets size={20} style={{ color: '#3b82f6' }} />
                    <b>Chilled Mineral Water (1 Litre)</b>
                  </div>
                  <div className="small muted" style={{ marginTop: 4 }}>Price: ₹20 per bottle</div>
                </div>
                <div className="stepper">
                  <button onClick={() => setWaterQty((q) => Math.max(1, q - 1))}>−</button>
                  <span>{waterQty}</span>
                  <button onClick={() => setWaterQty((q) => Math.min(10, q + 1))}>+</button>
                </div>
              </div>
            </div>

            <div className="row between" style={{ fontWeight: 800, fontSize: '1.1rem', borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
              <span>Total Price:</span>
              <span style={{ color: 'var(--brand-primary)' }}>₹{waterQty * 20}</span>
            </div>

            <button className="btn primary lg block" onClick={() => callStaff('water', waterQty)}>
              Request {waterQty} Water Bottle{waterQty > 1 ? 's' : ''} (₹{waterQty * 20})
            </button>
          </div>
        </Modal>
      )}

      {/* Napkins Request Modal */}
      {napkinModal && (
        <Modal sheet title={`Napkins for Table ${table}`} onClose={() => setNapkinModal(false)}>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card" style={{ background: 'var(--bg2)', padding: 14, border: '1px solid var(--line)' }}>
              <div className="row between" style={{ alignItems: 'center' }}>
                <div>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <Sparkles size={20} style={{ color: '#eab308' }} />
                    <b>Fresh Tissue Napkins</b>
                  </div>
                  <div className="small muted" style={{ marginTop: 4 }}>Complimentary (Free)</div>
                </div>
                <div className="stepper">
                  <button onClick={() => setNapkinQty((q) => Math.max(2, q - 2))}>−</button>
                  <span>{napkinQty}</span>
                  <button onClick={() => setNapkinQty((q) => Math.min(20, q + 2))}>+</button>
                </div>
              </div>
            </div>

            <div className="row between" style={{ fontWeight: 800, fontSize: '1.1rem', borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
              <span>Total Price:</span>
              <span style={{ color: 'var(--accent-live)' }}>Free (₹0)</span>
            </div>

            <button className="btn primary lg block" onClick={() => callStaff('napkin', napkinQty)}>
              Request {napkinQty} Napkins
            </button>
          </div>
        </Modal>
      )}

      {/* Wall QR Request Table Modal */}
      {tableRequestModal && (
        <Modal sheet title={`Request a Table at ${r.name}`} onClose={() => setTableRequestModal(false)}>
          <form className="stack" onSubmit={(e) => { submitTableRequest(e); setTableRequestModal(false); }}>
            <div className="small muted">
              Our receptionist will review your request, calculate the wait time based on active tables (+10 min buffer), and queue you up!
            </div>
            <div className="field">
              <label>Your Name</label>
              <input
                className="input"
                required
                placeholder="Full name"
                value={requestGuestName}
                onChange={(e) => setRequestGuestName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="row wrap" style={{ gap: 10 }}>
              <div className="field grow">
                <label>Phone Number (optional)</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+91 98765 00000"
                  value={requestPhone}
                  onChange={(e) => setRequestPhone(e.target.value)}
                />
              </div>
              <div className="field" style={{ width: 120 }}>
                <label>Party Size</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={30}
                  value={requestPartySize}
                  onChange={(e) => setRequestPartySize(Number(e.target.value))}
                />
              </div>
            </div>
            <button className="btn primary lg block">
              Submit Table Request
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
