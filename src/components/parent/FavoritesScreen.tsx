import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { POI } from '../../types';

interface FavoritesScreenProps {
  onSelectPoi: (poi: POI) => void;
  onNavigateToExplore: () => void;
}

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({
  onSelectPoi,
  onNavigateToExplore,
}) => {
  const { favorites, toggleFavorite } = useAuth();
  const { pois } = useRealtime();

  const favoritePois = pois.filter((p) => favorites.includes(p.id));

  return (
    <div className="flex flex-col w-full pb-32 pt-2 px-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Os Teus Favoritos</h1>
          <p className="font-body-sm text-xs text-on-surface-variant">
            {favoritePois.length} atividades guardadas para saídas em família
          </p>
        </div>
        <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
          Sincronizado
        </span>
      </div>

      {favoritePois.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3 bg-surface-container-low rounded-3xl p-6 border border-surface-container-high">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[32px]">favorite_border</span>
          </div>
          <h3 className="font-headline-sm text-base font-bold text-on-surface">Ainda não guardaste atividades</h3>
          <p className="font-body-sm text-xs text-on-surface-variant max-w-xs">
            Clica no coração de qualquer parque, museu ou espetáculo para acederes rapidamente aqui.
          </p>
          <button
            onClick={onNavigateToExplore}
            className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary-container transition-colors shadow-xs"
          >
            Explorar Atividades
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {favoritePois.map((poi) => (
            <div
              key={poi.id}
              className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-surface-container-high shadow-xs flex flex-col group"
            >
              <div className="relative w-full h-36 overflow-hidden bg-surface-container-high">
                <img
                  src={poi.coverImage}
                  alt={poi.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  onClick={() => toggleFavorite(poi.id)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-container-lowest/90 text-secondary flex items-center justify-center shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    favorite
                  </span>
                </button>
                <span className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                  {poi.categoryLabel}
                </span>
              </div>
              <div className="p-3.5 flex flex-col justify-between flex-1 gap-2">
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface leading-tight truncate">
                    {poi.name}
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 mt-1">
                    {poi.shortDescription}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-surface-container-high">
                  <span className="font-label-md text-xs font-bold text-primary">
                    {poi.isFree ? 'Gratuito' : `${poi.priceChild.toFixed(2)}€`}
                  </span>
                  <button
                    onClick={() => onSelectPoi(poi)}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5"
                  >
                    <span>Ver</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
