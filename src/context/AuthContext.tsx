import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { INITIAL_USER } from '../data/mockData';
import { API_BASE } from '../config';

interface AuthContextType {
  user: User;
  isLoggedIn: boolean;
  login: (provider: 'google' | 'github', customName?: string, customEmail?: string) => Promise<void>;
  logout: () => Promise<void>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  viewMode: 'parent' | 'admin';
  setViewMode: (mode: 'parent' | 'admin') => void;
  phoneFrameMode: boolean;
  togglePhoneFrameMode: () => void;
  favorites: string[];
  toggleFavorite: (poiId: string) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('juntos_user');
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('juntos_dark') === 'true';
  });

  const [viewMode, setViewMode] = useState<'parent' | 'admin'>('parent');
  const [phoneFrameMode, setPhoneFrameMode] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('juntos_favs');
    return saved ? JSON.parse(saved) : ['poi-planetario-braga', 'poi-parque-ponte'];
  });

  // Apply dark mode class to <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('juntos_dark', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('juntos_dark', 'false');
    }
  }, [isDarkMode]);

  // Sync user to storage
  useEffect(() => {
    localStorage.setItem('juntos_user', JSON.stringify(user));
  }, [user]);

  // Sync favorites
  useEffect(() => {
    localStorage.setItem('juntos_favs', JSON.stringify(favorites));
  }, [favorites]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const togglePhoneFrameMode = () => setPhoneFrameMode((prev) => !prev);

  const toggleFavorite = (poiId: string) => {
    setFavorites((prev) => {
      if (prev.includes(poiId)) {
        return prev.filter((id) => id !== poiId);
      } else {
        return [...prev, poiId];
      }
    });
  };

  const login = async (provider: 'google' | 'github', customName?: string, customEmail?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          name: customName,
          email: customEmail,
          role: provider === 'google' ? 'admin' : 'curator',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { user: User };
        setUser(data.user);
        setAuthModalOpen(false);
      }
    } catch {
      // Fallback
      setUser({
        id: `usr-${Date.now()}`,
        name: customName || (provider === 'google' ? 'Marta Ferreira (Google)' : 'Sandro Dev (GitHub)'),
        email: customEmail || (provider === 'google' ? 'smpsandro1239@gmail.com' : 'sandro@github.com'),
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD777yteutiVWDrQ1kHg2U1_eXRXlpuiW3d6Bhzb-dIhRY9f-SIWYEaD7T6gTUiykdccClFIzDvD0P8XLNhVWFlrrCi16NgylBxFM0Wd_laBk37KoIVFk_rDzriDRPaJyuiVHnPoDuM19_OUx1Fhz-ME0AFLWhYUCL21r6IuxcVb1mjz8n5ZPIXycM0LjB9pgJ5rOEZUcbx8Y-aw4Bj4G1yCIS4wv_tm21PNb8j0Tul_y6vuYciyR3PoQ',
        role: 'admin',
        provider,
        trustScore: 98,
        familyProfile: {
          city: 'Braga',
          favorites: ['poi-planetario-braga', 'poi-parque-ponte'],
          children: [
            { id: 'c1', name: 'Alice', age: 4 },
            { id: 'c2', name: 'Tomás', age: 7 },
          ],
          maxBudget: 40,
        },
      });
      setAuthModalOpen(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore
    }
    setUser({
      ...INITIAL_USER,
      name: 'Família Visitante',
      email: '',
      provider: 'guest',
      role: 'parent',
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: user.provider !== 'guest',
        login,
        logout,
        isDarkMode,
        toggleDarkMode,
        viewMode,
        setViewMode,
        phoneFrameMode,
        togglePhoneFrameMode,
        favorites,
        toggleFavorite,
        authModalOpen,
        setAuthModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
