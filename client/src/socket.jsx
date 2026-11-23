import { createContext, useContext, useEffect, useState } from 'react';
import { makeSocket } from './api';

const Ctx = createContext(null);
export const useSocket = () => useContext(Ctx);

// One websocket for the whole staff dashboard. Authenticated, so the server
// puts it in this restaurant's private room.
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const s = makeSocket(localStorage.getItem('df_token'));
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);
  return <Ctx.Provider value={socket}>{children}</Ctx.Provider>;
}
