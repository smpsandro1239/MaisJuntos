import React, { useState, useEffect } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { useAuth } from '../../context/AuthContext';
import { POI } from '../../types';
import { AdvancedFilterModal, FilterOptions } from '../common/AdvancedFilterModal';
import { fetchLiveWeather, calculateDistanceKm, WeatherData, PORTUGAL_CITIES_COORDS } from '../../services/weatherGeoService';

interface ExploreScreenProps {
  onSelectPoi: (poi: POI) => void;
  onNavigateToMap: () => void;
  onOpenReportModal: () => void;
  selectedCity?: string;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({
  onSelectPoi,
  onNavigateToMap,
  onOpenReportModal,
  selectedCity = 'Braga, Centro',
}) => {
  const { pois } = useRealtime();
  const { favorites, toggleFavorite } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['idade-3-6']);
  const [rainFilterActive, setRainFilterActive] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterOptions>({
    ageRanges: ['3-5'],
    maxPrice: null,
    spaceType: 'all',
    amenities: [],
    maxDistanceKm: 15,
    openOnly: false,
  });

  // Live Weather from Open-Meteo
  const [liveWeather, setLiveWeather] = useState<WeatherData>({
    temperature: 19,
    weatherCode: 61,
    conditionLabel: 'Chuva leve',
    isRain: true,
    description: 'A carregar meteorologia ao vivo via Open-Meteo...',
    city: 'Braga',
  });
  const [weatherLoading, setWeatherLoading] = useState(false);

  // User GPS Location (browser geolocation)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'active' | 'denied'>('idle');

  // Fetch live weather whenever city changes
  useEffect(() => {
    let mounted = true;
    setWeatherLoading(true);
    fetchLiveWeather(selectedCity)
      .then((data) => {
        if (mounted) {
          setLiveWeather(data);
          // If it's actually raining, proactively encourage rainy day mode
          if (data.isRain) {
            setRainFilterActive(true);
          }
        }
      })
      .finally(() => {
        if (mounted) setWeatherLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedCity]);

  // Request browser geolocation for exact distance calculation
  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoStatus('active');
      },
      (err) => {
        console.warn('Geolocation denied or error:', err);
        setGeoStatus('denied');
        // Fall back to city center
        const cityCoord = PORTUGAL_CITIES_COORDS[selectedCity] || PORTUGAL_CITIES_COORDS['Braga, Centro'];
        setUserLocation({ lat: cityCoord.lat, lng: cityCoord.lng });
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const toggleFilter = (filterKey: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterKey) ? prev.filter((k) => k !== filterKey) : [...prev, filterKey]
    );
  };

