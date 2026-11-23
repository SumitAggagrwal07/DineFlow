import { useNow } from '../util';

const mmss = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Live countdown to the time the kitchen promised (set by the chef).
export default function Countdown({ startedAt, etaAt, label = 'Ready in' }) {
  const now = useNow(1000);
  if (!etaAt) return null;
  const eta = new Date(etaAt).getTime();
  const start = startedAt ? new Date(startedAt).getTime() : eta - 15 * 60000;
  const remaining = eta - now;
  const total = Math.max(1, eta - start);
  const pct = Math.min(100, Math.max(0, ((now - start) / total) * 100));
  const late = remaining < 0;

  return (
    <div className={`timer ${late ? 'late' : ''}`}>
      <div className="small" style={{ opacity: 0.75 }}>{late ? 'Running late by' : label}</div>
      <div className="big">{mmss(Math.abs(remaining))}</div>
      <div className="bar"><i style={{ width: `${late ? 100 : pct}%` }} /></div>
    </div>
  );
}
