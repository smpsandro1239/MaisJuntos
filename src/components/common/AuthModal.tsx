import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { PRIVACY_EVENT } from './CookieBanner';
import { API_BASE } from '../../config';

const OAuthButtons: React.FC<{ disabled: boolean; loadingProvider: 'google' | 'github' | null; onProvider: (p: 'google' | 'github') => void }> = ({
  disabled,
  loadingProvider,
  onProvider,
}) => (
  <div className="flex flex-col gap-3">
    <button
      onClick={() => onProvider('google')}
      disabled={disabled}
      className="w-full py-3 px-4 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-lg text-sm font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xs disabled:opacity-60"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
      </svg>
      <span>{loadingProvider === 'google' ? 'A conectar...' : 'Continuar com Google'}</span>
    </button>

    <button
      onClick={() => onProvider('github')}
      disabled={disabled}
      className="w-full py-3 px-4 rounded-2xl bg-[#24292e] text-white hover:bg-black font-label-lg text-sm font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xs disabled:opacity-60"
    >
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
      <span>{loadingProvider === 'github' ? 'A conectar...' : 'Continuar com GitHub'}</span>
    </button>
  </div>
);

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-sm font-body-md outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition';

export const AuthModal: React.FC = () => {
  const {
    user,
    isLoggedIn,
    login,
    logout,
    deleteAccount,
    authModalOpen,
    setAuthModalOpen,
    authModalView,
    setAuthModalView,
    authModalMessage,
    setAuthModalMessage,
    resetToken,
    register,
    loginWithPassword,
    requestPasswordReset,
    resetPassword,
    setViewMode,
    viewMode,
  } = useAuth();
  const { addToast } = useRealtime();

  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setError(null);
  };

  const goTo = (view: typeof authModalView) => {
    resetForm();
    setAuthModalView(view);
  };

  const handleProviderLogin = async (provider: 'google' | 'github') => {
    setLoadingProvider(provider);
    setError(null);
    try {
      // Sonda o endpoint /start com redirecionamento manual: um 302 sai como
      // resposta opaca (status 0) e prosseguimos com a navegação; um erro
      // declarado (ex.: 503 provider não configurado) é mostrado ao utilizador.
      const res = await fetch(`${API_BASE}/api/auth/oauth/${provider}/start`, {
        redirect: 'manual',
      });
      if (res.status && res.status !== 0) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || 'Não foi possível iniciar a autenticação social.');
        return;
      }
      login(provider);
    } catch {
      setError('Erro de rede ao iniciar a autenticação social.');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const ok = await deleteAccount();
      if (ok) setAuthModalOpen(false);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleExportAccount = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/account/export`, { credentials: 'include' });
      if (!res.ok) {
        addToast('Exportação falhou', 'Não foi possível exportar os teus dados. Tenta novamente.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `juntos-export-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      addToast('Dados exportados', 'O teu ficheiro JSON foi descarregado (RGPD art. 20.º).');
    } catch {
      addToast('Exportação falhou', 'Erro de rede ao exportar os dados.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await loginWithPassword(email.trim(), password);
      if (!result.ok) setError(result.error || 'Não foi possível iniciar sessão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('As palavras-passe não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await register(name.trim(), email.trim(), password);
      if (!result.ok) setError(result.error || 'Não foi possível criar a conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      if (!result.ok) {
        setError(result.error || 'Não foi possível processar o pedido.');
        return;
      }
      setAuthModalMessage(
        result.message || 'Se existir uma conta associada a este email, enviámos instruções para repor a palavra-passe.'
      );
      setAuthModalView('message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetToken) {
      setError('Ligação inválida ou expirada.');
      return;
    }
    if (password !== confirm) {
      setError('As palavras-passe não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await resetPassword(resetToken, password);
      if (!result.ok) {
        setError(result.error || 'Não foi possível redefinir a palavra-passe.');
        return;
      }
      setAuthModalMessage(result.message || 'Palavra-passe redefinida com sucesso.');
      setAuthModalView('message');
    } finally {
      setSubmitting(false);
    }
  };

  const titles: Record<typeof authModalView, { title: string; subtitle: string }> = {
    login: { title: 'Entrar no +JUNTOS', subtitle: 'Guarda favoritos e planeia roteiros em família' },
    register: { title: 'Criar conta', subtitle: 'Leva menos de um minuto' },
    forgot: { title: 'Recuperar palavra-passe', subtitle: 'Enviaremos uma ligação para o teu email' },
    reset: { title: 'Definir nova palavra-passe', subtitle: 'Escolhe uma palavra-passe forte' },
    message: { title: 'Verifica o teu email', subtitle: 'Informação importante sobre a tua conta' },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setAuthModalOpen(false)}
    >
      <div
        className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-5 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-headline-md text-xl font-bold">
            +J
          </div>
          <div>
            <h2 className="font-headline-sm text-lg text-on-surface font-bold leading-tight">
              {isLoggedIn ? 'A Tua Conta Familiar' : titles[authModalView].title}
            </h2>
            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
              {isLoggedIn ? 'Sincronização em tempo real & histórico' : titles[authModalView].subtitle}
            </p>
          </div>
        </div>

        {isLoggedIn ? (
          /* Logged In View */
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/30"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-label-lg font-bold text-on-surface truncate">{user.name}</h3>
                  <span className="px-2 py-0.2 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase">
                    {user.provider}
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-label-sm text-[11px] text-primary font-semibold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    Grau de Confiança: {user.trustScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* Family Profile Summary */}
            {user.familyProfile && (
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm uppercase tracking-wider text-outline text-[11px] font-bold">
                    Perfil das Crianças
                  </span>
                  <span className="text-xs text-primary font-semibold">Braga, Centro</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.familyProfile.children.map((child) => (
                    <span
                      key={child.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-lowest text-primary text-xs font-semibold shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[14px]">face</span>
                      {child.name} ({child.age} anos)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Switch to Backoffice Curadoria */}
            <div className="p-3.5 rounded-2xl bg-primary-fixed/30 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="font-label-sm text-xs text-primary font-bold block">Acesso Curatorial</span>
                <span className="font-body-sm text-xs text-on-surface-variant">Painel de Backoffice & POIs</span>
              </div>
              <button
                onClick={() => {
                  setViewMode(viewMode === 'parent' ? 'admin' : 'parent');
                  setAuthModalOpen(false);
                }}
                className="px-3 py-1.5 bg-primary text-on-primary text-xs font-semibold rounded-xl hover:bg-primary-container transition-colors shadow-xs"
              >
                {viewMode === 'parent' ? 'Abrir Backoffice' : 'Abrir App Família'}
              </button>
            </div>

            <button
              onClick={logout}
              className="w-full py-2.5 rounded-xl border border-error/30 text-error hover:bg-error/10 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Terminar Sessão</span>
            </button>

            {/* Privacidade e Direito ao Esquecimento (RGPD) */}
            <div className="pt-3 border-t border-surface-container-high flex flex-col gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(PRIVACY_EVENT))}
                className="text-xs text-primary font-semibold hover:underline text-left"
              >
                Política de Privacidade e Termos
              </button>

              <button
                type="button"
                onClick={handleExportAccount}
                disabled={exporting}
                className="text-xs text-on-surface-variant hover:text-primary font-semibold text-left disabled:opacity-60"
              >
                {exporting ? 'A preparar exportação...' : 'Exportar os meus dados'}
              </button>

              {confirmingDelete ? (
                <div className="rounded-xl border border-error/40 bg-error/5 p-3 flex flex-col gap-2">
                  <p className="font-body-sm text-xs text-on-surface">
                    Esta ação é <strong>irreversível</strong>. A conta, favoritos e roteiros serão eliminados
                    definitivamente.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="px-3 py-2 rounded-xl bg-error text-on-error text-xs font-semibold disabled:opacity-60"
                    >
                      {deleting ? 'A eliminar...' : 'Confirmar eliminação'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-3 py-2 rounded-xl text-on-surface-variant text-xs font-semibold hover:bg-surface-container-high"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="text-xs text-on-surface-variant hover:text-error font-semibold text-left"
                >
                  Apagar a minha conta e todos os dados
                </button>
              )}
            </div>
          </div>
        ) : authModalView === 'message' ? (
          /* Message View (verificação de email / reposição) */
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-primary/5 border border-primary/20">
              <span className="material-symbols-outlined text-primary text-[22px]">mail</span>
              <p className="font-body-sm text-sm text-on-surface">
                {authModalMessage || 'Ação concluída.'}
              </p>
            </div>
            <button
              onClick={() => goTo('login')}
              className="w-full py-3 rounded-2xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors shadow-xs"
            >
              Voltar ao início de sessão
            </button>
          </div>
        ) : (
          /* Auth Flows */
          <div className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-error/5 border border-error/30">
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                <p className="font-body-sm text-xs text-error">{error}</p>
              </div>
            )}

            {authModalView === 'login' && (
              <>
                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Palavra-passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-2xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors shadow-xs disabled:opacity-60"
                  >
                    {submitting ? 'A entrar...' : 'Entrar'}
                  </button>
                </form>
                <div className="flex items-center justify-between text-xs">
                  <button onClick={() => goTo('forgot')} className="text-primary font-semibold hover:underline">
                    Esqueci-me da palavra-passe
                  </button>
                  <button onClick={() => goTo('register')} className="text-primary font-semibold hover:underline">
                    Criar conta
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-outline">
                  <span className="flex-1 h-px bg-surface-container-high" />
                  ou
                  <span className="flex-1 h-px bg-surface-container-high" />
                </div>
                <OAuthButtons disabled={loadingProvider !== null} loadingProvider={loadingProvider} onProvider={handleProviderLogin} />
                <div className="pt-1 border-t border-surface-container-high text-center">
                  <button onClick={() => setAuthModalOpen(false)} className="text-xs text-primary font-semibold hover:underline">
                    Continuar a navegar como convidado
                  </button>
                </div>
              </>
            )}

            {authModalView === 'register' && (
              <>
                <form onSubmit={handleRegister} className="flex flex-col gap-3">
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Palavra-passe (mín. 8, com maiúscula e número)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Confirmar palavra-passe"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-2xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors shadow-xs disabled:opacity-60"
                  >
                    {submitting ? 'A criar conta...' : 'Criar conta'}
                  </button>
                </form>
                <button onClick={() => goTo('login')} className="text-xs text-primary font-semibold hover:underline text-center">
                  Já tenho conta — iniciar sessão
                </button>
              </>
            )}

            {authModalView === 'forgot' && (
              <>
                <form onSubmit={handleForgot} className="flex flex-col gap-3">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Email da tua conta"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-2xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors shadow-xs disabled:opacity-60"
                  >
                    {submitting ? 'A enviar...' : 'Enviar ligação de reposição'}
                  </button>
                </form>
                <button onClick={() => goTo('login')} className="text-xs text-primary font-semibold hover:underline text-center">
                  Voltar ao início de sessão
                </button>
              </>
            )}

            {authModalView === 'reset' && (
              <form onSubmit={handleReset} className="flex flex-col gap-3">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Nova palavra-passe (mín. 8, com maiúscula e número)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Confirmar nova palavra-passe"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container transition-colors shadow-xs disabled:opacity-60"
                >
                  {submitting ? 'A guardar...' : 'Definir nova palavra-passe'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
