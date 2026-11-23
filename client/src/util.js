import { useEffect, useState } from 'react';

export const money = (n, cur = '₹') => {
  const v = Number(n || 0);
  return `${cur}${v.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

export const timeOf = (d) =>
  d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export const since = (d) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${m % 60} min ago`;
};

// Short two-tone chime for new orders / waiter calls.
let audioCtx;
export function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, now + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.28);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + i * 0.14);
      o.stop(now + i * 0.14 + 0.3);
    });
  } catch {
    /* audio is optional */
  }
}

export function fileToDataUrl(file, maxKB = 300) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file'));
    if (file.size > maxKB * 1024) return reject(new Error(`Image must be under ${maxKB} KB`));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
}

// Pick black or white text for a given background colour.
export const inkFor = (hex = '#f2b134') => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1a1206' : '#ffffff';
};

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const groupBy = (arr, keyFn) =>
  arr.reduce((acc, x) => {
    const k = keyFn(x);
    (acc[k] = acc[k] || []).push(x);
    return acc;
  }, {});
