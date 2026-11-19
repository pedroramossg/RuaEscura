import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  Lightbulb,
  Lock,
  PhoneCall,
  Search,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { useHaptics } from '../../hooks/useHaptics';
import { ReportSubmissionSchema } from '../../security/schemas';
import { validateEvidenceImage } from '../../security/fileValidation';
import type { ReportCategory, ReportStatus } from '../../types/campus';
import { PillButton } from '../ui/PillButton';
import { VirtualizedList } from '../ui/VirtualizedList';
import { DropletMascot, DROPLET_ALL_STATES } from '../mascot/DropletMascot';
import { TrioCharacterAvatar, TrioMascotStack } from '../mascot/TrioMascotBadge';

type DropletState = (typeof DROPLET_ALL_STATES)[number];

export interface ReportsTabProps {
  onNotify?: (message: string) => void;
}

type FeedFilter = 'all' | ReportCategory;

const CATEGORY_META: Record<
  ReportCategory,
  {
    label: string;
    shortLabel: string;
    Icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
  }
> = {
  iluminacao: {
    label: 'Iluminação precária / poste',
    shortLabel: 'Iluminação',
    Icon: Lightbulb,
    badgeClass: 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/35',
  },
  assedio: {
    label: 'Assédio ou importunação',
    shortLabel: 'Assédio',
    Icon: ShieldAlert,
    badgeClass: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/35',
  },
  suspeito: {
    label: 'Atividade suspeita',
    shortLabel: 'Suspeito',
    Icon: Eye,
    badgeClass: 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/35',
  },
  manutencao: {
    label: 'Manutenção / calçada',
    shortLabel: 'Manutenção',
    Icon: Wrench,
    badgeClass: 'bg-[var(--bg-fill-secondary)] text-[var(--label-secondary)] border-[var(--separator)]',
  },
  outro: {
    label: 'Outro incidente',
    shortLabel: 'Outro',
    Icon: AlertTriangle,
    badgeClass: 'bg-[var(--bg-fill-secondary)] text-[var(--label-secondary)] border-[var(--separator)]',
  },
};

const REPORT_STATUS_META: Record<
  ReportStatus,
  {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
  }
> = {
  pendente: {
    label: 'Pendente',
    Icon: Clock,
    badgeClass: 'bg-[#F7C648]/20 text-[#D97706] border-[#F7C648]/50',
  },
  em_analise: {
    label: 'Em análise',
    Icon: Search,
    badgeClass: 'bg-[#5EC2F3]/20 text-[var(--label-primary)] border-[#5EC2F3]/45',
  },
  resolvido: {
    label: 'Resolvido',
    Icon: CheckCircle2,
    badgeClass: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/35',
  },
};

const QUICK_LOCATIONS = ['BU', 'RU', 'Bosque', 'CCE', 'Santos Dumont'];

function formatReportDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Incident Reports & Safe Emergency Channel:
 * - Emergency trigger opens accessible confirmation modal displaying UFSC Security (48) 3721-9555 & PM 190
 * - Zod-validated incident report form with XSS defense and EXIF-stripped photo upload
 * - Chronological anonymized community feed
 */
