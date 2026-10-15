import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { useRealtime } from '../../context/RealtimeContext';
import { useAuth } from '../../context/AuthContext';
import { POI } from '../../types';

interface MapScreenProps {
  onSelectPoi: (poi: POI) => void;
  onSwitchToList: () => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({ onSelectPoi, onSwitchToList }) => {
  const { pois } = useRealtime();
  const { favorites, toggleFavorite } = useAuth();

  const [selectedPoiId, setSelectedPoiId] = useState<string>('poi-quinta-pedagogica');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<'idle' | 'located' | 'denied'>('idle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Selected POI object
  const selectedPoi = useMemo(() => {
    return pois.find((p) => p.id === selectedPoiId) || pois[0] || null;
  }, [pois, selectedPoiId]);

  const isFav = selectedPoi ? favorites.includes(selectedPoi.id) : false;

  // Filtered POIs based on search query and filter pills
  const filteredPois = useMemo(() => {
    return pois.filter((poi) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = poi.name.toLowerCase().includes(q);
        const matchCat = poi.categoryLabel.toLowerCase().includes(q);
        const matchCity = poi.city.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchCity) return false;
      }

      if (activeFilter === 'aberto' && !poi.isOpenNow) return false;
      if (activeFilter === 'chuva' && poi.spaceType === 'exterior') return false;
      if (activeFilter === 'gratis' && !poi.isFree) return false;
      if (activeFilter === '0-5' && poi.minAge > 5) return false;
      if (activeFilter === 'fraldario') {
        const hasFraldario = poi.amenities?.some((a) => a.icon === 'baby_changing_station');
        if (!hasFraldario) return false;
      }

      return true;
    });
  }, [pois, searchQuery, activeFilter]);

  // Request browser GPS position on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoState('located');
        },
        () => {
          setGeoState('denied');
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter: [number, number] = [41.5518, -8.4239]; // Braga
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update User GPS Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        const userHtml = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-cyan-500/30 animate-ping"></span>
            <span class="absolute w-6 h-6 rounded-full bg-cyan-500/40"></span>
            <div class="w-4 h-4 rounded-full bg-cyan-600 border-2 border-white shadow-md"></div>
          </div>
        `;
        const userIcon = L.divIcon({
          html: userHtml,
          className: 'family-gps-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 });
        marker.addTo(map);
        marker.bindTooltip('A sua localização', { direction: 'top', offset: [0, -12] });
        userMarkerRef.current = marker;
      }
    }
  }, [userLocation]);

  // Update POI Markers whenever filteredPois or selectedPoiId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    filteredPois.forEach((poi) => {
      const isSelected = poi.id === selectedPoiId;
      const markerHtml = `
        <div class="transition-transform duration-200 ${isSelected ? 'scale-110 -translate-y-2' : 'hover:scale-105'} flex flex-col items-center cursor-pointer">
          <div class="px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 ${
            isSelected
              ? 'bg-[#006067] text-white ring-2 ring-white shadow-lg'
              : poi.isFree
              ? 'bg-amber-600 text-white'
              : 'bg-white text-slate-800 border border-slate-200'
          }">
            <span class="material-symbols-outlined text-[15px]">${poi.categoryIcon || 'place'}</span>
            <span class="text-[11px] font-bold whitespace-nowrap">${poi.name.length > 20 ? poi.name.slice(0, 19) + '…' : poi.name}</span>
          </div>
          <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] ${
            isSelected ? 'border-t-[#006067]' : poi.isFree ? 'border-t-amber-600' : 'border-t-white'
          }"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'poi-custom-marker',
        iconSize: [120, 36],
        iconAnchor: [60, 34],
      });

      const marker = L.marker([poi.latitude, poi.longitude], {
        icon: customIcon,
        zIndexOffset: isSelected ? 500 : 100,
      });

      marker.on('click', () => {
        setSelectedPoiId(poi.id);
        map.panTo([poi.latitude, poi.longitude], { animate: true, duration: 0.5 });
      });

      marker.addTo(layer);
    });
  }, [filteredPois, selectedPoiId]);

  // Recenter map on user location or city center
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.8 });
    } else if (selectedPoi) {
      map.flyTo([selectedPoi.latitude, selectedPoi.longitude], 14, { duration: 0.8 });
    } else {
      map.flyTo([41.5518, -8.4239], 13, { duration: 0.8 });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden flex flex-col bg-surface-container select-none">
      {/* Top Floating Controls Layer */}
      <div className="absolute top-2 left-0 right-0 z-[1000] px-4 flex flex-col gap-2 max-w-2xl mx-auto w-full pointer-events-none">
        {/* Top Row: Search input + View Switcher */}
        <div className="flex items-center gap-2 w-full pointer-events-auto">
          <div className="flex-1 flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md px-4 h-12">
            <span className="material-symbols-outlined text-[#006067] text-[22px] mr-2">search</span>
            <input
              className="w-full bg-transparent border-0 font-body-md text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              placeholder="Pesquisar no mapa interativo..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          <button
            onClick={onSwitchToList}
            className="h-12 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-800 dark:text-slate-100 hover:text-[#006067] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-1.5 transition-transform active:scale-95 shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
            <span className="font-label-lg text-xs font-bold">Lista</span>
          </button>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto py-1">
          <button
            onClick={() => setActiveFilter(activeFilter === 'aberto' ? '' : 'aberto')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-xs shrink-0 transition-transform active:scale-95 text-xs font-semibold ${
              activeFilter === 'aberto'
                ? 'bg-[#006067] text-white'
                : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Aberto agora</span>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'chuva' ? '' : 'chuva')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-xs shrink-0 transition-transform active:scale-95 text-xs font-semibold ${
              activeFilter === 'chuva'
                ? 'bg-[#006067] text-white'
                : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#006067]">umbrella</span>
            <span>Interior (Chuva)</span>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'gratis' ? '' : 'gratis')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-xs shrink-0 transition-transform active:scale-95 text-xs font-semibold ${
              activeFilter === 'gratis'
                ? 'bg-[#006067] text-white'
                : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-amber-600">savings</span>
            <span>Entrada Livre</span>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === '0-5' ? '' : '0-5')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-xs shrink-0 transition-transform active:scale-95 text-xs font-semibold ${
              activeFilter === '0-5'
                ? 'bg-[#006067] text-white'
                : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-rose-600">child_friendly</span>
            <span>0-5 anos</span>
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'fraldario' ? '' : 'fraldario')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full shadow-xs shrink-0 transition-transform active:scale-95 text-xs font-semibold ${
              activeFilter === 'fraldario'
                ? 'bg-[#006067] text-white'
                : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-md text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#006067]">baby_changing_station</span>
            <span>Fraldário</span>
          </button>
        </div>
      </div>

      {/* Real Interactive Leaflet Map View */}
      <div className="relative flex-1 w-full h-full z-0">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Count Pill & Recenter GPS Button */}
        <div className="absolute top-28 left-4 right-4 z-[999] flex items-center justify-between max-w-2xl mx-auto pointer-events-none">
          <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-label-md text-xs text-slate-800 dark:text-slate-100 font-semibold">
              {filteredPois.length} locais auditados em mapa real
            </span>
          </div>

          <button
            aria-label="Recetrar mapa na sua posição"
            onClick={handleRecenter}
            className="pointer-events-auto w-11 h-11 bg-white/95 dark:bg-slate-900/95 hover:bg-white text-[#006067] rounded-full border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center transition-all active:scale-90"
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">my_location</span>
          </button>
        </div>
      </div>

      {/* Bottom Floating POI Preview Card */}
      {selectedPoi && (
        <div className="absolute bottom-20 left-0 right-0 z-[1000] px-4 max-w-md mx-auto w-full pointer-events-auto">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_12px_40px_-6px_rgba(0,96,103,0.22)] flex flex-col gap-2.5">
            <div className="flex gap-3">
              <img
                alt={selectedPoi.name}
                className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                src={selectedPoi.coverImage}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-[#006067] uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">{selectedPoi.categoryIcon}</span>
                      {selectedPoi.categoryLabel}
                    </span>
                    <button
                      onClick={() => toggleFavorite(selectedPoi.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      aria-label="Guardar favorito"
                    >
                      <span className={`material-symbols-outlined text-[18px] ${isFav ? 'text-rose-500 fill-1' : ''}`}>
                        favorite
                      </span>
                    </button>
                  </div>
                  <h3 className="font-title-md text-sm font-bold text-slate-900 dark:text-white truncate">
                    {selectedPoi.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {selectedPoi.address}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {selectedPoi.isFree ? 'Entrada Grátis' : `${selectedPoi.priceChild.toFixed(2)}€`}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                    <span className="material-symbols-outlined text-[14px]">star</span>
                    {selectedPoi.rating.toFixed(1)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className={selectedPoi.isOpenNow ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
                    {selectedPoi.isOpenNow ? 'Aberto' : 'Encerrado'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => onSelectPoi(selectedPoi)}
                className="py-2 px-3 bg-[#006067] hover:bg-[#004f55] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>Ver Detalhes</span>
              </button>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoi.latitude},${selectedPoi.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">directions</span>
                <span>Como Chegar</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
