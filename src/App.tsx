/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext';
import { Header } from './components/common/Header';
import { BottomNav, ParentTab } from './components/common/BottomNav';
import { AuthModal } from './components/common/AuthModal';
import { ToastContainer } from './components/common/ToastContainer';
import { CookieBanner } from './components/common/CookieBanner';
import { PrivacyModal } from './components/common/PrivacyModal';
import { ReportModal } from './components/common/ReportModal';
import { ExploreScreen } from './components/parent/ExploreScreen';
import { PoiDetailScreen } from './components/parent/PoiDetailScreen';
import { MapScreen } from './components/parent/MapScreen';
import { PlanScreen } from './components/parent/PlanScreen';
import { FavoritesScreen } from './components/parent/FavoritesScreen';
import type { AdminTab } from './components/admin/AdminSidebar';

const AdminSidebar = lazy(() =>
  import('./components/admin/AdminSidebar').then((m) => ({ default: m.AdminSidebar }))
);
const AdminHeader = lazy(() =>
  import('./components/admin/AdminHeader').then((m) => ({ default: m.AdminHeader }))
);
const DashboardScreen = lazy(() =>
  import('./components/admin/DashboardScreen').then((m) => ({ default: m.DashboardScreen }))
);
const CuratorshipScreen = lazy(() =>
  import('./components/admin/CuratorshipScreen').then((m) => ({ default: m.CuratorshipScreen }))
);
const ReportsScreen = lazy(() =>
  import('./components/admin/ReportsScreen').then((m) => ({ default: m.ReportsScreen }))
);
const PoiEditorScreen = lazy(() =>
  import('./components/admin/PoiEditorScreen').then((m) => ({ default: m.PoiEditorScreen }))
);
const CategoriesScreen = lazy(() =>
  import('./components/admin/AdminSecondaryScreens').then((m) => ({ default: m.CategoriesScreen }))
);
const CsvImportScreen = lazy(() =>
  import('./components/admin/AdminSecondaryScreens').then((m) => ({ default: m.CsvImportScreen }))
);
const AuditLogsScreen = lazy(() =>
  import('./components/admin/AdminSecondaryScreens').then((m) => ({ default: m.AuditLogsScreen }))
);
const SettingsScreen = lazy(() =>
  import('./components/admin/AdminSecondaryScreens').then((m) => ({ default: m.SettingsScreen }))
);
const NewPoiModal = lazy(() =>
  import('./components/admin/NewPoiModal').then((m) => ({ default: m.NewPoiModal }))
);
import { DeviceSimulatorModal } from './components/common/DeviceSimulatorModal';
import { POI } from './types';

