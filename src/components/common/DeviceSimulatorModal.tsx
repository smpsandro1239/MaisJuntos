import React, { useState } from 'react';
import { POI } from '../../types';

interface DeviceSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  poi: POI;
}

export const DeviceSimulatorModal: React.FC<DeviceSimulatorModalProps> = ({
  isOpen,
  onClose,
  poi,
}) => {
  const [deviceModel, setDeviceModel] = useState<'ios' | 'android'>('ios');
  const [deviceDarkMode, setDeviceDarkMode] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-4 max-h-[95vh]">
        {/* Device Control Toolbar */}
        <div className="flex items-center gap-3 bg-surface-container-lowest/90 backdrop-blur-md px-4 py-2 rounded-full border border-surface-container-high shadow-lg text-xs font-semibold">
          <div className="flex items-center gap-1 bg-surface-container rounded-full p-1">
            <button
              onClick={() => setDeviceModel('ios')}
              className={`px-3 py-1 rounded-full transition-all ${
                deviceModel === 'ios' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-on-surface'
              }`}
            >
              iPhone 16 Pro
            </button>
            <button
              onClick={() => setDeviceModel('android')}
              className={`px-3 py-1 rounded-full transition-all ${
                deviceModel === 'android' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-on-surface'
              }`}
            >
              Pixel 9 Pro
            </button>
          </div>

          <button
            onClick={() => setDeviceDarkMode(!deviceDarkMode)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              {deviceDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{deviceDarkMode ? 'Claro' : 'Escuro'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface ml-2"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Device Frame */}
        <div
          className={`relative w-[380px] h-[720px] bg-surface rounded-[48px] shadow-2xl border-[10px] overflow-hidden flex flex-col transition-all ${
            deviceModel === 'ios'
              ? 'border-neutral-900 ring-4 ring-neutral-700/40'
              : 'border-zinc-800 rounded-[36px]'
          } ${deviceDarkMode ? 'dark bg-neutral-950 text-neutral-100' : 'bg-[#fbf9f6] text-[#1b1c1a]'}`}
        >
          {/* Dynamic Island / Camera Notch */}
          <div className="w-full flex justify-center pt-3 pb-1 shrink-0 z-20">
            {deviceModel === 'ios' ? (
              <div className="w-28 h-6 bg-black rounded-full flex items-center justify-between px-3">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-900" />
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800/80" />
              </div>
            ) : (
              <div className="w-3.5 h-3.5 bg-black rounded-full" />
            )}
          </div>

          {/* Screen Content - Interactive POI Detail Card */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 flex flex-col gap-3">
            {/* Header snippet */}
            <div className="flex items-center justify-between text-xs font-bold text-[#006067] dark:text-[#7fd4dc]">
              <span>+JUNTOS</span>
              <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">Feed dos Pais</span>
            </div>

            {/* Simulated Live POI Card */}
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col">
              <div className="relative w-full aspect-[16/9] bg-neutral-200">
                <img
                  src={poi.coverImage}
                  alt={poi.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="px-2 py-0.5 rounded-full bg-[#006067] text-white text-[10px] font-bold">
                    {poi.categoryLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur-xs font-semibold">
                    {poi.spaceType === 'interior' ? 'Interior 🏛️' : 'Exterior 🌳'}
                  </span>
                </div>
                <span className="absolute bottom-2 right-2 bg-white/95 dark:bg-neutral-900/95 text-[#006067] dark:text-[#7fd4dc] font-bold text-[11px] px-2 py-0.5 rounded-full shadow-xs">
                  {poi.isFree ? 'Grátis' : `${poi.priceChild.toFixed(2)}€`}
                </span>
              </div>

              <div className="p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    {poi.isOpenNow ? 'Aberto Hoje' : 'Encerrado'}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-semibold">{poi.minAge} aos {poi.maxAge} anos</span>
                </div>

                <h3 className="font-bold text-sm leading-tight text-neutral-900 dark:text-neutral-100">
                  {poi.name}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                  {poi.shortDescription}
                </p>

                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <span>Verificado editorialmente • Confiança {poi.dataQualityScore}%</span>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 text-[11px]">
                  <span className="text-neutral-500">A {poi.distanceMinutes} min ({poi.distanceKm} km)</span>
                  <button className="px-3 py-1 rounded-lg bg-[#006067] text-white font-bold text-xs shadow-2xs">
                    Ver Detalhes
                  </button>
                </div>
              </div>
            </div>

            {/* Family amenities list */}
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col gap-1.5 text-xs">
              <span className="font-bold text-[11px] text-neutral-800 dark:text-neutral-200">Comodidades Auditadas:</span>
              {poi.amenities.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-[11px]">
                  <span className="material-symbols-outlined text-[15px] text-[#006067]">{a.icon}</span>
                  <span>{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Home Indicator */}
          <div className="w-full flex justify-center pb-2 pt-1">
            <div className="w-32 h-1 bg-neutral-400 dark:bg-neutral-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
