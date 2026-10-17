import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { INITIAL_USER } from '../data/mockData';
import { API_BASE } from '../config';

export type AuthModalView = 'login' | 'register' | 'forgot' | 'reset' | 'message';

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

interface AuthContextType {
  user: User;
  isLoggedIn: boolean;
  login: (provider: 'google' | 'github') => void;
  logout: () => Promise<void>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  viewMode: 'parent' | 'admin';
  setViewMode: (mode: 'parent' | 'admin') => void;
  phoneFrameMode: boolean;
  togglePhoneFrameMode: () => void;
  favorites: string[];
  toggleFavorite: (poiId: string) => void;
  deleteAccount: () => Promise<boolean>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalView: AuthModalView;
  setAuthModalView: (view: AuthModalView) => void;
  authModalMessage: string | null;
  setAuthModalMessage: (message: string | null) => void;
  resetToken: string | null;
  openAuthModal: (view?: AuthModalView) => void;
  register: (name: string, email: string, password: string) => Promise<AuthActionResult>;
  loginWithPassword: (email: string, password: string) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  resetPassword: (token: string, password: string) => Promise<AuthActionResult>;
  resendVerification: () => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_USER: User = {
  ...INITIAL_USER,
  name: 'Família Visitante',
  email: '',
  provider: 'guest',
  role: 'parent',
};

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
  const [authModalOpenState, setAuthModalOpenState] = useState<boolean>(false);
  const [authModalView, setAuthModalView] = useState<AuthModalView>('login');
  const [authModalMessage, setAuthModalMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

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

  // Hidratar a sessão a partir do cookie (se existir) e carregar favoritos.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { user: User | null };
        if (cancelled || !data?.user) return;
        setUser(data.user);

        const favRes = await fetch(`${API_BASE}/api/favorites`, { credentials: 'include' });
        if (!favRes.ok) return;
        const favs = (await favRes.json()) as { poiId: string }[];
        if (!cancelled && Array.isArray(favs)) {
          setFavorites(favs.map((f) => f.poiId));
        }
      } catch {
        // sem sessão — mantém favoritos locais
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ligação de email: ?resetToken=… abre o formulário de reposição;
  // ?verifyToken=… confirma o email automaticamente.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('resetToken');
    const verify = params.get('verifyToken');
    if (!reset && !verify) return;

    window.history.replaceState({}, '', window.location.pathname);

    if (reset) {
      setResetToken(reset);
      setAuthModalView('reset');
      setAuthModalOpenState(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token: verify }),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setAuthModalMessage(res.ok ? data.message || 'Email confirmado com sucesso.' : data.error || 'Não foi possível confirmar o email.');
      } catch {
        setAuthModalMessage('Não foi possível confirmar o email. Tente novamente.');
      }
      setAuthModalView('message');
      setAuthModalOpenState(true);
    })();
  }, []);

  // Regresso do login social (F5.5): `?oauth=success` re-hidrata a sessão;
  // `?oauthError=` mostra uma mensagem de erro no modal.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    const oauthError = params.get('oauthError');
    if (!oauth && !oauthError) return;
    window.history.replaceState({}, '', window.location.pathname);

    if (oauth === 'success') {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
          if (!res.ok) return;
          const data = (await res.json()) as { user: User | null };
          if (data?.user) setUser(data.user);
        } catch {
          // ignora — o utilizador continua como convidado
        }
      })();
    } else if (oauthError) {
      setAuthModalMessage(
        'Não foi possível concluir a autenticação social. Tente novamente ou use email e palavra-passe.'
      );
      setAuthModalView('message');
      setAuthModalOpenState(true);
    }
  }, []);

  // Sync favorites (apenas para visitantes; utilizadores com sessão vivem na BD).
  useEffect(() => {
    if (user.provider === 'guest') {
      localStorage.setItem('juntos_favs', JSON.stringify(favorites));
    }
  }, [favorites, user.provider]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const togglePhoneFrameMode = () => setPhoneFrameMode((prev) => !prev);

  const setAuthModalOpen = (open: boolean) => {
    setAuthModalOpenState(open);
    if (!open) {
      setAuthModalView('login');
      setAuthModalMessage(null);
      setResetToken(null);
    }
  };

  const openAuthModal = (view: AuthModalView = 'login') => {
    setAuthModalView(view);
    setAuthModalMessage(null);
    setAuthModalOpenState(true);
  };

  const toggleFavorite = (poiId: string) => {
    const willAdd = !favorites.includes(poiId);
    setFavorites((prev) => (prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId]));

    // Persistência por utilizador autenticado (falha silenciosa → mantém local).
    if (user.provider !== 'guest') {
      const path = `${API_BASE}/api/favorites/${encodeURIComponent(poiId)}`;
      fetch(path, { method: willAdd ? 'POST' : 'DELETE', credentials: 'include' }).catch(() => {
        // Reverter em caso de erro de rede
        setFavorites((prev) => (willAdd ? prev.filter((id) => id !== poiId) : [...prev, poiId]));
      });
    }
  };

  // Login social real (F5.5): inicia o fluxo Authorization Code no backend.
  // O regresso é tratado pelo efeito que lê `?oauth=success` / `?oauthError=`.
  const login = (provider: 'google' | 'github') => {
    window.location.href = `${API_BASE}/api/auth/oauth/${provider}/start`;
  };

  const register = async (name: string, email: string, password: string): Promise<AuthActionResult> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
      if (!res.ok) {
        return { ok: false, error: data.error || 'Não foi possível criar a conta.' };
      }
      if (data.user) setUser(data.user);
      setAuthModalOpen(false);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de rede. Tente novamente.' };
    }
  };

  const loginWithPassword = async (email: string, password: string): Promise<AuthActionResult> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
      if (!res.ok) {
        return { ok: false, error: data.error || 'Credenciais inválidas.' };
      }
      if (data.user) setUser(data.user);
      setAuthModalOpen(false);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro de rede. Tente novamente.' };
    }
  };

  const requestPasswordReset = async (email: string): Promise<AuthActionResult> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) return { ok: false, error: data.error || 'Não foi possível processar o pedido.' };
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, error: 'Erro de rede. Tente novamente.' };
    }
  };

  const resetPassword = async (token: string, password: string): Promise<AuthActionResult> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) return { ok: false, error: data.error || 'Não foi possível redefinir a palavra-passe.' };
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, error: 'Erro de rede. Tente novamente.' };
    }
  };

  const resendVerification = async (): Promise<AuthActionResult> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) return { ok: false, error: data.error || 'Não foi possível reenviar o email.' };
      return { ok: true, message: data.message };
    } catch {
      return { ok: false, error: 'Erro de rede. Tente novamente.' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore
    }
    setUser(GUEST_USER);
  };

  // Direito ao esquecimento (RGPD): elimina a conta e todos os dados pessoais.
  const deleteAccount = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/account`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    localStorage.removeItem('juntos_favs');
    localStorage.removeItem('juntos_user');
    setFavorites([]);
    setUser(GUEST_USER);
    return true;
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
        deleteAccount,
        authModalOpen: authModalOpenState,
        setAuthModalOpen,
        authModalView,
        setAuthModalView,
        authModalMessage,
        setAuthModalMessage,
        resetToken,
        openAuthModal,
        register,
        loginWithPassword,
        requestPasswordReset,
        resetPassword,
        resendVerification,
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
