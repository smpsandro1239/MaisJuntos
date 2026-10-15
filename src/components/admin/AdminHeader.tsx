import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';

interface AdminHeaderProps {
  onOpenMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
}) => {
  const { user, isDarkMode, toggleDarkMode, setAuthModalOpen } = useAuth();
  const { reports } = useRealtime();

  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high z-40 flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Mobile Hamburger Menu & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-on-surface hover:bg-surface-container-high transition-colors"
          aria-label="Abrir Menu Lateral"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[20px]">
            search
          </span>
          <input
            className="w-full h-10 pl-10 pr-4 rounded-full bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-xs sm:text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            placeholder="Pesquisar POIs, roteiros familiares, concelho ou ID..."
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-4 ml-2">
        {/* Environment Status Badge */}
        <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-xs font-bold border border-surface-container-highest">
          <span className="w-2 h-2 rounded-full bg-secondary-container"></span>
          <span>PRODUÇÃO - Braga & Norte</span>
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          title="Alternar Modo Escuro"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Notifications */}
        <button
          aria-label="Notificações"
          className="relative p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {openReportsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface"></span>
          )}
        </button>

        <div className="h-6 w-px bg-surface-container-highest hidden sm:block"></div>

        {/* Curator Profile Info */}
        <div
          onClick={() => setAuthModalOpen(true)}
          className="flex items-center gap-2.5 cursor-pointer p-1 rounded-xl hover:bg-surface-container-high transition-colors"
        >
          <div className="hidden sm:flex flex-col text-right">
            <span className="font-label-lg text-xs font-bold text-on-surface leading-tight">
              {user.name}
            </span>
            <span className="font-label-sm text-[10px] text-on-surface-variant">
              Curadora Chefe / Admin
            </span>
          </div>
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 shadow-xs"
          />
        </div>
      </div>
    </header>
  );
};
