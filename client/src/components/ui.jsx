import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, X } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('df_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('df_theme', theme);
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark"><i /></span>
      DineFlow
    </Link>
  );
}

export function Modal({ title, onClose, children, sheet = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className={`overlay ${sheet ? 'sheet-wrap' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${sheet ? 'sheet' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="splash"><div className="spinner" aria-label="Loading" /></div>;
}

export function RestaurantLogo({ restaurant }) {
  return (
    <div className="c-logo">
      {restaurant?.logo ? <img src={restaurant.logo} alt="" /> : (restaurant?.name || 'D').trim()[0]?.toUpperCase()}
    </div>
  );
}

export const VegDot = ({ veg }) => <span className={`dot ${veg ? '' : 'nonveg'}`} title={veg ? 'Veg' : 'Non-veg'} />;