export const ReportsTab: React.FC<ReportsTabProps> = ({ onNotify }) => {
  const { reports, submitReport, hapticsEnabled } = useCampusStore();
  const haptics = useHaptics();

  // Emergency modal state
  const [isEmergencyDialogOpen, setIsEmergencyDialogOpen] = useState(false);
  const [emergencyConfirmedAt, setEmergencyConfirmedAt] = useState<string | null>(null);

  // Report form state
  const [category, setCategory] = useState<ReportCategory>('iluminacao');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isConfidential, setIsConfidential] = useState(true);
  const [photoThumbnailUrl, setPhotoThumbnailUrl] = useState<string | undefined>(undefined);
  const [isValidatingPhoto, setIsValidatingPhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [mascotMood, setMascotMood] = useState<DropletState>('idle');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const emergencyTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleCloseEmergencyDialog = useCallback(() => {
    setIsEmergencyDialogOpen(false);
    window.requestAnimationFrame(() => {
      emergencyTriggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isEmergencyDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseEmergencyDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEmergencyDialogOpen, handleCloseEmergencyDialog]);

  const sortedFilteredReports = useMemo(() => {
    return [...reports]
      .filter((r) => feedFilter === 'all' || r.category === feedFilter)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [reports, feedFilter]);

  const handleConfirmEmergency = () => {
    if (hapticsEnabled) {
      haptics.trigger('warning');
    }
    const nowLabel = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setEmergencyConfirmedAt(nowLabel);
    handleCloseEmergencyDialog();
    onNotify?.('Alerta simulado enviado à Segurança UFSC (48) 3721-9555.');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setPhotoThumbnailUrl(undefined);
      return;
    }

    setIsValidatingPhoto(true);
    try {
      const result = await validateEvidenceImage(file);
      if (!result.valid || !result.sanitizedDataUrl) {
        setPhotoThumbnailUrl(undefined);
        setFileError(result.error ?? 'Arquivo de imagem inválido.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      if (
        !result.sanitizedDataUrl.startsWith('data:image/') ||
        result.sanitizedDataUrl.length > 250000
      ) {
        setPhotoThumbnailUrl(undefined);
        setFileError('Miniatura gerada excede o limite permitido.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      setPhotoThumbnailUrl(result.sanitizedDataUrl);
      onNotify?.('Foto validada e metadados EXIF removidos.');
    } finally {
      setIsValidatingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoThumbnailUrl(undefined);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = {
      category,
      location,
      description,
      isConfidential,
      photoThumbnailUrl,
    };

    const preCheck = ReportSubmissionSchema.safeParse(payload);
    if (!preCheck.success) {
      setFormError(preCheck.error.errors[0]?.message ?? 'Dados de denúncia inválidos.');
      return;
    }

    const res = submitReport(preCheck.data);
    if (!res.success) {
      setFormError(res.error ?? 'Não foi possível registrar a denúncia.');
      return;
    }

    setLocation('');
    setDescription('');
    setPhotoThumbnailUrl(undefined);
    setFileError(null);
    setMascotMood('notify');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onNotify?.('Denúncia registrada com segurança no canal comunitário.');
  };

  const activeError = formError ?? fileError;

  return (
    <section
      aria-label="Denúncias e emergência"
      className="relative overflow-hidden min-h-screen bg-[var(--bg-grouped)] text-[var(--label-primary)] px-4 pt-5 pb-28 sm:px-6"
    >
      {/* Subtle WelcomeBack-inspired Sky Sunburst Wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden"
        style={{
          background:
            'linear-gradient(180deg, var(--hero-sky-start) 0%, var(--hero-sky-mid) 52%, var(--bg-grouped) 100%)',
        }}
      >
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-[170%] h-full opacity-55"
          style={{
            background:
              'repeating-conic-gradient(from 138deg at 50% 0%, rgba(255,255,255,0.42) 0deg 8deg, rgba(168,214,255,0.18) 8deg 19deg)',
            maskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto space-y-5">
        {/* Crisp Header Card + Trio Safety Tip */}
        <header className="bg-[var(--bg-elevated)] border border-[var(--separator)] rounded-[24px] p-5 shadow-[0_4px_16px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
                  Canal seguro e anônimo UFSC
                </p>
                <TrioMascotStack size={20} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--label-primary)]">
                Denúncias & Emergência
              </h1>
              <p className="text-sm text-[var(--label-secondary)]">
                Registre ocorrências de iluminação ou risco no campus com remoção automática de EXIF.
              </p>
            </div>
            <DropletMascot
              state={isEmergencyDialogOpen ? 'alert' : mascotMood}
              expression={
                isEmergencyDialogOpen
                  ? 'effraye'
                  : mascotMood === 'notify'
                    ? 'fier'
                    : 'attentif'
              }
              tremble={isEmergencyDialogOpen}
              inkColor={isEmergencyDialogOpen ? '#D70015' : '#2563EB'}
              paperColor="var(--bg-elevated)"
              notifColor="#10B981"
              size={52}
              interactive
              ariaLabel="Mascote de apoio a denúncias"
              className="shrink-0"
            />
          </div>

          <div className="rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)] px-3.5 py-2.5 flex items-center gap-2.5">
            <TrioCharacterAvatar variant="pink" size={24} />
            <p className="text-xs text-[var(--label-secondary)]">
              <span className="font-semibold text-[var(--label-primary)]">Dica de segurança:</span> denúncias confidenciais ocultam sua identidade e recalibram o mapa na hora.
            </p>
          </div>
        </header>

        {/* Emergency Safety Card (Explicit Dialog Confirmation Required — Zero Accidental Dialing) */}
        <section
          aria-labelledby="reports-emergency-heading"
          className="bg-[var(--bg-elevated)] border border-[#D70015]/30 rounded-[24px] p-5 space-y-4 shadow-[0_4px_16px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-[#D70015]/12 text-[#D70015] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2
                  id="reports-emergency-heading"
                  className="text-lg font-semibold text-[var(--label-primary)]"
                >
                  Ajuda imediata no campus
                </h2>
                <p className="text-sm text-[var(--label-secondary)] mt-0.5 leading-relaxed">
                  Segurança Institucional UFSC (Trindade 24h) ou Polícia Militar 190. Requer confirmação explícita antes de acionar.
                </p>
              </div>
            </div>

            <button
              ref={emergencyTriggerRef}
              type="button"
              onClick={() => setIsEmergencyDialogOpen(true)}
              className="w-full sm:w-auto min-h-[44px] px-5 rounded-full bg-[#D70015] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#b50012] active:scale-[0.97] transition-all cursor-pointer shrink-0"
            >
              <PhoneCall className="w-4 h-4" aria-hidden="true" />
              <span>Emergência UFSC / 190</span>
            </button>
          </div>

          {emergencyConfirmedAt && (
            <div
              role="note"
              className="p-3 rounded-2xl bg-[#D70015]/10 border border-[#D70015]/25 text-xs text-[var(--label-primary)] flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-[#D70015] shrink-0" aria-hidden="true" />
              <span>
                Alerta simulado registrado às {emergencyConfirmedAt} para Segurança UFSC (48) 3721-9555.
              </span>
            </div>
          )}
        </section>

        {/* Section 1: Validated Incident Report Form */}
        <section
          aria-labelledby="reports-form-heading"
          className="bg-[var(--bg-elevated)] border border-[var(--separator)] rounded-[24px] p-5 space-y-5 shadow-[0_4px_16px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start gap-3.5">
            <TrioCharacterAvatar variant="blue" size={38} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <h2 id="reports-form-heading" className="text-lg font-semibold text-[var(--label-primary)]">
                Registrar ocorrência
              </h2>
              <p className="text-sm text-[var(--label-secondary)] mt-0.5">
                Entradas validadas contra scripts; dados sensíveis nunca são expostos no feed.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label
                htmlFor="report-category"
                className="block text-xs font-medium text-[var(--label-secondary)] mb-1.5"
              >
                Categoria da ocorrência
              </label>
              <select
                id="report-category"
                aria-label="Categoria da denúncia"
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--separator)] bg-[var(--bg-fill-secondary)] text-sm text-[var(--label-primary)] focus:outline-2 focus:outline-[var(--accent-primary)] cursor-pointer"
              >
                {(Object.keys(CATEGORY_META) as ReportCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_META[key].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label
                htmlFor="report-location"
                className="block text-xs font-medium text-[var(--label-secondary)]"
              >
                Local no campus
              </label>
              <input
                id="report-location"
                type="text"
                aria-label="Local no campus"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Ex: Trilha do Bosque, entrada da BU"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--separator)] bg-[var(--bg-fill-secondary)] text-sm text-[var(--label-primary)] placeholder:text-[var(--label-tertiary)] focus:outline-2 focus:outline-[var(--accent-primary)]"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setLocation(loc);
                      if (formError) setFormError(null);
                    }}
                    className="min-h-[44px] px-3 rounded-full bg-[var(--bg-fill-secondary)] hover:bg-[var(--bg-elevated-secondary)] border border-[var(--separator)] text-xs font-medium text-[var(--label-primary)] cursor-pointer"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="report-description"
                  className="block text-xs font-medium text-[var(--label-secondary)]"
                >
                  Descrição
                </label>
                <span className="text-xs text-[var(--label-secondary)]">{description.length}/500</span>
              </div>
              <textarea
                id="report-description"
                aria-label="Descrição"
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Descreva o ponto escuro, poste danificado ou situação observada (10 a 500 caracteres)"
                className="w-full min-h-[96px] p-3.5 rounded-xl border border-[var(--separator)] bg-[var(--bg-fill-secondary)] text-sm text-[var(--label-primary)] placeholder:text-[var(--label-tertiary)] focus:outline-2 focus:outline-[var(--accent-primary)]"
              />
            </div>

            {/* Confidentiality Switch */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <Lock className="w-4 h-4 text-[#10B981] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--label-primary)]">Denúncia confidencial</p>
                  <p className="text-xs text-[var(--label-secondary)]">
                    Oculta sua identidade no feed comunitário
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isConfidential}
                aria-label="Denúncia confidencial"
                onClick={() => setIsConfidential((prev) => !prev)}
                className={`min-w-[52px] min-h-[44px] px-1.5 inline-flex items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  isConfidential ? 'bg-[#2563EB] justify-end' : 'bg-[#64748B]/40 justify-start'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-white shadow-xs transition-transform" />
              </button>
            </div>

            {/* Evidence Photo Upload (Magic Bytes + EXIF Strip) */}
            <div className="space-y-2">
              <label
                htmlFor="report-evidence-file"
                className="block text-xs font-medium text-[var(--label-secondary)]"
              >
                Anexar foto de evidência (opcional • JPEG, PNG ou WebP até 5 MB)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-4 rounded-full border border-[var(--separator)] bg-[var(--bg-fill-secondary)] hover:bg-[var(--bg-elevated-secondary)] active:scale-[0.97] text-xs sm:text-sm font-semibold text-[var(--label-primary)] inline-flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {isValidatingPhoto ? 'Processando imagem...' : 'Selecionar imagem'}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  id="report-evidence-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Anexar foto de evidência"
                  onChange={handlePhotoChange}
                  tabIndex={-1}
                  className="sr-only"
                />

                {photoThumbnailUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="min-h-[44px] px-3.5 rounded-full border border-[var(--separator)] bg-[var(--bg-elevated)] text-xs font-medium text-[#EF4444] inline-flex items-center gap-1.5 hover:bg-[#EF4444]/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Remover foto</span>
                  </button>
                )}
              </div>

              {photoThumbnailUrl && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)]">
                  <img
                    src={photoThumbnailUrl}
                    alt="Prévia da evidência com EXIF removido"
                    loading="lazy"
                    decoding="async"
                    className="w-16 h-16 rounded-xl object-cover border border-[var(--separator)] shrink-0"
                  />
                  <div className="text-xs text-[var(--label-primary)]">
                    <p className="font-semibold text-[#10B981]">
                      Metadados EXIF removidos com segurança
                    </p>
                    <p className="text-[var(--label-secondary)]">
                      Miniatura WebP/JPEG re-codificada localmente antes do envio.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Inline Fail-Fast Validation Error */}
            {activeError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/30 text-xs text-[#EF4444] font-medium"
              >
                {activeError}
              </div>
            )}

            {/* Single Prominent Lime CTA */}
            <PillButton
              type="submit"
              variant="lime"
              size="compact"
              disabled={isValidatingPhoto}
              className="w-full font-medium"
            >
              Enviar denúncia segura
            </PillButton>
          </form>
        </section>

        {/* Section 2: Chronological Community Report Feed */}
        <section aria-labelledby="reports-feed-heading" className="space-y-4">
          <div className="flex items-center gap-3.5">
            <TrioCharacterAvatar variant="gold" size={38} />
            <div>
              <h2 id="reports-feed-heading" className="text-lg font-semibold text-[var(--label-primary)]">
                Feed comunitário ({sortedFilteredReports.length})
              </h2>
              <p className="text-xs text-[var(--label-secondary)]">
                Registros em ordem cronológica, com identidade preservada.
              </p>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div
            className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)]"
            role="group"
            aria-label="Filtrar denúncias"
          >
            <button
              type="button"
              onClick={() => setFeedFilter('all')}
              aria-pressed={feedFilter === 'all'}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.97] cursor-pointer ${
                feedFilter === 'all'
                  ? 'bg-[var(--bg-elevated)] text-[var(--label-primary)] border-[var(--separator)] shadow-[0_2px_6px_rgba(15,23,42,0.08)]'
                  : 'bg-transparent text-[var(--label-secondary)] border-transparent hover:text-[var(--label-primary)]'
              }`}
            >
              Todas
            </button>
            {(Object.keys(CATEGORY_META) as ReportCategory[]).map((cat) => {
              const active = feedFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFeedFilter(cat)}
                  aria-pressed={active}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.97] cursor-pointer ${
                    active
                      ? 'bg-[var(--bg-elevated)] text-[var(--label-primary)] border-[var(--separator)] shadow-[0_2px_6px_rgba(15,23,42,0.08)]'
                      : 'bg-transparent text-[var(--label-secondary)] border-transparent hover:text-[var(--label-primary)]'
                  }`}
                >
                  {CATEGORY_META[cat].shortLabel}
                </button>
              );
            })}
          </div>

          <VirtualizedList
            items={sortedFilteredReports}
            pageSize={5}
            getItemKey={(report) => report.id}
            ariaLabel="Feed comunitário de denúncias"
            listClassName="space-y-3"
            loadMoreLabel="Carregar mais denúncias"
            emptyState={
              <div className="bg-[var(--bg-elevated)] border border-[var(--separator)] rounded-[24px] p-5 text-sm text-[var(--label-secondary)] shadow-[0_4px_16px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]">
                Nenhuma denúncia registrada para esta categoria.
              </div>
            }
            renderItem={(report) => {
              const catMeta = CATEGORY_META[report.category];
              const CatIcon = catMeta.Icon;
              const stMeta = REPORT_STATUS_META[report.status];
              const StatusIcon = stMeta.Icon;
              const hasSafeThumb =
                typeof report.photoThumbnailUrl === 'string' &&
                /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
                  report.photoThumbnailUrl
                );

              return (
                <article className="bg-[var(--bg-elevated)] border border-[var(--separator)] rounded-2xl p-4 space-y-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${catMeta.badgeClass}`}
                      >
                        <CatIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{catMeta.shortLabel}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${stMeta.badgeClass}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{stMeta.label}</span>
                      </span>
                    </div>

                    <span className="text-xs text-[var(--label-secondary)]">
                      {formatReportDate(report.createdAt)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[var(--label-primary)]">
                      {report.locationName}
                    </h3>
                    <p className="text-sm text-[var(--label-secondary)] mt-1 leading-relaxed">
                      {report.description}
                    </p>
                  </div>

                  {hasSafeThumb && (
                    <img
                      src={report.photoThumbnailUrl}
                      alt={`Evidência em ${report.locationName}`}
                      loading="lazy"
                      decoding="async"
                      className="w-24 h-24 rounded-xl object-cover border border-[var(--separator)]"
                    />
                  )}

                  <div className="pt-1 flex items-center gap-1.5 text-xs text-[var(--label-secondary)]">
                    {report.isConfidential ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
                        <span>Anônimo • Confidencial</span>
                      </>
                    ) : (
                      <span>Colaborador verificado UFSC</span>
                    )}
                  </div>
                </article>
              );
            }}
          />
        </section>
      </div>

      {/* Explicit Emergency Confirmation Dialog */}
      {isEmergencyDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-dialog-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0F172A]/65 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-[var(--bg-elevated)] text-[var(--label-primary)] rounded-3xl p-6 border border-[var(--separator)] shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#D70015]/12 text-[#D70015] flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2
                  id="emergency-dialog-title"
                  className="text-lg font-semibold text-[var(--label-primary)]"
                >
                  Confirmar acionamento de emergência
                </h2>
              </div>

              <button
                type="button"
                aria-label="Fechar diálogo de emergência"
                onClick={handleCloseEmergencyDialog}
                className="min-w-[44px] min-h-[44px] -mt-1 -mr-1 rounded-full inline-flex items-center justify-center text-[var(--label-secondary)] hover:bg-[var(--bg-fill-secondary)] active:scale-[0.97] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2.5 rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--label-primary)]">Segurança UFSC (24h)</span>
                <span className="font-semibold text-[#EF4444]">(48) 3721-9555</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--separator)]">
                <span className="font-medium text-[var(--label-primary)]">Polícia Militar</span>
                <span className="font-semibold text-[#EF4444]">190</span>
              </div>
            </div>

            <p className="text-xs text-[var(--label-secondary)] leading-relaxed">
              Para evitar acionamentos acidentais, nenhuma ligação é disparada automaticamente. Ao confirmar, o app registra um alerta simulado de demonstração para os canais oficiais acima.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleCloseEmergencyDialog}
                className="flex-1 min-h-[44px] px-4 rounded-full border border-[var(--separator)] bg-[var(--bg-fill-secondary)] text-sm font-semibold text-[var(--label-primary)] hover:bg-[var(--bg-elevated-secondary)] active:scale-[0.97] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEmergency}
                className="flex-1 min-h-[44px] px-4 rounded-full bg-[#D70015] text-white text-sm font-semibold hover:bg-[#b50012] active:scale-[0.97] transition-all cursor-pointer"
              >
                Confirmar alerta simulado
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
