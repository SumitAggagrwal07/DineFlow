import axios from 'axios';
import { io } from 'socket.io-client';

// Leave VITE_API_URL empty to use the same origin (Vite proxy in dev, Express in production).
export const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('df_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && localStorage.getItem('df_token') && !url.startsWith('/auth/login')) {
      localStorage.removeItem('df_token');
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) =>
  e?.response?.data?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server' : e?.message) || 'Something went wrong';

export const makeSocket = (token) =>
  io(API_BASE || undefined, { auth: token ? { token } : {}, transports: ['websocket', 'polling'] });
