import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import { groupBy, money } from '../../util';
import { Modal, Spinner, VegDot } from '../../components/ui.jsx';

const BLANK = { name: '', description: '', price: '', category: 'Mains', veg: true, image: '', available: true, prepMinutes: 15 };

function ItemForm({ initial, categories, onSave, onClose }) {
  const [f, setF] = useState({ ...BLANK, ...initial });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(f);
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field"><label htmlFor="n">Dish name</label><input id="n" className="input" value={f.name} onChange={set('name')} required autoFocus /></div>
      <div className="field"><label htmlFor="d">Description</label><textarea id="d" className="input" value={f.description} onChange={set('description')} maxLength={300} /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="p">Price</label><input id="p" className="input" type="number" min={0} step="0.01" value={f.price} onChange={set('price')} required /></div>
        <div className="field">
          <label htmlFor="c">Category</label>
          <input id="c" className="input" list="cats" value={f.category} onChange={set('category')} required />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="t">Usual preparation (minutes)</label><input id="t" className="input" type="number" min={0} max={180} value={f.prepMinutes} onChange={set('prepMinutes')} /></div>
        <div className="field"><label htmlFor="i">Photo link (optional)</label><input id="i" className="input" type="url" placeholder="https://" value={f.image} onChange={set('image')} /></div>
      </div>
      <div className="row wrap" style={{ gap: 22 }}>
        <label className="switch"><input type="checkbox" checked={f.veg} onChange={set('veg')} /> Vegetarian</label>
        <label className="switch"><input type="checkbox" checked={f.available} onChange={set('available')} /> Available today</label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save dish'}</button>
      </div>
    </form>
  );
}

export default function MenuManager() {
  const { user, restaurant } = useAuth();
  const isOwner = user.role === 'owner';
  const cur = restaurant?.currency || '₹';
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (new) | item

  useEffect(() => {
    api.get('/panel/menu').then((r) => setItems(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const grouped = useMemo(() => groupBy(items || [], (i) => i.category), [items]);
  const categories = Object.keys(grouped);

  const save = async (f) => {
    const body = { ...f, price: Number(f.price), prepMinutes: Number(f.prepMinutes) };
    if (f._id) {
      const { data } = await api.put(`/panel/menu/${f._id}`, body);
      setItems((l) => l.map((i) => (i._id === data._id ? data : i)));
      toast.success('Dish updated');
    } else {
      const { data } = await api.post('/panel/menu', body);
      setItems((l) => [...l, data]);
      toast.success('Dish added');
    }
    setEditing(null);
  };

  const toggle = async (item) => {
    try {
      const { data } = await api.patch(`/panel/menu/${item._id}/availability`, { available: !item.available });
      setItems((l) => l.map((i) => (i._id === data._id ? data : i)));
      toast.success(data.available ? `${data.name} is back` : `${data.name} marked sold out`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async (item) => {
    if (!confirm(`Delete “${item.name}”?`)) return;
    try {
      await api.delete(`/panel/menu/${item._id}`);
      setItems((l) => l.filter((i) => i._id !== item._id));
      toast.success('Dish deleted');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!items) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Menu</h1>
          <p className="muted">{isOwner ? 'Changes show on guests\' phones straight away.' : 'Switch dishes off when the kitchen runs out.'}</p>
        </div>
        {isOwner && <button className="btn primary" onClick={() => setEditing({})}><Plus size={16} /> Add dish</button>}
      </div>

      {items.length === 0 && (
        <div className="card empty">
          <h3>Your menu is empty</h3>
          <p>Add your first dish so guests have something to order.</p>
          {isOwner && <button className="btn primary" style={{ marginTop: 14 }} onClick={() => setEditing({})}>Add a dish</button>}
        </div>
      )}

      {categories.map((cat) => (
        <section className="menu-cat" key={cat}>
          <h3>{cat}</h3>
          {grouped[cat].map((i) => (
            <div key={i._id} className={`m-item ${i.available ? '' : 'off'}`}>
              <VegDot veg={i.veg} />
              <div className="grow">
                <div className="nm">{i.name}</div>
                {i.description && <div className="small muted">{i.description}</div>}
              </div>
              <span className="price">{money(i.price, cur)}</span>
              <label className="switch" title="Available today">
                <input type="checkbox" checked={i.available} onChange={() => toggle(i)} aria-label={`${i.name} available`} />
              </label>
              {isOwner && (
                <>
                  <button className="icon-btn" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`}><Pencil size={16} /></button>
                  <button className="icon-btn" onClick={() => remove(i)} aria-label={`Delete ${i.name}`}><Trash2 size={16} /></button>
                </>
              )}
            </div>
          ))}
        </section>
      ))}

      {editing && (
        <Modal title={editing._id ? 'Edit dish' : 'Add dish'} onClose={() => setEditing(null)}>
          <ItemForm initial={editing} categories={categories} onSave={save} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}
