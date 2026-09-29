import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function getStorefrontSession() {
  const prefix = '#owner_session=';
  if (!window.location.hash.startsWith(prefix)) return null;
  try {
    const session = JSON.parse(atob(decodeURIComponent(window.location.hash.slice(prefix.length))));
    if (!session?.token || !session?.user?.id) return null;
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    return session;
  } catch {
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storefrontSession = getStorefrontSession();
    if (storefrontSession) {
      localStorage.setItem('ms_token', storefrontSession.token);
      localStorage.setItem('ms_user', JSON.stringify(storefrontSession.user));
      return storefrontSession.user;
    }
    try {
      return JSON.parse(localStorage.getItem('ms_user'));
    } catch {
      return null;
    }
  });

  const setAuth = (token, userData) => {
    localStorage.setItem('ms_token', token);
    localStorage.setItem('ms_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('ms_token');
    localStorage.removeItem('ms_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
