import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, UtensilsCrossed, QrCode, Users, Settings as Cog, ShieldCheck, LogOut, Menu as MenuIcon, UserCheck, History } from 'lucide-react';
import { useAuth } from '../../auth.jsx';
import { SocketProvider, useSocket } from '../../socket.jsx';
import { Brand, ThemeToggle } from '../../components/ui.jsx';
import { api } from '../../api';

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, roles: ['owner'], end: true },
  { to: '/app/reception', label: 'Reception & Queue', icon: UserCheck, roles: ['owner', 'receptionist'] },
  { to: '/app/orders', label: 'Orders', icon: ClipboardList, roles: ['owner', 'chef', 'waiter', 'receptionist'], badge: true },
  { to: '/app/history', label: 'Staff & Guests', icon: History, roles: ['owner', 'receptionist'] },
  { to: '/app/menu', label: 'Menu', icon: UtensilsCrossed, roles: ['owner', 'chef'] },
  { to: '/app/tables', label: 'Tables & QR', icon: QrCode, roles: ['owner'] },
  { to: '/app/staff', label: 'Staff Accounts', icon: Users, roles: ['owner'] },
  { to: '/app/settings', label: 'Settings', icon: Cog, roles: ['owner', 'receptionist'] },
  { to: '/app/admin', label: 'Restaurants', icon: ShieldCheck, roles: ['superadmin'] },
];

const ROLE_LABEL = { owner: 'Owner', chef: 'Chef', waiter: 'Waiter', receptionist: 'Receptionist', superadmin: 'Platform admin' };

function Shell() {
  const { user, restaurant, logout } = useAuth();
  const socket = useSocket();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [calls, setCalls] = useState(0);

  useEffect(() => setOpen(false), [loc.pathname]);

  // keep the "open requests" badge fresh
  useEffect(() => {
    if (!user.restaurant) return;
    const load = () => api.get('/panel/calls').then((r) => setCalls(r.data.length)).catch(() => {});
    load();
    if (!socket) return;
    socket.on('call:new', load);
    socket.on('call:update', load);
    return () => {
      socket.off('call:new', load);
      socket.off('call:update', load);
    };
  }, [socket, user.restaurant]);

  const links = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="app">
      <div className="topbar-m">
        <Brand />
        <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu"><MenuIcon size={18} /></button>
      </div>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <nav className="nav">
          {links.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={18} /> {label}
              {badge && calls > 0 && <span className="badge">{calls}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="row between">
            <span className="small muted">Theme</span>
            <ThemeToggle />
          </div>
          <div className="who">
            <b>{user.name}</b>
            <span className="small muted">{ROLE_LABEL[user.role]}{restaurant ? ` · ${restaurant.name}` : ''}</span>
          </div>
          <button className="btn ghost" onClick={() => { logout(); nav('/login'); }}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <SocketProvider>
      <Shell />
    </SocketProvider>
  );
}
