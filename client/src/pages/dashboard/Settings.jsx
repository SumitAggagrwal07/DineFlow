import { useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth.jsx';
import { fileToDataUrl } from '../../util';
import { RestaurantLogo } from '../../components/ui.jsx';

export default function Settings() {
  const { restaurant, setRestaurant } = useAuth();
  const [f, setF] = useState({
    name: restaurant.name,
    phone: restaurant.phone || '',
    address: restaurant.address || '',
    currency: restaurant.currency,
    taxPercent: restaurant.taxPercent,
    defaultPrepMinutes: restaurant.defaultPrepMinutes,
    accent: restaurant.accent,
    logo: restaurant.logo || '',
    paymentQr: restaurant.paymentQr || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const pickLogo = async (e) => {
    try {
      const url = await fileToDataUrl(e.target.files?.[0], 300);
      setF((p) => ({ ...p, logo: url }));
    } catch (err) {
      toast.error(err.message);
    }
    e.target.value = '';
  };

  const pickPaymentQr = async (e) => {
    try {
      const url = await fileToDataUrl(e.target.files?.[0], 600);
      setF((p) => ({ ...p, paymentQr: url }));
    } catch (err) {
      toast.error(err.message);
    }
    e.target.value = '';
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put('/panel/restaurant', {
        ...f,
        taxPercent: Number(f.taxPercent),
        defaultPrepMinutes: Number(f.defaultPrepMinutes),
      });
      setRestaurant(data);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Settings</h1><p className="muted">How your restaurant appears to guests, and how bills are calculated.</p></div>
      </div>

      <form className="card stack" onSubmit={save} style={{ maxWidth: 720 }}>
        <div className="row" style={{ gap: 16 }}>
          <RestaurantLogo restaurant={{ ...restaurant, logo: f.logo, name: f.name }} />
          <div className="stack" style={{ gap: 8 }}>
            <div className="row wrap">
              <label className="btn sm" style={{ cursor: 'pointer' }}>
                <ImagePlus size={14} /> {f.logo ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" onChange={pickLogo} hidden />
              </label>
              {f.logo && <button type="button" className="btn sm ghost" onClick={() => setF((p) => ({ ...p, logo: '' }))}><Trash2 size={14} /> Remove</button>}
            </div>
            <span className="hint">Square image under 300 KB. It appears on your menu page and in the middle of your QR codes.</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field"><label htmlFor="rn">Restaurant name</label><input id="rn" className="input" value={f.name} onChange={set('name')} required /></div>
          <div className="field"><label htmlFor="rp">Phone</label><input id="rp" className="input" value={f.phone} onChange={set('phone')} /></div>
        </div>
        <div className="field"><label htmlFor="ra">Address</label><input id="ra" className="input" value={f.address} onChange={set('address')} /></div>

        <div className="card" style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '16px' }}>
          <h4>Business Payment QR Code</h4>
          <p className="hint" style={{ marginBottom: 12 }}>Upload your PhonePe, Google Pay, Paytm, or UPI business QR code. This will be shown to customers when paying their bill.</p>
          <div className="row wrap" style={{ gap: 16, alignItems: 'center' }}>
            {f.paymentQr ? (
              <img src={f.paymentQr} alt="Business Payment QR" style={{ width: 120, height: 120, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 6, border: '1px solid var(--line)' }} />
            ) : (
              <div style={{ width: 120, height: 120, border: '2px dashed var(--line)', borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: 8 }}>
                No QR uploaded
              </div>
            )}
            <div className="stack" style={{ gap: 8 }}>
              <div className="row wrap">
                <label className="btn sm" style={{ cursor: 'pointer' }}>
                  <ImagePlus size={14} /> {f.paymentQr ? 'Change payment QR' : 'Upload business QR'}
                  <input type="file" accept="image/*" onChange={pickPaymentQr} hidden />
                </label>
                {f.paymentQr && (
                  <button type="button" className="btn sm ghost" onClick={() => setF((p) => ({ ...p, paymentQr: '' }))}>
                    <Trash2 size={14} /> Remove
                  </button>
                )}
              </div>
              <span className="hint">PNG or JPG of your merchant QR.</span>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="field"><label htmlFor="cu">Currency symbol</label><input id="cu" className="input" maxLength={4} value={f.currency} onChange={set('currency')} required /></div>
          <div className="field"><label htmlFor="tx">Tax on bills (%)</label><input id="tx" className="input" type="number" min={0} max={40} step="0.1" value={f.taxPercent} onChange={set('taxPercent')} /></div>
          <div className="field"><label htmlFor="dp">Default preparation time (minutes)</label><input id="dp" className="input" type="number" min={1} max={180} value={f.defaultPrepMinutes} onChange={set('defaultPrepMinutes')} /><span className="hint">Used when a dish has no time of its own. The chef can always change it per order.</span></div>
          <div className="field"><label htmlFor="ac">Menu page colour</label><input id="ac" className="input" type="color" value={f.accent} onChange={set('accent')} /></div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>
    </>
  );
}