  const filteredPois = pois.filter((poi) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        poi.name.toLowerCase().includes(q) ||
        poi.shortDescription.toLowerCase().includes(q) ||
        poi.categoryLabel.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (rainFilterActive && poi.spaceType === 'exterior') {
      return false;
    }
    if (selectedFilters.includes('gratis') && !poi.isFree) {
      return false;
    }
    if (selectedFilters.includes('interior') && poi.spaceType === 'exterior') {
      return false;
    }
    if (selectedFilters.includes('fraldario')) {
      const hasFraldario = poi.amenities.some((a) => a.icon === 'baby_changing_station');
      if (!hasFraldario) return false;
    }
    if (selectedFilters.includes('carrinho')) {
      const hasCarrinho = poi.amenities.some((a) => a.icon === 'stroller');
      if (!hasCarrinho) return false;
    }
    // Advanced modal filters
    if (advancedFilters.maxPrice !== null && !poi.isFree && poi.priceChild > advancedFilters.maxPrice) {
      return false;
    }
    if (advancedFilters.spaceType !== 'all' && poi.spaceType !== advancedFilters.spaceType && poi.spaceType !== 'mixed') {
      return false;
    }
    if (advancedFilters.amenities.length > 0) {
      const amenityMap: Record<string, string> = {
        fraldario: 'baby_changing_station',
        carrinho: 'stroller',
        estacionamento: 'local_parking',
        neuro: 'psychology',
      };
      for (const reqAmenity of advancedFilters.amenities) {
        const iconReq = amenityMap[reqAmenity];
        if (iconReq && !poi.amenities.some((a) => a.icon === iconReq)) {
          return false;
        }
      }
    }
    return true;
  });

  return (
    <div className="flex flex-col w-full pb-28 pt-2">
      {/* Top Hero Search & Assistant Prompt */}
      <section className="px-4 pt-2 pb-1 max-w-3xl mx-auto w-full">
        <div className="relative flex items-center w-full gap-2">
          <div className="relative flex-1 flex items-center bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(20,122,130,0.08)] border border-surface-container-high min-h-[52px] pl-4 pr-2 transition-all focus-within:shadow-[0_4px_24px_rgba(20,122,130,0.16)]">
            <span className="material-symbols-outlined text-primary text-[22px] mr-2 shrink-0">search</span>
            <input
              aria-label="Procurar atividades infantis"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 outline-none font-body-md text-on-surface placeholder:text-outline text-sm py-2"
              placeholder={voiceActive ? 'A ouvir... Diga ex: "Parques em Braga"' : 'O que fazer hoje com as crianças?'}
              type="text"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-outline hover:text-on-surface mr-1"
              >
                <span className="material-symbols-outlined text-[18px]">clear</span>
              </button>
            )}
            <button
              aria-label="Pesquisa por voz"
              onClick={() => {
                setVoiceActive(!voiceActive);
                if (!voiceActive) {
                  setTimeout(() => {
                    setSearchQuery('Planetário de Braga');
                    setVoiceActive(false);
                  }, 1800);
                }
              }}
              className={`p-1.5 transition-colors rounded-full flex items-center justify-center min-w-[36px] min-h-[36px] ${
                voiceActive ? 'text-secondary animate-pulse bg-secondary/10' : 'text-outline hover:text-primary'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
          </div>

          <button
            aria-label="Filtros avançados"
            onClick={() => setAdvancedFilterOpen(true)}
            className={`relative flex items-center justify-center rounded-2xl min-w-[52px] min-h-[52px] shadow-sm active:scale-95 transition-all shrink-0 ${
              advancedFilters.amenities.length > 0 || advancedFilters.maxPrice !== null || advancedFilters.spaceType !== 'all'
                ? 'bg-secondary text-on-secondary shadow-md ring-2 ring-secondary/30'
                : 'bg-primary text-on-primary hover:bg-primary-container'
            }`}
            type="button"
            title="Abrir Filtros Familiares Avançados"
          >
            <span className="material-symbols-outlined text-[22px]">tune</span>
            {(advancedFilters.amenities.length > 0 || advancedFilters.maxPrice !== null) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-surface"></span>
            )}
          </button>
        </div>
      </section>

      {/* Weather & Real-Time Context Banner (Open-Meteo Live Data + GPS) */}
      <section className="px-4 mt-3 max-w-3xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high p-4 border border-surface-container-high shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-container-lowest text-primary shadow-xs shrink-0">
                <span className="material-symbols-outlined text-[28px]">
                  {liveWeather.isRain ? 'rainy' : liveWeather.weatherCode <= 2 ? 'wb_sunny' : 'partly_cloudy_day'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-base text-on-surface font-bold">
                    {liveWeather.city} • {liveWeather.temperature}ºC
                  </span>
                  <span className={`font-label-sm text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    liveWeather.isRain ? 'text-secondary bg-secondary-fixed/50' : 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {liveWeather.conditionLabel}
                  </span>
                  <span className="text-[10px] font-mono text-outline hidden sm:inline" title="API Open-Meteo">
                    ao vivo
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant truncate mt-0.5">
                  {liveWeather.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* GPS Geolocation Button */}
              <button
                onClick={requestUserLocation}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                  geoStatus === 'active'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 font-bold'
                    : 'bg-surface-container-lowest border-surface-container-high text-on-surface hover:bg-surface-container'
                }`}
                title={geoStatus === 'active' ? 'GPS ativo • Distâncias reais calculadas' : 'Ativar GPS para calcular distâncias reais'}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {geoStatus === 'active' ? 'my_location' : 'near_me'}
                </span>
                <span className="hidden sm:inline">
                  {geoStatus === 'active' ? 'GPS Ativo' : geoStatus === 'requesting' ? 'A obter...' : 'Usar GPS'}
                </span>
              </button>

              {/* Rain Filter Toggle */}
              <button
                onClick={() => setRainFilterActive(!rainFilterActive)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-label-md text-xs shadow-xs active:scale-95 transition-all shrink-0 ${
                  rainFilterActive
                    ? 'bg-secondary text-on-secondary font-bold ring-2 ring-secondary'
                    : 'bg-secondary-container text-on-secondary-container font-semibold hover:opacity-95'
                }`}
                type="button"
              >
                <span>{rainFilterActive ? 'Filtro Chuva Ativo' : 'Planos Cobertos'}</span>
                <span className="text-xs">☔</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Filter Pills (Horizontal Carousel) */}
      <section className="mt-3 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 overflow-x-auto px-4 no-scrollbar py-1">
          <button
            onClick={() => toggleFilter('idade-3-6')}
            className={`filter-pill flex items-center gap-1.5 px-3.5 py-2 rounded-full font-label-md text-xs whitespace-nowrap shadow-xs active:scale-95 transition-all ${
              selectedFilters.includes('idade-3-6')
                ? 'bg-primary text-on-primary font-semibold'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border border-surface-container-high'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">child_care</span>
            <span>Idade: 3–6 anos</span>
          </button>

          <button
            onClick={() => toggleFilter('gratis')}
            className={`filter-pill flex items-center gap-1.5 px-3.5 py-2 rounded-full font-label-md text-xs whitespace-nowrap shadow-xs active:scale-95 transition-all ${
              selectedFilters.includes('gratis')
                ? 'bg-primary text-on-primary font-semibold'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border border-surface-container-high'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">savings</span>
            <span>Grátis / Até 10€</span>
          </button>

          <button
            onClick={() => toggleFilter('interior')}
            className={`filter-pill flex items-center gap-1.5 px-3.5 py-2 rounded-full font-label-md text-xs whitespace-nowrap shadow-xs active:scale-95 transition-all ${
              selectedFilters.includes('interior')
                ? 'bg-primary text-on-primary font-semibold'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border border-surface-container-high'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">roofing</span>
            <span>Interior (Chuva)</span>
          </button>

          <button
            onClick={() => toggleFilter('fraldario')}
            className={`filter-pill flex items-center gap-1.5 px-3.5 py-2 rounded-full font-label-md text-xs whitespace-nowrap shadow-xs active:scale-95 transition-all ${
              selectedFilters.includes('fraldario')
                ? 'bg-primary text-on-primary font-semibold'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border border-surface-container-high'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">baby_changing_station</span>
            <span>Com Fraldário</span>
          </button>

          <button
            onClick={() => toggleFilter('carrinho')}
            className={`filter-pill flex items-center gap-1.5 px-3.5 py-2 rounded-full font-label-md text-xs whitespace-nowrap shadow-xs active:scale-95 transition-all ${
              selectedFilters.includes('carrinho')
                ? 'bg-primary text-on-primary font-semibold'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low border border-surface-container-high'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">stroller</span>
            <span>Acessível Carrinho</span>
          </button>

          <button
            onClick={() => toggleFilter('aberto')}
            className="filter-pill flex items-center gap-1.5 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low px-3.5 py-2 rounded-full font-label-md text-xs whitespace-nowrap shadow-xs active:scale-95 transition-all border border-surface-container-high"
            type="button"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>Aberto Agora</span>
          </button>
        </div>
      </section>

      {/* Perto de Ti Agora Section */}
      <section className="mt-5 px-4 flex flex-col gap-4 max-w-3xl mx-auto w-full">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-headline-md text-xl text-on-surface font-bold tracking-tight">Perto de Ti Agora</h2>
            <p className="font-body-sm text-xs text-on-surface-variant">Decisão imediata com horários e lotação atualizados</p>
          </div>
          <button
            onClick={onNavigateToMap}
            className="flex items-center gap-0.5 font-label-md text-xs text-primary font-semibold hover:underline"
          >
            <span>Mapa</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {/* POI Cards */}
        {filteredPois.map((poi) => {
          const isFav = favorites.includes(poi.id);
          return (
            <article
              key={poi.id}
              className="relative flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_4px_20px_-2px_rgba(20,122,130,0.06)] border border-surface-container-high transition-transform hover:-translate-y-0.5 group"
            >
              {/* Media Frame with badges */}
              <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container-high">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  alt={poi.name}
                  src={poi.coverImage}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Top Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[80%]">
                  {(() => {
                    const dist = userLocation
                      ? calculateDistanceKm(userLocation.lat, userLocation.lng, poi.latitude, poi.longitude)
                      : { distanceKm: poi.distanceKm, drivingMinutes: poi.distanceMinutes };
                    return (
                      <span className="bg-surface-container-lowest/95 backdrop-blur-md text-on-surface px-2.5 py-1 rounded-full font-label-md text-xs font-medium shadow-xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-primary text-[14px]">
                          {userLocation ? 'navigation' : 'near_me'}
                        </span>
                        A {dist.drivingMinutes} min ({dist.distanceKm} km)
                      </span>
                    );
                  })()}
                  <span className="bg-surface-container-lowest/95 backdrop-blur-md text-primary font-bold px-2.5 py-1 rounded-full font-label-md text-xs shadow-xs">
                    {poi.minAge}–{poi.maxAge} anos
                  </span>
                </div>

                {/* Favorite Toggle Button */}
                <button
                  aria-label="Guardar nos Favoritos"
                  onClick={() => toggleFavorite(poi.id)}
                  className={`absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-center shadow-md active:scale-90 transition-all ${
                    isFav ? 'text-secondary' : 'text-outline hover:text-secondary'
                  }`}
                  type="button"
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={isFav ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {isFav ? 'favorite' : 'favorite_border'}
                  </span>
                </button>

                {/* Bottom Badges on Image */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="bg-primary/90 text-on-primary px-2 py-0.5 rounded-full font-label-sm text-[11px] backdrop-blur-xs font-semibold">
                      {poi.spaceType === 'interior'
                        ? 'Interior 🏛️'
                        : poi.spaceType === 'exterior'
                        ? 'Exterior 🌳'
                        : 'Interior & Jardim 🌸'}
                    </span>
                    <span className="bg-black/60 text-white px-2 py-0.5 rounded-full font-label-sm text-[11px] backdrop-blur-xs font-medium">
                      {poi.isFree ? 'Gratuito' : `${poi.priceChild.toFixed(2)}€ / criança`}
                    </span>
                  </div>

                  <span className="font-label-sm text-[11px] bg-surface-container-lowest/95 text-on-surface font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    {poi.isOpenNow ? 'Aberto Hoje' : 'Encerrado'}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4 flex flex-col gap-3">
                <div>
                  <h3 className="font-headline-sm text-base text-on-surface font-bold leading-tight">
                    {poi.name}
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 mt-1">
                    {poi.shortDescription}
                  </p>
                </div>

                {/* Trust Verification Badge */}
                <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 w-fit">
                  <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-[16px]">verified</span>
                  <span className="font-label-sm text-[11px] font-medium">
                    Verificado há {poi.verifiedAgoDays} dias • Lotação e bilhética confirmadas
                  </span>
                </div>

                {/* Amenities & Action Button */}
                <div className="pt-1 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-on-surface-variant font-label-sm text-[11px]">
                    {poi.amenities.slice(0, 3).map((amenity) => (
                      <div key={amenity.id} className="flex items-center gap-1" title={amenity.description}>
                        <span className="material-symbols-outlined text-primary text-[18px]">{amenity.icon}</span>
                        <span className="hidden sm:inline">{amenity.label.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => onSelectPoi(poi)}
                    className="flex items-center gap-1 bg-primary text-on-primary px-3.5 py-2 rounded-xl font-label-md text-xs font-semibold hover:bg-primary-container active:scale-95 transition-all shadow-xs"
                    type="button"
                  >
                    <span>Ver Detalhe</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {/* Interactive Map Preview Callout */}
      <section className="px-4 mt-6 max-w-3xl mx-auto w-full">
        <div className="relative rounded-2xl overflow-hidden bg-surface-container p-4 border border-surface-container-high shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">explore</span>
              <span className="font-headline-sm text-base text-on-surface font-bold">Explora no Mapa Interativo</span>
            </div>
            <span className="font-label-sm text-xs bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full">
              {pois.length} locais abertos
            </span>
          </div>

          <div
            className="w-full h-36 rounded-xl bg-cover bg-center shadow-inner relative flex items-end p-3 overflow-hidden cursor-pointer"
            onClick={onNavigateToMap}
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDTSdoFecr0G_AFi_ehaex1pDPjMLzsg6_kPQhha8BxJAeAfQN22RbT3DnBydmRsU8KfU4_qt278kXoxWfMGSYp7ip9n2h0OvacMtI51P923pqtlBo68STo0K1kQgkaF74FLzVBadEd-PFaJuYt-NsUudlDmOAae-96Gl_rx3LixZllB6FJkhsAtuhTlCI3wD1_mTWPU9bo_zcl-29_CXfCWQEoBCHkS_BqCBv-fMDXlRmZ4R4iWduUzg')",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <button
              className="relative w-full flex items-center justify-center gap-2 bg-surface-container-lowest/95 backdrop-blur-md text-primary font-label-md text-xs font-bold py-2.5 rounded-xl shadow-md active:scale-98 transition-transform"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              <span>Abrir Mapa com Filtros da Família</span>
            </button>
          </div>
        </div>
      </section>

      {/* Destaques do Fim de Semana (Braga & Porto) Carousel */}
      <section className="mt-6 flex flex-col gap-2 max-w-3xl mx-auto w-full">
        <div className="px-4 flex items-baseline justify-between">
          <div>
            <h2 className="font-headline-md text-xl text-on-surface font-bold tracking-tight">Fim de Semana em Família</h2>
            <p className="font-body-sm text-xs text-on-surface-variant">Eventos com data confirmada em Braga e Porto</p>
          </div>
          <span className="font-label-sm text-xs bg-tertiary-fixed text-on-tertiary-fixed font-bold px-2 py-1 rounded-full">
            Próx. Sáb & Dom
          </span>
        </div>

        {/* Horizontal Event Cards */}
        <div className="flex gap-4 overflow-x-auto px-4 no-scrollbar py-2">
          {/* Event 1 */}
          <article className="shrink-0 w-[270px] bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-surface-container-high flex flex-col">
            <div className="relative w-full h-36 bg-surface-container-high overflow-hidden">
              <img
                className="w-full h-full object-cover"
                alt="Serralves Bichos da Floresta"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBa66VhXhbItGhdrjodTH4d2xhMrfiM88sd_BIknbjlGI7odcqxFbk_AXAJxdg7Hd8vLFge76iOkE8M5pjGRCfm-fpxOjZUvTcAx8L-3S8WckZeCoj8dgFTOClHQ-Y7wrie8PWokBeHvuir-ItEMNOunXdnNgIShwcoPmFT6GNAyFXgKTKzoAVfId4BHcjGphJiCSKSSyrD4LpYnn56o7M3VQyAwSyfUonXqDIyXjV1GDkTDRGNAto-lQ"
              />
              <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white font-label-sm text-[11px] px-2 py-0.5 rounded-full font-medium">
                Porto (a 42 min)
              </span>
              <span className="absolute bottom-2 left-2 bg-secondary text-on-secondary font-label-sm text-[11px] px-2 py-0.5 rounded-md font-bold">
                Dom • 10:30
              </span>
            </div>
            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div>
                <span className="font-label-sm text-[11px] text-primary font-bold">Oficina Ecológica</span>
                <h4 className="font-headline-sm text-sm text-on-surface font-bold leading-tight mt-0.5">
                  Serralves: Bichos da Floresta
                </h4>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">
                  Exploração na copa das árvores no Treetop Walk e criação de insetos botânicos.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-surface-container-high flex items-center justify-between">
                <span className="font-label-md text-xs text-on-surface font-bold">5€ (Gratuito &lt;4a)</span>
                <span className="material-symbols-outlined text-primary text-[20px]">bookmark_add</span>
              </div>
            </div>
          </article>

          {/* Event 2 */}
          <article className="shrink-0 w-[270px] bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-surface-container-high flex flex-col">
            <div className="relative w-full h-36 bg-surface-container-high overflow-hidden">
              <img
                className="w-full h-full object-cover"
                alt="Theatro Circo Braga"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDu1qQ_TxxGdVYXxCKmAP6eevWXNWuFoIGZbfxs7VsGpeIBnRchXNGZ-Tfq-mxLcc90SkoYpp5PEUNpdqr90deCbMr3XL5KBejjsblMF_PhGJTE-Or07gTQyGPHgHnTeYSenThlIjWLjSDtOBXLuP045DNxaq8hZT48snO6cPBYNHlfLNHv35rtX61IwNOvAyg7Eejb3ZKxIbfOW7EWCsa_5mqsC1vPT_bQy4SVVE4tdoTXjPotydq1Tw"
              />
              <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white font-label-sm text-[11px] px-2 py-0.5 rounded-full font-medium">
                Braga Centro
              </span>
              <span className="absolute bottom-2 left-2 bg-secondary text-on-secondary font-label-sm text-[11px] px-2 py-0.5 rounded-md font-bold">
                Sáb • 16:00
              </span>
            </div>
            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div>
                <span className="font-label-sm text-[11px] text-primary font-bold">Música & Teatro</span>
                <h4 className="font-headline-sm text-sm text-on-surface font-bold leading-tight mt-0.5">
                  Concerto para Bebés & Pequenos
                </h4>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">
                  Experiência sonora no Theatro Circo com flautas, marimbas e estimulação suave.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-surface-container-high flex items-center justify-between">
                <span className="font-label-md text-xs text-on-surface font-bold">7.50€ Família</span>
                <span className="material-symbols-outlined text-primary text-[20px]">bookmark_add</span>
              </div>
            </div>
          </article>

          {/* Event 3 */}
          <article className="shrink-0 w-[270px] bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-surface-container-high flex flex-col">
            <div className="relative w-full h-36 bg-surface-container-high overflow-hidden">
              <img
                className="w-full h-full object-cover"
                alt="Pavilhão da Água Porto"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCuB5fb99q4dbDJgB8TAnRbQ8W0JNDCiUJH6zpug9WcgWYCDM5jZgNCsivY3h-FW6egFJr0-l9pOtThvlMt8BxnsDJZwYG4kfUs_DuwMWJL5UosC4SlYKZG16UKwTG1GpisCkHUEO_bu2-kGonrVB9LLyN4Lz0OyjtvoOzC9gMaOGFXKEGx5DxCPI5ZsdAD5gjXe8Jk2Oo7oLJ2hRaOHqtu55fD_dErWXdW5LDTwGOLYIYbOfcrPHjJ2w"
              />
              <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white font-label-sm text-[11px] px-2 py-0.5 rounded-full font-medium">
                Porto (Parque da Cidade)
              </span>
              <span className="absolute bottom-2 left-2 bg-secondary text-on-secondary font-label-sm text-[11px] px-2 py-0.5 rounded-md font-bold">
                Sáb • 11:00
              </span>
            </div>
            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div>
                <span className="font-label-sm text-[11px] text-primary font-bold">Ciência Divertida</span>
                <h4 className="font-headline-sm text-sm text-on-surface font-bold leading-tight mt-0.5">
                  Segredos dos Rios do Norte
                </h4>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1 line-clamp-2">
                  Jogos interativos de correntes e micro-organismos aquáticos pensados dos 4 aos 11 anos.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-surface-container-high flex items-center justify-between">
                <span className="font-label-md text-xs text-on-surface font-bold">4€ / pessoa</span>
                <span className="material-symbols-outlined text-primary text-[20px]">bookmark_add</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Community Tip Prompt / Callout */}
      <section className="px-4 mt-6 max-w-3xl mx-auto w-full">
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary-container shrink-0">
            <span className="material-symbols-outlined text-[22px]">diversity_1</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-headline-sm text-sm text-on-surface font-bold leading-tight">
              Viste um parque novo ou fraldário limpo?
            </p>
            <p className="font-body-sm text-xs text-on-surface-variant truncate mt-0.5">
              Partilha com outras famílias de Braga em 30 segundos.
            </p>
          </div>
          <button
            onClick={onOpenReportModal}
            className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface px-3 py-1.5 rounded-xl font-label-md text-xs font-semibold transition-all shrink-0 active:scale-95"
            type="button"
          >
            Contribuir
          </button>
        </div>
      </section>

      {/* Advanced Filter Modal */}
      <AdvancedFilterModal
        isOpen={advancedFilterOpen}
        onClose={() => setAdvancedFilterOpen(false)}
        filters={advancedFilters}
        onChangeFilters={setAdvancedFilters}
        resultsCount={filteredPois.length}
      />
    </div>
  );
};
