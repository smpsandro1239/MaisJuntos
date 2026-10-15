import React from 'react';
import { useAuth } from '../../context/AuthContext';

export type ParentTab = 'explorar' | 'mapa' | 'favoritos' | 'plano-juntos';

interface BottomNavProps {
  activeTab: ParentTab;
  onChangeTab: (tab: ParentTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const { favorites } = useAuth();

  const tabs: Array<{ id: ParentTab; label: string; icon: string; count?: number }> = [
    { id: 'explorar', label: 'Explorar', icon: 'explore' },
    { id: 'mapa', label: 'Mapa', icon: 'map' },
    { id: 'favoritos', label: 'Favoritos', icon: 'favorite', count: favorites.length },
    { id: 'plano-juntos', label: 'Plano +JUNTOS', icon: 'auto_fix_high' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe bg-surface/90 backdrop-blur-xl border-t border-surface-container-high shadow-[0_-4px_24px_rgba(20,122,130,0.08)]">
      <div className="h-16 max-w-md mx-auto px-4 flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-1 transition-all ${
                isActive ? 'text-primary font-bold scale-105' : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[24px]"
                  style={isActive && tab.id === 'favoritos' ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {tab.icon}
                </span>
                {tab.count !== undefined && tab.count > 0 && tab.id === 'favoritos' && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-secondary text-on-secondary rounded-full text-[10px] font-bold leading-none">
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="font-label-md text-[11px] leading-tight">{tab.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
