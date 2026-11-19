import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flame,
  QrCode,
  Search,
  Zap,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { useDebounce } from '../../hooks/useDebounce';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { QrCodeInputSchema } from '../../security/schemas';
import type { LampPost, LampPostStatus } from '../../types/campus';
import { PillButton } from '../ui/PillButton';
import { IosNavHeader } from '../ui/IosNavHeader';
import { VirtualizedList } from '../ui/VirtualizedList';
import { DropletMascot } from '../mascot/DropletMascot';
import { TrioCharacterAvatar, TrioMascotStack } from '../mascot/TrioMascotBadge';

export interface LightsTabProps {
  onOpenMap: () => void;
  onNotify?: (message: string) => void;
}

type DirectoryFilter = 'all' | LampPostStatus;

const STATUS_META: Record<
  LampPostStatus,
  {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    activeBtnClass: string;
  }
> = {
  aceso: {
    label: 'Aceso',
    Icon: Zap,
    badgeClass: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/35',
    activeBtnClass: 'bg-[#10B981] text-white border-[#059669]',
  },
  oscilando: {
    label: 'Oscilando',
    Icon: AlertTriangle,
    badgeClass: 'bg-[#D97706]/15 text-[#D97706] border-[#D97706]/40',
    activeBtnClass: 'bg-[#D97706] text-white border-[#92400E]',
  },
  queimado: {
    label: 'Queimado',
    Icon: Flame,
    badgeClass: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/35',
    activeBtnClass: 'bg-[#D70015] text-white border-[#7F1D1D]',
  },
};

function formatPostTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * QR Lamp Post Reporter & Campus Lighting Directory:
 * Interactive QR scanner simulator + manual Zod-validated QR entry,
 * 1-tap optimistic status updates (Aceso/Oscilando/Queimado) with route recalculation banner,
 * and filterable UFSC lamp post directory with non-color-only badges.
 */
