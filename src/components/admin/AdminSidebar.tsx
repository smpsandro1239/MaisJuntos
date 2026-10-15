import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';

export type AdminTab =
  | 'dashboard-geral'
  | 'curadoria-de-pois'
  | 'denuncias-e-reportes'
  | 'gestao-de-categorias'
  | 'importacao-csv'
  | 'auditoria-e-logs'
  | 'configuracoes'
  | 'editar-poi';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onChangeTab: (tab: AdminTab) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onChangeTab,
  mobileOpen,
  onCloseMobile,
}) => {
  const { setViewMode } = useAuth();
  const { reports, isWsConnected } = useRealtime();

  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  const handleNav = (tab: AdminTab) => {
    onChangeTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-low border-r border-surface-container-high z-50 flex flex-col py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo and Brand */}
        <div className="px-5 pb-5 flex items-center justify-between border-b border-surface-container-high/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-headline-md text-xl font-bold tracking-tight shadow-xs">
              +J
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-base tracking-tight text-primary font-bold leading-none">
                +JUNTOS
              </span>
              <span className="font-label-sm text-[10px] tracking-wider uppercase text-on-surface-variant mt-1 font-semibold">
                Portugal em Família
              </span>
            </div>
          </div>
          <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-bold border border-surface-container-highest">
            BO
          </span>
        </div>

        {/* Section 1: Gestão Cultural & POIs */}
        <div className="px-4 mt-3 mb-1">
          <div className="px-3 py-1 font-label-sm text-[11px] uppercase tracking-wider text-outline font-bold">
            Gestão Cultural & POIs
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar">
          <button
            onClick={() => handleNav('dashboard-geral')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-label-lg text-sm transition-all text-left ${
              activeTab === 'dashboard-geral'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span>Dashboard Geral</span>
          </button>

          <button
            onClick={() => handleNav('curadoria-de-pois')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-label-lg text-sm transition-all text-left ${
              activeTab === 'curadoria-de-pois'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">attractions</span>
            <span>Curadoria de POIs</span>
          </button>

          <button
            onClick={() => handleNav('denuncias-e-reportes')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-label-lg text-sm transition-all text-left ${
              activeTab === 'denuncias-e-reportes'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">flag</span>
              <span>Denúncias & Reportes</span>
            </div>
            {openReportsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm text-[10px] font-bold">
                {openReportsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNav('gestao-de-categorias')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-label-lg text-sm transition-all text-left ${
              activeTab === 'gestao-de-categorias'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">category</span>
            <span>Gestão de Categorias</span>
          </button>

          <button
            onClick={() => handleNav('importacao-csv')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-label-lg text-sm transition-all text-left ${
              activeTab === 'importacao-csv'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            <span>Importação CSV</span>
          </button>

          {/* Section 2: Sistema & Auditoria */}
          <div className="pt-4 pb-1">
            <div className="px-3 font-label-sm text-[11px] uppercase tracking-wider text-outline font-bold">
              Sistema & Auditoria
            </div>
          </div>

          <button
            onClick={() => handleNav('auditoria-e-logs')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-label-lg text-sm transition-all text-left ${
              activeTab === 'auditoria-e-logs'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">history_edu</span>
            <span>Auditoria & Logs</span>
          </button>

          <button
            onClick={() => handleNav('configuracoes')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-label-lg text-sm transition-all text-left ${
              activeTab === 'configuracoes'
                ? 'bg-primary text-on-primary font-bold shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span>Configurações</span>
          </button>
        </nav>

        {/* Footer actions */}
        <div className="px-3 pt-3 mt-auto flex flex-col gap-2 border-t border-surface-container-high">
          {/* Switch to Parent App view */}
          <button
            onClick={() => setViewMode('parent')}
            className="w-full py-2.5 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-label-md text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">phone_android</span>
            <span>Abrir App Família (+JUNTOS)</span>
          </button>

          <div className="p-2.5 rounded-xl bg-surface-container flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isWsConnected ? 'bg-primary animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="font-label-sm text-[11px] text-on-surface-variant">
                {isWsConnected ? 'Sincronização Ativa' : 'A ligar...'}
              </span>
            </div>
            <span className="font-label-sm text-[11px] font-bold text-primary">v2.4</span>
          </div>
        </div>
      </aside>
    </>
  );
};
