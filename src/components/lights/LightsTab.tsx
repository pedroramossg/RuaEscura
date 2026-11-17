import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Flame,
  QrCode,
  Search,
  Zap,
} from 'lucide-react';
import { useCampusStore } from '../../hooks/useCampusStore';
import { useDebounce } from '../../hooks/useDebounce';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { QrCodeInputSchema } from '../../security/schemas';
import type { LampPostStatus } from '../../types/campus';
import { PillButton } from '../ui/PillButton';
import { VirtualizedList } from '../ui/VirtualizedList';
import { DropletMascot } from '../mascot/DropletMascot';

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
    badgeClass: 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]',
    activeBtnClass: 'bg-[#10B981] text-white border-[#059669]',
  },
  oscilando: {
    label: 'Oscilando',
    Icon: AlertTriangle,
    badgeClass: 'bg-[#D97706]/15 text-[#92400E] border-[#D97706]/40',
    activeBtnClass: 'bg-[#D97706] text-white border-[#92400E]',
  },
  queimado: {
    label: 'Queimado',
    Icon: Flame,
    badgeClass: 'bg-[#D70015]/12 text-[#D70015] border-[#D70015]/35',
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
    onNotify?.(`Poste ${matched.id} localizado via QR Code.`);
  };

  const handleStatusChange = (nextStatus: LampPostStatus) => {
    if (!selectedPost) return;
    updateLampPostStatus(selectedPost.id, nextStatus);
    const label = STATUS_META[nextStatus].label;
    const msg = `${selectedPost.id} atualizado para ${label}. Rotas do campus recalculadas.`;
    setStatusFeedback(msg);
    onNotify?.(msg);
  };

  return (
    <section
      aria-label="Monitoramento de postes e QR Code"
      className="min-h-screen bg-gradient-to-b from-[#E5ECFF] via-[#F2F6FF] to-[#F6F8FC] text-[#111827] px-4 pt-5 pb-28 sm:px-6"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Editorial Header */}
        <header className="space-y-1">
          <p className="text-xs font-medium text-[#4B5563]">
            Monitoramento colaborativo UFSC
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111827]">
            Postes & QR Code
          </h1>
          <p className="text-sm text-[#4B5563]">
            {counts.aceso} acesos • {counts.oscilando} oscilando • {counts.queimado} queimados
          </p>
        </header>

        {/* Section 1: Interactive QR Code Scanner Simulator */}
        <section
          aria-labelledby="lights-scanner-heading"
          className="bg-white border border-[#E5EAF4] rounded-[24px] p-5 space-y-5 shadow-2xs"
        >
          <div className="flex items-start gap-4">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-full bg-[#2563EB] text-white text-sm font-medium flex items-center justify-center shrink-0"
            >
              1
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="lights-scanner-heading" className="text-lg font-medium text-[#111827]">
                Leitor QR do poste
              </h2>
              <p className="text-sm text-[#4B5563] mt-0.5">
                Selecione uma etiqueta QR do campus ou digite o código do poste para atualizar em 1 toque.
              </p>
            </div>
          </div>

          {/* Stylized QR Viewfinder with Reactive Droplet Mascot */}
          {selectedPost && (
            <div className="rounded-[20px] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white p-4 relative overflow-hidden">
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
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${meta.badgeClass}`}
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
            <span className="block text-xs font-medium text-[#6B7280]">
              Simular leitura rápida no campus
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
                    className={`min-h-[44px] px-3.5 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 shrink-0 transition-all active:scale-[0.97] cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                        : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:border-[#2563EB]'
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
              className="block text-xs font-medium text-[#6B7280]"
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
                className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl border border-[#E5EAF4] bg-[#F8FAFC] text-sm text-[#111827] placeholder:text-[#6B7280] focus:outline-2 focus:outline-[#2563EB]"
              />
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-full bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] active:scale-[0.97] transition-all cursor-pointer shrink-0"
              >
                Ler QR
              </button>
            </div>

            {qrError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#D70015] font-medium"
              >
                {qrError}
              </div>
            )}
          </form>

          {/* Instant 1-Tap Status Controls */}
          {selectedPost && (
            <div className="pt-4 border-t border-[#E5EAF4] space-y-3">
              <div>
                <h3 className="text-base font-medium text-[#111827]">
                  Atualizar status de {selectedPost.id}
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">{selectedPost.name}</p>
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
                      onClick={() => handleStatusChange(status)}
                      aria-pressed={isCurrent}
                      className={`min-h-[44px] px-2.5 py-2 rounded-2xl border text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] cursor-pointer ${
                        isCurrent
                          ? meta.activeBtnClass
                          : 'bg-[#F8FAFC] text-[#111827] border-[#E5EAF4] hover:border-[#2563EB]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optimistic Route Recalculation Banner + Single Prominent CTA */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E5EAF4] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium text-[#111827]">
                {statusFeedback ?? `Corredor ${originShort} → ${destShort}`}
              </p>
              <p className="text-xs text-[#4B5563]">
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
              className="shrink-0 gap-1.5 font-medium"
            >
              <span>Ver rota no Mapa</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </PillButton>
          </div>
        </section>

        {/* Section 2: Filterable UFSC Lamp Post Directory */}
        <section
          aria-labelledby="lights-directory-heading"
          className="bg-white border border-[#E5EAF4] rounded-[24px] p-5 space-y-4 shadow-2xs"
        >
          <div className="flex items-start gap-4">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-full bg-[#2563EB] text-white text-sm font-medium flex items-center justify-center shrink-0"
            >
              2
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="lights-directory-heading" className="text-lg font-medium text-[#111827]">
                Diretório de postes UFSC
              </h2>
              <p className="text-sm text-[#4B5563] mt-0.5">
                Toque em qualquer poste para selecionar e atualizar sua situação.
              </p>
            </div>
          </div>

          {/* Search & Status Filter Chips */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E5EAF4] rounded-full px-3.5">
              <Search className="w-4 h-4 text-[#6B7280] shrink-0" aria-hidden="true" />
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
                className="flex-1 min-h-[44px] bg-transparent text-sm text-[#111827] placeholder:text-[#6B7280] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
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
                    className={`min-h-[44px] px-3.5 rounded-full text-xs font-medium border transition-all active:scale-[0.97] cursor-pointer ${
                      active
                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                        : 'bg-[#F8FAFC] text-[#4B5563] border-[#E5EAF4] hover:text-[#111827]'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paginated Ruled Directory List */}
          <VirtualizedList
            items={filteredPosts}
            pageSize={6}
            getItemKey={(post) => post.id}
            ariaLabel="Lista de postes da UFSC"
            listClassName="divide-y divide-[#E5EAF4] border-t border-[#E5EAF4]"
            loadMoreLabel="Mostrar mais postes"
            emptyState={
              <p className="text-sm text-[#6B7280] py-4 border-t border-[#E5EAF4]">
                Nenhum poste encontrado para este filtro.
              </p>
            }
            renderItem={(post) => {
              const meta = STATUS_META[post.status];
              const StatusIcon = meta.Icon;
              const isSelected = selectedPost?.id === post.id;

              return (
                <div className="py-2">
                  <button
                    type="button"
                    onClick={() => handleSelectQuickQr(post.id)}
                    aria-label={`Selecionar ${post.id} — ${post.name} (${meta.label})`}
                    className={`w-full min-h-[44px] px-3 py-2.5 rounded-2xl text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                      isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">
                        {post.name}
                      </p>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {post.id} • Atualizado às {formatPostTime(post.lastUpdated)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${meta.badgeClass}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{meta.label}</span>
                    </span>
                  </button>
                </div>
              );
            }}
          />
        </section>
      </div>
    </section>
  );
};
