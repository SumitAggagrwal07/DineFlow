import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Printer } from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import QRStyled from '../../components/QRStyled.jsx';

const DOTS = [['rounded', 'Rounded'], ['dots', 'Dots'], ['classy-rounded', 'Classy'], ['square', 'Square'], ['extra-rounded', 'Extra rounded']];
const CORNERS = [['extra-rounded', 'Extra rounded'], ['square', 'Square'], ['dot', 'Dot']];

const load = () => {
  try {
    return JSON.parse(localStorage.getItem('df_qr_style') || '{}');
  } catch {
    return {};
  }
};

export default function TablesQR() {
  const { restaurant, setRestaurant } = useAuth();
  const saved = useMemo(load, []);
  const [style, setStyle] = useState({
    fg: '#12211d',
    bg: '#ffffff',
    dots: 'rounded',
    corner: 'extra-rounded',
    useLogo: true,
    base: window.location.origin,
    ...saved,
  });
  const [tables, setTables] = useState(restaurant.tableCount);
  const refs = useRef({});

  const update = (patch) =>
    setStyle((s) => {
      const next = { ...s, ...patch };
      localStorage.setItem('df_qr_style', JSON.stringify(next));
      return next;
    });

  const base = style.base.replace(/\/+$/, '');
  const opts = { ...style, logo: style.useLogo && restaurant.logo ? restaurant.logo : '' };
  const wallUrl = `${base}/r/${restaurant.slug}`;
  const tableUrl = (n) => `${wallUrl}?table=${n}`;
  const isLocal = /localhost|127\.0\.0\.1/.test(base);

  const saveTables = async () => {
    try {
      const { data } = await api.put('/panel/restaurant', { tableCount: Number(tables) });
      setRestaurant(data);
      toast.success(`Now ${data.tableCount} tables`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const downloadAll = async () => {
    const keys = Object.keys(refs.current);
    for (const k of keys) {
      refs.current[k]?.download(k);
      await new Promise((r) => setTimeout(r, 350)); // browsers drop downloads fired in the same tick
    }
  };

  const list = Array.from({ length: restaurant.tableCount }, (_, i) => i + 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tables and QR codes</h1>
          <p className="muted">One QR per table, plus a wall QR that shows the menu only.</p>
        </div>
        <div className="row no-print">
          <button className="btn" onClick={downloadAll}><Download size={16} /> Download all</button>
          <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> Print sheet</button>
        </div>
      </div>

      <div className="qr-layout">
        <div className="card stack no-print">
          <h3>Style</h3>
          <div className="field">
            <label htmlFor="tc">Number of tables</label>
            <div className="row">
              <input id="tc" className="input" type="number" min={1} max={200} value={tables} onChange={(e) => setTables(e.target.value)} />
              <button className="btn" onClick={saveTables} disabled={Number(tables) === restaurant.tableCount}>Save</button>
            </div>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="fg">QR colour</label><input id="fg" className="input" type="color" value={style.fg} onChange={(e) => update({ fg: e.target.value })} /></div>
            <div className="field"><label htmlFor="bg">Background</label><input id="bg" className="input" type="color" value={style.bg} onChange={(e) => update({ bg: e.target.value })} /></div>
          </div>
          <div className="field">
            <label htmlFor="dt">Dot shape</label>
            <select id="dt" className="input" value={style.dots} onChange={(e) => update({ dots: e.target.value })}>
              {DOTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cs">Corner shape</label>
            <select id="cs" className="input" value={style.corner} onChange={(e) => update({ corner: e.target.value })}>
              {CORNERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <label className="switch"><input type="checkbox" checked={style.useLogo} onChange={(e) => update({ useLogo: e.target.checked })} /> Put my logo in the centre</label>
          {style.useLogo && !restaurant.logo && (
            <p className="hint">You have not uploaded a logo yet. <Link to="/app/settings" style={{ color: 'var(--accent)' }}>Add one in Settings</Link>.</p>
          )}
          <div className="field">
            <label htmlFor="base">Website address in the QR</label>
            <input id="base" className="input" value={style.base} onChange={(e) => update({ base: e.target.value })} />
            {isLocal ? (
              <span className="hint" style={{ color: 'var(--accent)' }}>
                This address only works on this computer. Before printing, use your live domain, or your computer's network address (for example http://192.168.1.20:5173) to test with a phone on the same Wi-Fi.
              </span>
            ) : (
              <span className="hint">Guests will open this address when they scan.</span>
            )}
          </div>
          <p className="hint">Keep the contrast high between colour and background so every phone can scan it.</p>
        </div>

        <div className="qr-grid">
          <div className="qr-card wall-card">
            <QRStyled ref={(r) => (refs.current['wall-menu'] = r)} data={wallUrl} size={190} opts={opts} />
            <b>Wall / entrance</b>
            <span className="cap">{restaurant.name}<br />Scan to see the menu and what's available</span>
            <button className="btn sm" onClick={() => refs.current['wall-menu']?.download(`${restaurant.slug}-wall`)}><Download size={14} /> PNG</button>
          </div>
          {list.map((n) => (
            <div className="qr-card" key={n}>
              <div className="qr-table-tag" style={{ background: 'var(--brand-primary)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontWeight: 800, fontSize: '0.85rem', marginBottom: 4 }}>
                TABLE {n}
              </div>
              <QRStyled ref={(r) => (refs.current[`${restaurant.slug}-table-${n}`] = r)} data={tableUrl(n)} size={190} opts={opts} />
              <b>Table {n}</b>
              <span className="cap">{restaurant.name}<br />Scan to order at Table {n}</span>
              <button className="btn sm" onClick={() => refs.current[`${restaurant.slug}-table-${n}`]?.download(`${restaurant.slug}-table-${n}`)}><Download size={14} /> PNG</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
