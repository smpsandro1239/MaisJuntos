import React, { useMemo, useState } from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { useAuth } from '../../context/AuthContext';
import { POI, ReportIssueType, ProposedPlace } from '../../types';
import { calculateDistanceKm } from '../../services/weatherGeoService';
import { compressImageFile } from '../../services/imageUtils';
import { parseCoordsFromLink } from '../../utils/geoLink';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPoi?: POI | null;
}

type ReportMode = 'report' | 'new_place';

interface IssueOption {
  value: ReportIssueType;
  label: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'tertiary' | 'error';
}

const ISSUE_OPTIONS: IssueOption[] = [
  { value: 'price_changed', label: 'Preço Mudou', icon: 'payments', tone: 'secondary' },
  { value: 'nursery_closed', label: 'Fraldário / Acesso', icon: 'baby_changing_station', tone: 'primary' },
  { value: 'schedule_wrong', label: 'Horário Errado', icon: 'schedule', tone: 'tertiary' },
  { value: 'temporary_closure', label: 'Obras / Fechado', icon: 'lock_clock', tone: 'error' },
  { value: 'accessibility', label: 'Acessibilidade', icon: 'accessible', tone: 'primary' },
  { value: 'parking', label: 'Estacionamento', icon: 'local_parking', tone: 'secondary' },
  { value: 'confirm_ok', label: 'Confirmo que está bom', icon: 'verified', tone: 'tertiary' },
];

const ISSUE_LABELS: Record<ReportIssueType, string> = {
  price_changed: 'Preço Alterado',
  nursery_closed: 'Fraldário / Acessibilidade',
  schedule_wrong: 'Horário Incorreto',
  temporary_closure: 'Encerramento / Obras',
  accessibility: 'Acessibilidade',
  parking: 'Estacionamento',
  confirm_ok: 'Confirmação Local',
  new_place: 'Novo Espaço',
};

const SEVERITY: Record<ReportIssueType, 'critical' | 'warning' | 'info'> = {
  price_changed: 'critical',
  nursery_closed: 'critical',
  schedule_wrong: 'warning',
  temporary_closure: 'warning',
  accessibility: 'warning',
  parking: 'warning',
  confirm_ok: 'info',
  new_place: 'info',
};

const PLACE_CATEGORIES = [
  { value: 'parque', label: 'Parque / Espaço de lazer' },
  { value: 'animais', label: 'Animais / Quinta pedagógica' },
  { value: 'cultura', label: 'Museu / Cultura' },
  { value: 'desporto', label: 'Desporto / Piscina' },
  { value: 'natureza', label: 'Natureza / Trilhos' },
  { value: 'outro', label: 'Outro' },
];

const TONE_CLASS: Record<IssueOption['tone'], { active: string; idle: string }> = {
  primary: {
    active: 'border-primary bg-primary-fixed/40 text-on-primary-fixed-variant font-semibold',
    idle: 'border-surface-container-high bg-surface-container-low text-on-surface-variant',
  },
  secondary: {
    active: 'border-secondary bg-secondary-fixed/40 text-on-secondary-fixed font-semibold',
    idle: 'border-surface-container-high bg-surface-container-low text-on-surface-variant',
  },
  tertiary: {
    active: 'border-tertiary bg-tertiary-fixed/40 text-on-tertiary-fixed font-semibold',
    idle: 'border-surface-container-high bg-surface-container-low text-on-surface-variant',
  },
  error: {
    active: 'border-error bg-error-container/40 text-on-error-container font-semibold',
    idle: 'border-surface-container-high bg-surface-container-low text-on-surface-variant',
  },
};