export const LightsTab: React.FC<LightsTabProps> = ({ onOpenMap, onNotify }) => {
  const {
    posts,
    updateLampPostStatus,
    brightestRoute,
    activeOriginId,
    activeDestinationId,
  } = useCampusStore();

  const [selectedPostId, setSelectedPostId] = useState<string>(posts[0]?.id ?? 'POSTE-BU-01');
  const [qrInput, setQrInput] = useState('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [didRecalculate, setDidRecalculate] = useState(false);
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('all');
  const [directorySearch, setDirectorySearch] = useState('');
  const debouncedDirectorySearch = useDebounce(directorySearch, 180);

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? posts[0],
    [posts, selectedPostId]
  );

  const landmarkMap = useMemo(
    () => new Map(UFSC_LANDMARKS.map((n) => [n.id, n.shortName])),
    []
  );

  const originShort = landmarkMap.get(activeOriginId) ?? activeOriginId.toUpperCase();
  const destShort =
    landmarkMap.get(activeDestinationId) ?? activeDestinationId.toUpperCase();

  const counts = useMemo(() => {
    let aceso = 0;
    let oscilando = 0;
    let queimado = 0;
    for (const post of posts) {
      if (post.status === 'aceso') aceso += 1;
      else if (post.status === 'oscilando') oscilando += 1;
      else queimado += 1;
    }
    return { aceso, oscilando, queimado };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const query = debouncedDirectorySearch.trim().toLowerCase();
    return posts.filter((post) => {
      if (directoryFilter !== 'all' && post.status !== directoryFilter) {
        return false;
      }
      if (!query) return true;
      return (
        post.id.toLowerCase().includes(query) ||
        post.name.toLowerCase().includes(query)
      );
    });
  }, [posts, directoryFilter, debouncedDirectorySearch]);

  const handleSelectQuickQr = (postId: string) => {
    setSelectedPostId(postId);
    setQrError(null);
    setStatusFeedback(null);
    setDidRecalculate(false);
  };

  const handleQrScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQrError(null);

    const parsed = QrCodeInputSchema.safeParse(qrInput);
    if (!parsed.success) {
      setQrError(parsed.error.errors[0]?.message ?? 'Código QR inválido.');
      return;
    }

    const matched = posts.find((p) => p.id === parsed.data);
    if (!matched) {
      setQrError(`Poste ${parsed.data} não encontrado no cadastro do Campus Trindade.`);
      return;
    }

    setSelectedPostId(matched.id);
    setQrInput('');
    setStatusFeedback(`Poste ${matched.id} selecionado via QR Code.`);
    setDidRecalculate(false);
    onNotify?.(`Poste ${matched.id} localizado via QR Code.`);
  };

  const handleStatusChange = (
    nextStatus: LampPostStatus,
    burnReason?: LampPost['burnReason']
  ) => {
    if (!selectedPost) return;
    updateLampPostStatus(selectedPost.id, nextStatus, burnReason);
    const label =
      nextStatus === 'queimado' && burnReason === 'depredacao_festa'
        ? 'Queimado (Depredação pós-festa)'
        : STATUS_META[nextStatus].label;
    const msg = `${selectedPost.id} atualizado para ${label}. Rotas do campus recalculadas.`;
    setStatusFeedback(msg);
    setDidRecalculate(true);
    onNotify?.(msg);
  };

  return (
    <section
      aria-label="Monitoramento de postes e QR Code"
      className="relative overflow-x-clip min-h-screen bg-[var(--bg-grouped)] text-[var(--label-primary)] pb-28"
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
          className="light-only-sunburst absolute -top-10 left-1/2 -translate-x-1/2 w-[170%] h-full opacity-55"
          style={{
            background:
              'repeating-conic-gradient(from 138deg at 50% 0%, rgba(255,255,255,0.42) 0deg 8deg, rgba(168,214,255,0.18) 8deg 19deg)',
            maskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 90% 92% at 50% 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0) 88%)',
          }}
        />
        <div
          className="dark-only-glow absolute -top-12 left-1/2 -translate-x-1/2 w-[140%] h-full"
          style={{
            background:
              'radial-gradient(ellipse 85% 65% at 50% 0%, rgba(83, 104, 120, 0.36) 0%, rgba(94, 194, 243, 0.10) 42%, transparent 78%)',
          }}
        />
      </div>

      {/* Native iOS 26 Sticky Liquid Glass Bar + Large Title Header */}
      <IosNavHeader
        kicker="Monitoramento colaborativo UFSC"
        title="Postes & QR Code"
        subtitle={`${counts.aceso} acesos • ${counts.oscilando} oscilando • ${counts.queimado} queimados`}
        titleAccessory={<TrioMascotStack size={26} className="shrink-0" />}
        compactTrailing={<TrioMascotStack size={18} className="shrink-0" />}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg-elevated)]/85 text-[var(--label-primary)] border border-[var(--separator)]">
              <span className="w-2 h-2 rounded-full bg-[#5EC2F3]" aria-hidden="true" />
              <span>{counts.aceso} operando</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg-elevated)]/85 text-[var(--label-primary)] border border-[var(--separator)]">
              <span className="w-2 h-2 rounded-full bg-[#F7C648]" aria-hidden="true" />
              <span>{counts.oscilando} em alerta</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--bg-elevated)]/85 text-[var(--label-primary)] border border-[var(--separator)]">
              <span className="w-2 h-2 rounded-full bg-[#EE86BF]" aria-hidden="true" />
              <span>{counts.queimado} em desvio</span>
            </span>
          </div>
        }
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 space-y-5">

        {/* Section 1: Interactive QR Code Scanner Simulator */}
        <section
          aria-labelledby="lights-scanner-heading"
          className="ios-grouped-section p-5 space-y-5"
        >
          <div className="flex items-start gap-3.5">
            <TrioCharacterAvatar variant="blue" size={38} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <h2 id="lights-scanner-heading" className="text-lg font-semibold text-[var(--label-primary)]">
                Leitor QR do poste
              </h2>
              <p className="text-sm text-[var(--label-secondary)] mt-0.5">
                Selecione uma etiqueta QR do campus ou digite o código do poste para atualizar em 1 toque.
              </p>
            </div>
          </div>

          {/* Stylized QR Viewfinder with Reactive Droplet Mascot */}
          {selectedPost && (
            <div className="rounded-[20px] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white p-4 relative overflow-hidden shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl border border-white/25 bg-white/10 flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white/80 font-medium">Etiqueta ativa</p>
                    <p className="text-base font-semibold truncate">{selectedPost.id}</p>
                    <p className="text-xs text-white/75 truncate">{selectedPost.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <DropletMascot
                    state={
                      selectedPost.status === 'aceso'
                        ? 'wink'
                        : selectedPost.status === 'oscilando'
                          ? 'alert'
                          : 'exclaim'
                    }
                    expression={
                      selectedPost.status === 'aceso'
                        ? 'heureux'
                        : selectedPost.status === 'oscilando'
                          ? 'curieux'
                          : 'effraye'
                    }
                    tremble={selectedPost.status === 'queimado'}
                    inkColor="#FFFFFF"
                    paperColor="#1D4ED8"
                    notifColor={selectedPost.status === 'queimado' ? '#EF4444' : '#10B981'}
                    size={54}
                    interactive
                    ariaLabel="Mascote indicador do estado do poste"
                  />
                  {(() => {
                    const meta = STATUS_META[selectedPost.status];
                    const Icon = meta.Icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 bg-white/15 text-white border-white/30`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{meta.label}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Quick-Select Seeded QR Pills */}
          <div className="space-y-2">
            <span className="block text-xs font-medium text-[var(--label-secondary)]">
              Etiquetas QR recentes no campus
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {posts.map((post) => {
                const isSelected = selectedPost?.id === post.id;
                const StatusIcon = STATUS_META[post.status].Icon;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => handleSelectQuickQr(post.id)}
                    aria-pressed={isSelected}
                    className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 shrink-0 transition-all active:scale-[0.97] cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                        : 'bg-[var(--bg-fill-secondary)] text-[var(--label-primary)] border-[var(--separator)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{post.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual QR Code Input Validated via QrCodeInputSchema */}
          <form onSubmit={handleQrScanSubmit} className="space-y-2">
            <label
              htmlFor="qr-code-input"
              className="block text-xs font-medium text-[var(--label-secondary)]"
            >
              Código QR do poste
            </label>
            <div className="flex items-center gap-2">
              <input
                id="qr-code-input"
                type="text"
                aria-label="Código QR do poste"
                value={qrInput}
                onChange={(e) => {
                  setQrInput(e.target.value);
                  if (qrError) setQrError(null);
                }}
                placeholder="Ex: POSTE-BU-01"
                className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl border border-[var(--separator)] bg-[var(--bg-fill-secondary)] text-sm text-[var(--label-primary)] placeholder:text-[var(--label-tertiary)] focus:outline-2 focus:outline-[var(--accent-primary)]"
              />
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-full bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] active:scale-[0.97] transition-all cursor-pointer shrink-0"
              >
                Ler QR
              </button>
            </div>

            {qrError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#EF4444]/12 border border-[#EF4444]/30 text-xs text-[#EF4444] font-medium"
              >
                {qrError}
              </div>
            )}
          </form>

          {/* Instant 1-Tap Status Controls */}
          {selectedPost && (
            <div className="pt-4 border-t border-[var(--separator)] space-y-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--label-primary)]">
                  Atualizar status de {selectedPost.id}
                </h3>
                <p className="text-xs text-[var(--label-secondary)] mt-0.5">{selectedPost.name}</p>
              </div>

              <div
                role="group"
                aria-label={`Definir status de ${selectedPost.id}`}
                className="grid grid-cols-3 gap-2"
              >
                {(['aceso', 'oscilando', 'queimado'] as LampPostStatus[]).map((status) => {
                  const meta = STATUS_META[status];
                  const Icon = meta.Icon;
                  const isCurrent = selectedPost.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          status,
                          status === 'queimado' ? 'falha_eletrica' : undefined
                        )
                      }
                      aria-pressed={isCurrent}
                      className={`min-h-[44px] px-2.5 py-2 rounded-2xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                        isCurrent
                          ? meta.activeBtnClass
                          : 'bg-[var(--bg-fill-secondary)] text-[var(--label-primary)] border-[var(--separator)] hover:border-[var(--accent-primary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Canvas Bloco 8: Depredação pós-festas flag */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <span className="text-[11px] font-medium text-[var(--label-secondary)]">
                  Causa do apagão (opcional):
                </span>
                <button
                  type="button"
                  onClick={() => handleStatusChange('queimado', 'depredacao_festa')}
                  aria-pressed={
                    selectedPost.status === 'queimado' &&
                    selectedPost.burnReason === 'depredacao_festa'
                  }
                  className={`min-h-[40px] px-3 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                    selectedPost.status === 'queimado' &&
                    selectedPost.burnReason === 'depredacao_festa'
                      ? 'bg-[#DC2626] text-white border-[#DC2626]'
                      : 'bg-[var(--bg-fill-secondary)] text-[var(--label-primary)] border-[var(--separator)] hover:border-[#DC2626]'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Depredado (pós-festa)</span>
                </button>
              </div>
            </div>
          )}

          {/* Optimistic Route Recalculation Banner + Single Prominent CTA */}
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold text-[var(--label-primary)]">
                  {statusFeedback ?? `Corredor ${originShort} → ${destShort}`}
                </p>
                {didRecalculate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                    <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>Mapa recalibrado</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--label-secondary)]">
                Rota iluminada atual: {brightestRoute.illuminationPercentage}% •{' '}
                {brightestRoute.hasDarkWarning
                  ? 'Desvio ou alerta de trecho escuro ativo'
                  : 'Caminho seguro sem postes queimados'}
              </p>
            </div>

            <PillButton
              variant="lime"
              size="compact"
              onClick={onOpenMap}
              className="shrink-0 gap-1.5 font-semibold"
            >
              <span>Ver rota no Mapa</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </PillButton>
          </div>
        </section>

        {/* Section 2: Filterable UFSC Lamp Post Directory */}
        <section
          aria-labelledby="lights-directory-heading"
          className="ios-grouped-section"
        >
          <div className="p-5 pb-4 space-y-4">
            <div className="flex items-start gap-3.5">
              <TrioCharacterAvatar variant="gold" size={38} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <h2 id="lights-directory-heading" className="text-lg font-semibold text-[var(--label-primary)]">
                  Diretório de postes UFSC
                </h2>
                <p className="text-sm text-[var(--label-secondary)] mt-0.5">
                  Toque em qualquer poste para selecionar e atualizar sua situação.
                </p>
              </div>
            </div>

            {/* Search & Status Filter Chips */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-[var(--bg-fill-secondary)] border border-[var(--separator)] rounded-full px-3.5">
                <Search className="w-4 h-4 text-[var(--label-tertiary)] shrink-0" aria-hidden="true" />
                <label htmlFor="lights-directory-search" className="sr-only">
                  Filtrar postes no diretório
                </label>
                <input
                  id="lights-directory-search"
                  type="text"
                  aria-label="Filtrar postes no diretório"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Buscar por código ou local (ex: BU, Bosque)"
                  className="flex-1 min-h-[44px] bg-transparent text-sm text-[var(--label-primary)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
                />
              </div>

              <div
                className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[var(--bg-fill-secondary)] border border-[var(--separator)]"
                role="group"
                aria-label="Filtrar por status"
              >
                {(
                  [
                    { id: 'all', label: `Todos (${posts.length})` },
                    { id: 'aceso', label: `Acesos (${counts.aceso})` },
                    { id: 'oscilando', label: `Em oscilação (${counts.oscilando})` },
                    { id: 'queimado', label: `Queimados (${counts.queimado})` },
                  ] as Array<{ id: DirectoryFilter; label: string }>
                ).map((chip) => {
                  const active = directoryFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setDirectoryFilter(chip.id)}
                      aria-pressed={active}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.97] cursor-pointer ${
                        active
                          ? 'bg-[var(--bg-elevated)] text-[var(--label-primary)] border-[var(--separator)] shadow-[0_2px_6px_rgba(15,23,42,0.08)]'
                          : 'bg-transparent text-[var(--label-secondary)] border-transparent hover:text-[var(--label-primary)]'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Paginated Ruled Directory List */}
          <VirtualizedList
            items={filteredPosts}
            pageSize={6}
            getItemKey={(post) => post.id}
            ariaLabel="Lista de postes da UFSC"
            listClassName="ios-grouped-divider border-t border-[var(--separator)]"
            className="pb-2"
            loadMoreLabel="Mostrar mais postes"
            emptyState={
              <p className="text-sm text-[var(--label-secondary)] px-5 py-4 border-t border-[var(--separator)]">
                Nenhum poste encontrado para este filtro.
              </p>
            }
            renderItem={(post) => {
              const meta = STATUS_META[post.status];
              const StatusIcon = meta.Icon;
              const isSelected = selectedPost?.id === post.id;

              return (
                <button
                  type="button"
                  onClick={() => handleSelectQuickQr(post.id)}
                  aria-label={`Selecionar ${post.id} — ${post.name} (${meta.label})`}
                  className={`w-full min-h-[56px] px-5 py-3 text-left flex items-center justify-between gap-3 transition-colors active:bg-[var(--bg-fill-secondary)] cursor-pointer ${
                    isSelected
                      ? 'bg-[#2563EB]/8'
                      : 'hover:bg-[var(--bg-fill-secondary)]/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--label-primary)] truncate">
                      {post.name}
                    </p>
                    <p className="text-xs text-[var(--label-secondary)] mt-0.5">
                      {post.id} • Atualizado às {formatPostTime(post.lastUpdated)}
                    </p>
                    {post.status === 'queimado' && post.burnReason === 'depredacao_festa' && (
                      <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                        Depredação pós-festa
                      </span>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${meta.badgeClass}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{meta.label}</span>
                  </span>
                </button>
              );
            }}
          />
        </section>
      </div>
    </section>
  );
};