const AppContent: React.FC = () => {
  const { viewMode, setViewMode, phoneFrameMode, togglePhoneFrameMode, isDarkMode, toggleDarkMode, setAuthModalOpen } = useAuth();
  const { pois, isWsConnected, connectedUsers } = useRealtime();

  // Parent Navigation State
  const [parentTab, setParentTab] = useState<ParentTab>('explorar');
  const [selectedPoiForDetail, setSelectedPoiForDetail] = useState<POI | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('Braga, Centro');

  // Admin Navigation State
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard-geral');
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [selectedPoiToEdit, setSelectedPoiToEdit] = useState<POI>(pois[0] || null);
  const [adminMobileMenuOpen, setAdminMobileMenuOpen] = useState<boolean>(false);

  // Modals
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [newPoiModalOpen, setNewPoiModalOpen] = useState<boolean>(false);
  const [deviceSimulatorOpen, setDeviceSimulatorOpen] = useState<boolean>(false);
  const [poiToSimulate, setPoiToSimulate] = useState<POI>(pois[0] || null);

  const handleOpenDetail = (poi: POI) => {
    setSelectedPoiForDetail(poi);
  };

  const handleBackFromDetail = () => {
    setSelectedPoiForDetail(null);
  };

  const handleOpenEdit = (poi: POI) => {
    setSelectedPoiToEdit(poi);
    setAdminTab('editar-poi');
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col relative selection:bg-primary/20 selection:text-primary">
      {/* Real-time Floating Control Bar (Experience Switcher & Live Diagnostics) */}
      <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5 p-1 bg-surface-container-lowest/90 backdrop-blur-md rounded-full shadow-lg border border-surface-container-high text-xs">
        {/* Toggle Mode Button */}
        <button
          onClick={() => {
            setViewMode(viewMode === 'parent' ? 'admin' : 'parent');
            setSelectedPoiForDetail(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-xs font-bold transition-all ${
            viewMode === 'parent'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'bg-secondary text-on-secondary shadow-xs'
          }`}
          title="Alternar entre a App dos Pais e o Backoffice"
        >
          <span className="material-symbols-outlined text-[16px]">
            {viewMode === 'parent' ? 'phone_android' : 'dashboard'}
          </span>
          <span>{viewMode === 'parent' ? 'App Família' : 'Backoffice'}</span>
        </button>

        {/* Phone Frame Toggle (available in Parent mode) */}
        {viewMode === 'parent' && (
          <button
            onClick={togglePhoneFrameMode}
            className={`p-1.5 rounded-full transition-colors ${
              phoneFrameMode
                ? 'bg-primary-fixed text-primary'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
            title={phoneFrameMode ? 'Ecrã Completo' : 'Simular Moldura Telemóvel'}
          >
            <span className="material-symbols-outlined text-[18px]">devices</span>
          </button>
        )}

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          title="Alternar Tema Claro/Escuro"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Live WebSocket Status Dot */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-surface-container text-[11px] font-mono text-on-surface-variant"
          title={isWsConnected ? `WebSocket Ligado (${connectedUsers} conectados)` : 'A religar...'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="hidden sm:inline">WS {isWsConnected ? 'OK' : 'OFF'}</span>
        </div>
      </div>

      {/* Main Container */}
      {viewMode === 'parent' ? (
        /* PARENT EXPERIENCE (MOBILE / TABLET) */
        <div
          className={`w-full min-h-screen flex flex-col items-center justify-start ${
            phoneFrameMode ? 'p-3 sm:p-6 bg-surface-container-high/60' : 'bg-surface'
          }`}
        >
          <div
            className={`w-full flex flex-col bg-surface relative ${
              phoneFrameMode
                ? 'max-w-[430px] min-h-[880px] rounded-[44px] shadow-2xl border-[10px] border-surface-container-highest overflow-hidden'
                : 'min-h-screen'
            }`}
          >
            {/* Phone Speaker & Camera Notch (when in frame mode) */}
            {phoneFrameMode && (
              <div className="w-full flex justify-center pt-2 pb-1 bg-surface z-50">
                <div className="w-24 h-4 bg-surface-container-highest rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-black/60 mr-2" />
                  <div className="w-8 h-1.5 rounded-full bg-black/40" />
                </div>
              </div>
            )}

            {/* Mobile Header */}
            <Header
              title={selectedPoiForDetail ? 'Detalhe Da Atividade' : undefined}
              showBack={!!selectedPoiForDetail}
              onBack={handleBackFromDetail}
              selectedCity={selectedCity}
              onSelectCity={setSelectedCity}
              onOpenProfile={() => setAuthModalOpen(true)}
            />

            {/* Main Screen Stream */}
            <main className="flex-1 w-full pt-16">
              {selectedPoiForDetail ? (
                <PoiDetailScreen
                  poi={selectedPoiForDetail}
                  onBack={handleBackFromDetail}
                  onOpenReportModal={() => setReportModalOpen(true)}
                  onAddToPlan={() => {
                    setParentTab('plano-juntos');
                    setSelectedPoiForDetail(null);
                  }}
                />
              ) : (
                <>
                  {parentTab === 'explorar' && (
                    <ExploreScreen
                      selectedCity={selectedCity}
                      onSelectPoi={handleOpenDetail}
                      onNavigateToMap={() => setParentTab('mapa')}
                      onOpenReportModal={() => setReportModalOpen(true)}
                    />
                  )}

                  {parentTab === 'mapa' && (
                    <MapScreen
                      onSelectPoi={handleOpenDetail}
                      onSwitchToList={() => setParentTab('explorar')}
                    />
                  )}

                  {parentTab === 'plano-juntos' && (
                    <PlanScreen
                      onSelectPoiById={(poiId) => {
                        const target = pois.find((p) => p.id === poiId);
                        if (target) handleOpenDetail(target);
                      }}
                    />
                  )}

                  {parentTab === 'favoritos' && (
                    <FavoritesScreen
                      onSelectPoi={handleOpenDetail}
                      onNavigateToExplore={() => setParentTab('explorar')}
                    />
                  )}
                </>
              )}
            </main>

            {/* Bottom Tab Navigation */}
            {!selectedPoiForDetail && (
              <BottomNav activeTab={parentTab} onChangeTab={setParentTab} />
            )}
          </div>
        </div>
      ) : (
        /* CURATORIAL BACKOFFICE EXPERIENCE */
        <Suspense fallback={<div className="w-full min-h-screen bg-background" />}>
        <div className="w-full min-h-screen bg-background flex flex-col">
          {/* Admin Sidebar Navigation */}
          <AdminSidebar
            activeTab={adminTab}
            onChangeTab={setAdminTab}
            mobileOpen={adminMobileMenuOpen}
            onCloseMobile={() => setAdminMobileMenuOpen(false)}
          />

          {/* Admin Main Body */}
          <div className="lg:pl-72 flex flex-col min-h-screen">
            {/* Admin Header */}
            <AdminHeader
              onOpenMobileMenu={() => setAdminMobileMenuOpen(true)}
              searchQuery={adminSearchQuery}
              onSearchChange={setAdminSearchQuery}
            />

            {/* Admin Page Content */}
            <main className="pt-16 px-4 sm:px-6 w-full max-w-7xl mx-auto flex-1 flex flex-col">
              {adminTab === 'dashboard-geral' && (
                <DashboardScreen
                  onNavigateTab={setAdminTab}
                  onSelectPoiToEdit={handleOpenEdit}
                />
              )}

              {adminTab === 'curadoria-de-pois' && (
                <CuratorshipScreen
                  onSelectPoiToEdit={handleOpenEdit}
                  onOpenNewPoiModal={() => setNewPoiModalOpen(true)}
                />
              )}

              {adminTab === 'denuncias-e-reportes' && <ReportsScreen />}

              {adminTab === 'editar-poi' && (
                <PoiEditorScreen
                  poi={selectedPoiToEdit || pois[0]}
                  onBack={() => setAdminTab('curadoria-de-pois')}
                  onSimulateMobile={() => {
                    setPoiToSimulate(selectedPoiToEdit || pois[0]);
                    setDeviceSimulatorOpen(true);
                  }}
                />
              )}

              {adminTab === 'gestao-de-categorias' && <CategoriesScreen />}
              {adminTab === 'importacao-csv' && <CsvImportScreen />}
              {adminTab === 'auditoria-e-logs' && <AuditLogsScreen />}
              {adminTab === 'configuracoes' && <SettingsScreen />}
            </main>
          </div>
        </div>
        </Suspense>
      )}

      {/* Global Modals & Toasts */}
      <AuthModal />
      <PrivacyModal />
      <CookieBanner />
      <ToastContainer />
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetPoi={selectedPoiForDetail}
      />
      <Suspense fallback={null}>
        <NewPoiModal
          isOpen={newPoiModalOpen}
          onClose={() => setNewPoiModalOpen(false)}
        />
      </Suspense>
      <DeviceSimulatorModal
        isOpen={deviceSimulatorOpen}
        onClose={() => setDeviceSimulatorOpen(false)}
        poi={poiToSimulate || pois[0]}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <AppContent />
      </RealtimeProvider>
    </AuthProvider>
  );
}
