import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';

interface HeaderProps {
  onSelectCity?: (city: string) => void;
  selectedCity?: string;
  onOpenProfile?: () => void;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectCity,
  selectedCity = 'Braga, Centro',
  onOpenProfile,
  title,
  showBack,
  onBack,
}) => {
  const { user, isDarkMode, toggleDarkMode, viewMode, setViewMode, setAuthModalOpen } = useAuth();
  const { connectedUsers, isWsConnected } = useRealtime();
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

  const cities = ['Braga, Centro', 'Porto, Baixa', 'Guimarães, Histórico', 'Famalicão, Centro'];

  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-surface/90 backdrop-blur-xl border-b border-surface-container-high shadow-[0_4px_20px_-2px_rgba(20,122,130,0.06)]">
      <div className="h-16 px-4 max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left branding or Back */}
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={onBack}
              aria-label="Voltar"
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
          ) : null}

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (showBack && onBack) onBack();
            }}
          >
            <div className="flex items-center gap-1.5">
              <img
                alt="Logo +JUNTOS"
                className="h-8 w-auto object-contain max-w-[130px]"
                src="https://lh3.googleusercontent.com/aida/AEtjO1X-COy1xsGi-Ui2cZxto6MWL94q9XxRRvj-CGDLwSMHQiFI0ZVj_IY0NRhC_zip9BE63Rol48h1BC8ck3vid2JcjUgM5IfNQEvmbwo2EkesDOlR_jpPHQKMFzDI4AviO2RIIVfJwXUgchTMpEL05rq_N-IJ1K9p7H0xqskRnqF6e0LomoY7QwsrxWyqIG4PkZdeB1mHSzlK6nsPTTnRqjNMH_JiVWPnZeDvigT-70sJuDplxh-jKVC4AMkf"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fb = document.getElementById('header-fallback-logo');
                  if (fb) fb.style.display = 'flex';
                }}
              />
              <div id="header-fallback-logo" className="hidden items-center gap-1">
                <span className="font-headline-sm font-extrabold text-primary text-xl tracking-tight">+JUNTOS</span>
                <span className="text-[10px] font-bold text-secondary uppercase bg-secondary-fixed/50 px-1.5 py-0.5 rounded-sm">PT</span>
              </div>
            </div>
            {title && (
              <h1 className="font-headline-sm text-[17px] text-on-surface font-semibold truncate ml-1 max-w-[170px] sm:max-w-xs">
                {title}
              </h1>
            )}
          </div>
        </div>

        {/* Center: City Selector (if not on subpage) */}
        {!title && (
          <div className="relative">
            <button
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              className="flex items-center gap-1.5 bg-surface-container-low/90 hover:bg-surface-container-high py-1 px-3 rounded-full transition-colors min-h-[40px] shadow-xs text-on-surface"
              type="button"
            >
              <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
              <span className="font-label-md text-label-md font-semibold">{selectedCity}</span>
              <span className="material-symbols-outlined text-outline text-[18px]">expand_more</span>
            </button>

            {cityDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 font-label-sm text-[10px] uppercase text-outline font-bold">Selecionar Cidade</div>
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      if (onSelectCity) onSelectCity(city);
                      setCityDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-surface-container-high transition-colors ${
                      selectedCity === city ? 'text-primary font-semibold bg-primary/5' : 'text-on-surface'
                    }`}
                  >
                    <span>{city}</span>
                    {selectedCity === city && (
                      <span className="material-symbols-outlined text-primary text-[16px]">check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right utility items */}
        <div className="flex items-center gap-1.5">
          {/* WebSocket real-time badge */}
          <div
            title={isWsConnected ? `Sincronização em tempo real ativa (${connectedUsers} utilizadores)` : 'A religar WebSocket...'}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-surface-container-high text-xs text-on-surface-variant font-label-sm cursor-pointer"
          >
            <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span className="hidden md:inline font-mono">{connectedUsers} ao vivo</span>
          </div>

          {/* Dark mode switch */}
          <button
            onClick={toggleDarkMode}
            aria-label="Alternar Modo Escuro"
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Switch to Curator / Admin Backoffice */}
          <button
            onClick={() => setViewMode(viewMode === 'parent' ? 'admin' : 'parent')}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-label-sm text-[11px] font-bold transition-all"
            title="Alternar para Backoffice da Curadoria"
          >
            <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
            <span>Backoffice</span>
          </button>

          {/* Profile Avatar / Login */}
          <button
            onClick={() => (onOpenProfile ? onOpenProfile() : setAuthModalOpen(true))}
            className="flex items-center justify-center p-0.5 rounded-full ring-2 ring-primary/20 hover:ring-primary transition-all focus:outline-none"
            title={user.name || 'Conta / Perfil'}
          >
            <img
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover shadow-sm"
              src={user.avatar}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
