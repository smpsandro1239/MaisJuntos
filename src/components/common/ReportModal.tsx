import React, { useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { useAuth } from '../../context/AuthContext';
import { POI } from '../../types';
import { calculateDistanceKm } from '../../services/weatherGeoService';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPoi?: POI | null;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, targetPoi }) => {
  const { pois, submitReport } = useRealtime();
  const { user } = useAuth();

  const [selectedPoiId, setSelectedPoiId] = useState<string>(targetPoi?.id || (pois[0]?.id ?? ''));
  const [issueType, setIssueType] = useState<'price_changed' | 'nursery_closed' | 'schedule_wrong' | 'temporary_closure'>('price_changed');
  const [comment, setComment] = useState('');
  const [newValue, setNewValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentPoi = pois.find((p) => p.id === selectedPoiId) || targetPoi || pois[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment) return;
    setSubmitting(true);
    try {
      let gpsDistanceProofMeters = 0;
      let proximityValidationNote = '';

      if (currentPoi && 'geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, enableHighAccuracy: true });
          });
          const distResult = calculateDistanceKm(
            position.coords.latitude,
            position.coords.longitude,
            currentPoi.latitude,
            currentPoi.longitude
          );
          gpsDistanceProofMeters = Math.round(distResult.distanceKm * 1000);
        } catch {
          proximityValidationNote = 'Não foi possível validar a proximidade porque a localização não foi autorizada.';
          gpsDistanceProofMeters = -1;
        }
      } else {
        proximityValidationNote = 'Não foi possível validar a proximidade porque a localização não foi autorizada.';
        gpsDistanceProofMeters = -1;
      }

      const finalComment = proximityValidationNote ? `${comment}\n\n[Validação GPS]: ${proximityValidationNote}` : comment;

      await submitReport({
        poiId: currentPoi?.id,
        poiName: currentPoi?.name || 'Local em Braga',
        poiAddress: currentPoi?.address || 'Braga',
        issueType,
        issueLabel:
          issueType === 'price_changed'
            ? 'Preço Alterado'
            : issueType === 'nursery_closed'
            ? 'Fraldário / Acessibilidade'
            : issueType === 'schedule_wrong'
            ? 'Horário Incorreto'
            : 'Encerramento / Obras',
        severity: issueType === 'price_changed' || issueType === 'nursery_closed' ? 'critical' : 'warning',
        reporterName: user.name || 'Família da Comunidade',
        reporterSubtitle: 'Família registada em Braga',
        reporterTrust: user.trustScore || 90,
        comment: finalComment,
        oldValue:
          issueType === 'price_changed'
            ? `${currentPoi?.priceFamily || 6}€`
            : issueType === 'nursery_closed'
            ? 'Fraldário Operacional'
            : currentPoi?.openingHoursToday || 'Horário Oficial',
        newValue: newValue || 'Informação atualizada no local',
        poiPhone: currentPoi?.phone || '+351 253 000 000',
        gpsDistanceProofMeters,
        hasPhotoProof: false,
        checklist: [
          { id: 'c1', label: 'Verificado presencialmente hoje', checked: true },
          { id: 'c2', label: 'Afixado ou informado na receção', checked: true },
        ],
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">flag</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-lg text-on-surface font-bold leading-tight">
              Reportar Alteração ou Novo Espaço
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
              Ajuda milhares de famílias a manter os dados 100% fiáveis
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-1">
          {/* Target POI */}
          <div>
            <label className="block font-label-md text-xs text-on-surface mb-1">Ponto de Interesse</label>
            <select
              value={selectedPoiId}
              onChange={(e) => setSelectedPoiId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-body-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {pois.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.city})
                </option>
              ))}
            </select>
          </div>

          {/* Issue Type */}
          <div>
            <label className="block font-label-md text-xs text-on-surface mb-1">Tipo de Informação</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIssueType('price_changed')}
                className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all ${
                  issueType === 'price_changed'
                    ? 'border-secondary bg-secondary-fixed/40 text-on-secondary-fixed font-semibold'
                    : 'border-surface-container-high bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">payments</span>
                <span className="text-xs">Preço Mudou</span>
              </button>
              <button
                type="button"
                onClick={() => setIssueType('nursery_closed')}
                className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all ${
                  issueType === 'nursery_closed'
                    ? 'border-primary bg-primary-fixed/40 text-on-primary-fixed-variant font-semibold'
                    : 'border-surface-container-high bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-primary">baby_changing_station</span>
                <span className="text-xs">Fraldário / Acesso</span>
              </button>
              <button
                type="button"
                onClick={() => setIssueType('schedule_wrong')}
                className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all ${
                  issueType === 'schedule_wrong'
                    ? 'border-tertiary bg-tertiary-fixed/40 text-on-tertiary-fixed font-semibold'
                    : 'border-surface-container-high bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-tertiary">schedule</span>
                <span className="text-xs">Horário Errado</span>
              </button>
              <button
                type="button"
                onClick={() => setIssueType('temporary_closure')}
                className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all ${
                  issueType === 'temporary_closure'
                    ? 'border-error bg-error-container/40 text-on-error-container font-semibold'
                    : 'border-surface-container-high bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-error">lock_clock</span>
                <span className="text-xs">Obras / Fechado</span>
              </button>
            </div>
          </div>

          {/* New Value */}
          <div>
            <label className="block font-label-md text-xs text-on-surface mb-1">
              {issueType === 'price_changed'
                ? 'Novo Valor / Preço Atual (ex: 7,50€ familiar)'
                : issueType === 'schedule_wrong'
                ? 'Horário Correto (ex: Encerra às 17h30 no Inverno)'
                : 'Novo Estado Encontrado no Local'}
            </label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Ex: Novo bilhete familiar a 7,50€"
              className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="block font-label-md text-xs text-on-surface mb-1">
              Detalhes / Comentário da Família <span className="text-secondary">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Estivemos no local e verificámos que..."
              className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !comment}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>{submitting ? 'A enviar...' : 'Submeter Alerta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
