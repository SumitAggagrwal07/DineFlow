import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const homeFor = (role) =>
  role === 'superadmin' ? '/app/admin' : role === 'owner' ? '/app' : role === 'receptionist' ? '/app/reception' : '/app/orders';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('df_token'));

  useEffect(() => {
    if (!localStorage.getItem('df_token')) return;
    api
      .get('/auth/me')
      .then(({ data }) => {
        setUser(data.user);
        setRestaurant(data.restaurant);
      })
      .catch(() => localStorage.removeItem('df_token'))
      .finally(() => setLoading(false));
  }, []);

  const accept = useCallback((d) => {
    localStorage.setItem('df_token', d.token);
    setUser(d.user);
    setRestaurant(d.restaurant);
    return d.user;
  }, []);

  const login = useCallback(
    async (email, password, role, staffCode) =>
      accept((await api.post('/auth/login', { email, password, role, staffCode })).data),
    [accept]
  );
  const register = useCallback(async (body) => accept((await api.post('/auth/register', body)).data), [accept]);
  const logout = useCallback(() => {
    localStorage.removeItem('df_token');
    setUser(null);
    setRestaurant(null);
  }, []);

  const value = useMemo(
    () => ({ user, restaurant, setRestaurant, loading, login, register, logout }),
    [user, restaurant, loading, login, register, logout]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