const emptyPlace = (): ProposedPlace => ({
  name: '',
  category: 'parque',
  address: '',
  city: 'Braga',
  isFree: true,
  priceFamily: 0,
  spaceType: 'exterior',
  isOpenNow: true,
});

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, targetPoi }) => {
  const { pois, submitReport } = useRealtime();
  const { user } = useAuth();

  const [mode, setMode] = useState<ReportMode>('report');
  const [selectedPoiId, setSelectedPoiId] = useState<string>(targetPoi?.id || (pois[0]?.id ?? ''));
  const [issueType, setIssueType] = useState<ReportIssueType>('price_changed');
  const [comment, setComment] = useState('');
  const [newValue, setNewValue] = useState('');
  const [place, setPlace] = useState<ProposedPlace>(emptyPlace());
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLink, setLocationLink] = useState('');
  const [locationLinkInfo, setLocationLinkInfo] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checklist, setChecklist] = useState([
    { id: 'c1', label: 'Estivemos no local hoje', checked: false },
    { id: 'c2', label: 'Informação confirmada na receção ou no local', checked: false },
  ]);

  const currentPoi = useMemo(
    () => pois.find((p) => p.id === selectedPoiId) || targetPoi || pois[0] || null,
    [pois, selectedPoiId, targetPoi]
  );

  if (!isOpen) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const compressed = await compressImageFile(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Não foi possível processar a imagem.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const captureMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setPhotoError('A geolocalização não está disponível neste dispositivo.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null),
      { timeout: 5000, enableHighAccuracy: true }
    );
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  // Liga uma ligação de mapa colada: extrai coordenadas, se possível, sem
  // impedir o envio quando não for possível extraí-las.
  const handleLocationLink = (value: string) => {
    setLocationLink(value);
    const parsed = value.trim() ? parseCoordsFromLink(value) : null;
    if (parsed) {
      setCoords(parsed);
      setLocationLinkInfo(`Coordenadas reconhecidas (${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)}).`);
    } else if (value.trim()) {
      setLocationLinkInfo('Não foi possível extrair coordenadas; a ligação segue para a curadoria.');
    } else {
      setLocationLinkInfo(null);
    }
  };

  const hasPhoto = Boolean(photoDataUrl || photoUrlInput.trim());

  // A localização deixou de ser obrigatória: a morada + (opcionalmente) GPS ou
  // uma ligação de mapa chegam para propor o espaço. Isto corrige o botão que
  // ficava inativo e impedia a submissão de "Propor espaço".
  const canSubmit =
    comment.trim().length > 0 &&
    (mode === 'new_place'
      ? place.name.trim() !== '' &&
        place.category !== '' &&
        place.address.trim() !== '' &&
        place.city.trim() !== ''
      : Boolean(currentPoi));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const reporterName = user.name || 'Família da Comunidade';
      const reporterTrust = user.trustScore || 90;
      let result: { ok: boolean; error?: string } | null = null;

      if (mode === 'new_place') {
        const proposedPlace: ProposedPlace = {
          ...place,
          ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
          ...(locationLink.trim() ? { locationLink: locationLink.trim() } : {}),
        };
        result = await submitReport({
          issueType: 'new_place',
          issueLabel: ISSUE_LABELS.new_place,
          severity: SEVERITY.new_place,
          poiName: proposedPlace.name,
          poiAddress: `${proposedPlace.address}, ${proposedPlace.city}`,
          poiPhone: '',
          reporterName,
          reporterSubtitle: 'Proposta de novo espaço em Braga',
          reporterTrust,
          comment: comment.trim(),
          oldValue: 'Espaço ainda não catalogado',
          newValue: proposedPlace.name,
          gpsDistanceProofMeters: -1,
          hasPhotoProof: hasPhoto,
          checklist,
          proposedPlace,
          ...(photoDataUrl
            ? { photo: photoDataUrl }
            : photoUrlInput.trim()
            ? { photoProofUrl: photoUrlInput.trim() }
            : {}),
        });
      } else {
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

        const finalComment = proximityValidationNote
          ? `${comment.trim()}\n\n[Validação GPS]: ${proximityValidationNote}`
          : comment.trim();

        result = await submitReport({
          poiId: currentPoi?.id,
          poiName: currentPoi?.name || 'Local em Braga',
          poiAddress: currentPoi?.address || 'Braga',
          issueType,
          issueLabel: ISSUE_LABELS[issueType],
          severity: SEVERITY[issueType],
          reporterName,
          reporterSubtitle: 'Família registada em Braga',
          reporterTrust,
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
          hasPhotoProof: hasPhoto,
          checklist,
          ...(photoDataUrl
            ? { photo: photoDataUrl }
            : photoUrlInput.trim()
            ? { photoProofUrl: photoUrlInput.trim() }
            : {}),
        });
      }
      if (!result?.ok) {
        setSubmitError(result?.error || 'Não foi possível enviar a contribuição. Tente novamente.');
        return; // não fechar o modal em caso de erro
      }
      onClose();
    } catch {
      setSubmitError('Não foi possível enviar a contribuição. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-sm font-body-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high p-6 flex flex-col gap-4 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="w-10 h-10 rounded-2xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">diversity_1</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-lg text-on-surface font-bold leading-tight">
              Contribuir com a comunidade
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
              Corrige uma informação ou propõe um espaço novo em 30 segundos
            </p>
          </div>
        </div>

        {/* Seletor de modo: alteração vs. novo espaço */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface-container-low border border-surface-container-high">
          <button
            type="button"
            onClick={() => setMode('report')}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'report' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">flag</span> Reportar alteração
          </button>
          <button
            type="button"
            onClick={() => setMode('new_place')}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'new_place' ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">add_location_alt</span> Novo espaço
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-1">
          {mode === 'report' ? (
            <>
              {/* Target POI */}
              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1">Ponto de Interesse</label>
                <select
                  value={selectedPoiId}
                  onChange={(e) => setSelectedPoiId(e.target.value)}
                  className={fieldClass}
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
                  {ISSUE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIssueType(opt.value)}
                      className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all ${
                        issueType === opt.value ? TONE_CLASS[opt.tone].active : TONE_CLASS[opt.tone].idle
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] text-${opt.tone}`}
                        style={{ color: 'currentColor' }}
                      >
                        {opt.icon}
                      </span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
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
                  className={fieldClass}
                />
              </div>
            </>
          ) : (
            <>
              {/* Novo espaço */}
              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1">
                  Nome do espaço <span className="text-secondary">*</span>
                </label>
                <input
                  type="text"
                  value={place.name}
                  onChange={(e) => setPlace((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Parque de Merendas da Falperra"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1">Categoria</label>
                <select
                  value={place.category}
                  onChange={(e) => setPlace((p) => ({ ...p, category: e.target.value }))}
                  className={fieldClass}
                >
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block font-label-md text-xs text-on-surface mb-1">
                    Morada <span className="text-secondary">*</span>
                  </label>
                  <input
                    type="text"
                    value={place.address}
                    onChange={(e) => setPlace((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Ex: Lugar de Cabanas, Real"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">Cidade</label>
                  <input
                    type="text"
                    value={place.city}
                    onChange={(e) => setPlace((p) => ({ ...p, city: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
              </div>

              {/* Localização: GPS ou ligação colada (opcional) */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">Localização no mapa</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={captureMyLocation}
                      className="h-10 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">my_location</span>
                      Usar a minha localização
                    </button>
                    {coords && (
                      <button
                        type="button"
                        onClick={() => {
                          setCoords(null);
                          setLocationLinkInfo(null);
                        }}
                        className="text-[11px] text-on-surface-variant underline"
                      >
                        Limpar
                      </button>
                    )}
                    <span className="text-[11px] text-on-surface-variant">
                      {coords
                        ? `Coordenadas: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                        : 'Opcional — podes colar uma ligação abaixo'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">
                    Ligação do mapa (Google Maps / OpenStreetMap)
                  </label>
                  <input
                    type="text"
                    value={locationLink}
                    onChange={(e) => handleLocationLink(e.target.value)}
                    placeholder="Cola aqui uma ligação (ex: https://maps.google.com/.../@41.55,-8.42,15z)"
                    className={fieldClass}
                  />
                  {locationLinkInfo && (
                    <p className="text-[11px] text-on-surface-variant mt-1">{locationLinkInfo}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">Idade mínima</label>
                  <input
                    type="number"
                    min={0}
                    value={place.minAge ?? ''}
                    onChange={(e) =>
                      setPlace((p) => ({ ...p, minAge: e.target.value === '' ? undefined : Number(e.target.value) }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">Idade máxima</label>
                  <input
                    type="number"
                    min={0}
                    value={place.maxAge ?? ''}
                    onChange={(e) =>
                      setPlace((p) => ({ ...p, maxAge: e.target.value === '' ? undefined : Number(e.target.value) }))
                    }
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1">Entrada</label>
                  <select
                    value={place.isFree ? 'free' : 'paid'}
                    onChange={(e) => {
                      const isFree = e.target.value === 'free';
                      setPlace((p) => ({ ...p, isFree, priceFamily: isFree ? 0 : p.priceFamily }));
                    }}
                    className={fieldClass}
                  >
                    <option value="free">Gratuito</option>
                    <option value="paid">Pago</option>
                  </select>
                </div>
                {!place.isFree && (
                  <div>
                    <label className="block font-label-md text-xs text-on-surface mb-1">Preço família (€)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={place.priceFamily ?? 0}
                      onChange={(e) => setPlace((p) => ({ ...p, priceFamily: Number(e.target.value) }))}
                      className={fieldClass}
                    />
                  </div>
                )}
              </div>

              {/* Campos alinhados com os filtros familiares */}
              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1">Ambiente</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'interior', label: 'Interior ☔' },
                    { id: 'exterior', label: 'Ar Livre 🌳' },
                    { id: 'mixed', label: 'Misto' },
                  ].map((space) => (
                    <button
                      key={space.id}
                      type="button"
                      onClick={() => setPlace((p) => ({ ...p, spaceType: space.id as 'interior' | 'exterior' | 'mixed' }))}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        place.spaceType === space.id
                          ? 'border-secondary-container bg-secondary-container text-on-secondary font-bold shadow-xs'
                          : 'border-surface-container-high bg-surface-container-low text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {space.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { id: 'place-nursery', key: 'hasNursery', label: 'Tem fraldário / estação de changing' },
                  { id: 'place-stroller', key: 'hasStrollerAccess', label: 'Acessível a carrinho de bebé' },
                  { id: 'place-parking', key: 'hasParking', label: 'Estacionamento fácil no local' },
                  { id: 'place-open', key: 'isOpenNow', label: 'Está aberto agora / aberto hoje' },
                ].map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-xs text-on-surface cursor-pointer select-none">
                    <input
                      id={item.id}
                      type="checkbox"
                      checked={Boolean(place[item.key as keyof ProposedPlace])}
                      onChange={(e) => setPlace((p) => ({ ...p, [item.key]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1">Horário (se aplicável)</label>
                <input
                  type="text"
                  value={place.scheduleNote ?? ''}
                  onChange={(e) => setPlace((p) => ({ ...p, scheduleNote: e.target.value }))}
                  placeholder="Ex: Terça a domingo, 09:30 – 17:30"
                  className={fieldClass}
                />
              </div>
            </>
          )}

          {/* Comprovativo fotográfico */}
          <div>
            <label className="block font-label-md text-xs text-on-surface mb-1">
              Comprovativo fotográfico (opcional)
            </label>
            <div className="flex items-start gap-3">
              <label className="h-10 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0">
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                {photoBusy ? 'A processar…' : photoDataUrl ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
              </label>
              <div className="flex items-center gap-2 min-w-0">
                {(photoDataUrl || photoUrlInput.trim()) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoDataUrl || photoUrlInput.trim()}
                    alt="Comprovativo fotográfico"
                    className="w-14 h-14 rounded-xl object-cover border border-surface-container-high shrink-0"
                    onError={() => setPhotoError('Não foi possível carregar a imagem dessa ligação.')}
                  />
                )}
                <div className="min-w-0">
                  {photoError ? (
                    <p className="text-[11px] text-error">{photoError}</p>
                  ) : (
                    <p className="text-[11px] text-on-surface-variant">
                      {photoDataUrl
                        ? 'Foto pronta a enviar.'
                        : photoUrlInput.trim()
                        ? 'Ligação de imagem pronta a enviar.'
                        : 'Mostra o local, o preço ou o fraldário.'}
                    </p>
                  )}
                  {(photoDataUrl || photoUrlInput.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoDataUrl(null);
                        setPhotoUrlInput('');
                        setPhotoError(null);
                      }}
                      className="text-[11px] text-on-surface-variant underline mt-0.5"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input
              type="text"
              value={photoUrlInput}
              onChange={(e) => {
                setPhotoUrlInput(e.target.value);
                setPhotoDataUrl(null);
                setPhotoError(
                  e.target.value.trim() && !/^https?:\/\//i.test(e.target.value.trim())
                    ? 'A ligação deve começar por http:// ou https://'
                    : null
                );
              }}
              placeholder="…ou cola a ligação de uma imagem (https://...)"
              className={`${fieldClass} mt-2`}
            />
          </div>

          {/* Checklist real */}
          <div>
            <label className="block font-label-md text-xs text-on-surface mb-1">Confirmação</label>
            <div className="flex flex-col gap-1.5">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 text-xs text-on-surface cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleChecklist(item.id)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  {item.label}
                </label>
              ))}
            </div>
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
              placeholder={
                mode === 'new_place'
                  ? 'O que torna este espaço bom para crianças?'
                  : 'Estivemos no local e verificámos que...'
              }
              className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface text-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {submitError && (
            <p role="alert" className="text-xs text-error bg-error/10 rounded-xl px-3 py-2">
              {submitError}
            </p>
          )}

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
              disabled={submitting || !canSubmit}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>
                {submitting ? 'A enviar...' : mode === 'new_place' ? 'Propor espaço' : 'Submeter alerta'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
