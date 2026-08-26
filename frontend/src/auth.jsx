// Authentication context: holds the signed in user, exposes login and logout,
// and opens one WebSocket per session that streams messages and notifications.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, clearTokens, getToken, setTokens, WS_URL } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const listenersRef = useRef(new Set());

  // Any component can subscribe to live events (messages, notifications).
  function subscribe(listener) {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }

  function openSocket() {
    const token = getToken();
    if (!token || socketRef.current) return;
    const socket = new WebSocket(`${WS_URL}/ws/stream/?token=${token}`);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        listenersRef.current.forEach((listener) => listener(payload));
      } catch {
        // Ignore malformed frames.
      }
    };
    socket.onclose = () => {
      socketRef.current = null;
      // Reconnect after a short pause while the user stays signed in.
      if (getToken()) setTimeout(openSocket, 4000);
    };
    socketRef.current = socket;
  }

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api("/auth/me/")
      .then((profile) => {
        setUser(profile);
        openSocket();
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    const data = await api("/auth/login/", { method: "POST", body: { email, password } });
    setTokens(data.access, data.refresh);
    setUser(data.user);
    openSocket();
    return data.user;
  }

  function adoptSession(data) {
    // Used by the set password page, which also returns tokens.
    setTokens(data.access, data.refresh);
    setUser(data.user);
    openSocket();
  }

  function logout() {
    clearTokens();
    setUser(null);
    if (socketRef.current) socketRef.current.close();
    socketRef.current = null;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, adoptSession, subscribe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Where each role lands after signing in.
export function homePathFor(role) {
  const map = {
    admin: "/admin",
    manager: "/manager",
    hospital_partner: "/hospital",
    customer_service: "/cs",
    field_staff: "/field",
    client: "/care",
    family: "/family",
  };
  return map[role] || "/login";
}
