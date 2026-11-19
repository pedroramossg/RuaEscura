import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import type { ChatMessage, CompanionMatch } from '../../types/campus';
import { ChatMessageSchema } from '../../security/schemas';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';
import { useCampusStore } from '../../hooks/useCampusStore';
import {
  ChatThread,
  type ArcChatMessage,
  type ArcChatParticipant,
  type ArcChatReaction,
} from '../ui/ChatThread';
import {
  TrioCharacterAvatar,
  pickTrioVariant,
  type TrioVariant,
} from '../mascot/TrioMascotBadge';

export interface CompanionChatViewProps {
  companion: CompanionMatch;
  messages?: ChatMessage[];
  dark?: boolean;
  isNightMap?: boolean;
  onBack: () => void;
  onSendMessage?: (companionId: string, text: string) => { success: boolean; error?: string };
  onSend?: (text: string) => { success: boolean; error?: string };
  onToggleJoin?: (companionId: string) => void;
  onNotify?: (message: string) => void;
}

const QUICK_REPLIES = [
  'Saio em 5 min',
  'Nos vemos na entrada da BU?',
  'Vamos pela alameda iluminada?',
];

function getVariantForId(id: string): TrioVariant {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return pickTrioVariant(hash);
}

/**
 * In-sheet chat view powered by UIArc ChatThread for coordinating safe walking
 * routes with UFSC colleagues or multi-member walking groups.
 * Enforces fail-fast Zod XSS/length validation and pure React plain-text rendering.
 */
export const CompanionChatView: React.FC<CompanionChatViewProps> = ({
  companion,
  messages: messagesProp,
  dark,
  isNightMap,
  onBack,
  onSendMessage,
  onSend,
  onToggleJoin,
  onNotify,
}) => {
  const store = useCampusStore();
  // Sync with both global app darkMode and map isNightMap (RouteSheet passes isNightMap even when false).
  const isDark = dark ?? Boolean(isNightMap || store.darkMode || store.isNightMap);
  const messages = messagesProp ?? store.chatMessages[companion.id] ?? [];
  const currentUserId = store.userSession ? 'user-current' : 'demo-user';
  const currentUserName = store.userSession?.name ?? 'Você';

  const [error, setError] = useState<string | null>(null);

  const originLabel =
    UFSC_LANDMARKS.find((n) => n.id === companion.originId)?.shortName ?? companion.originId;
  const destLabel =
    UFSC_LANDMARKS.find((n) => n.id === companion.destinationId)?.shortName ??
    companion.destinationId;

  const displayName = companion.groupTitle || companion.name;
  const groupMembers = useMemo(
    () => (companion.isGroup && companion.members ? companion.members : []),
    [companion.isGroup, companion.members]
  );

  const headerSubtitle = useMemo(() => {
    const routeSummary = `${originLabel} → ${destLabel} • ${companion.departureTime}`;
    const meetingSuffix = companion.meetingPoint ? ` • ${companion.meetingPoint}` : '';
    const womenPrefix = companion.womenOnly ? 'Grupo feminino • ' : '';
    if (groupMembers.length === 0) return `${womenPrefix}${routeSummary}${meetingSuffix}`;
    const names = groupMembers
      .slice(0, 3)
      .map((member) => member.name.split(' ')[0])
      .join(', ');
    return `${womenPrefix}${names} • ${routeSummary}${meetingSuffix}`;
  }, [companion.departureTime, companion.meetingPoint, companion.womenOnly, destLabel, groupMembers, originLabel]);

  const avatarVariant = groupMembers[0]?.mascotVariant ?? getVariantForId(companion.id);

  const participants = useMemo<ArcChatParticipant[]>(() => {
    const map = new Map<string, ArcChatParticipant>();

    map.set(currentUserId, {
      id: currentUserId,
      name: currentUserName,
      mascotVariant: 'blue',
    });

    if (groupMembers.length > 0) {
      for (const member of groupMembers) {
        map.set(member.id, {
          id: member.id,
          name: member.name,
          mascotVariant: member.mascotVariant,
        });
      }
    } else {
      map.set(companion.id, {
        id: companion.id,
        name: companion.name,
        mascotVariant: getVariantForId(companion.id),
      });
    }

    for (const msg of messages) {
      if (msg.isSystem) continue;
      if (msg.senderId === 'user-current' || msg.senderId === 'demo-user') continue;
      if (!map.has(msg.senderId)) {
        map.set(msg.senderId, {
          id: msg.senderId,
          name: msg.senderName,
          mascotVariant: getVariantForId(msg.senderId),
        });
      }
    }

    return Array.from(map.values());
  }, [companion.id, companion.name, currentUserId, currentUserName, groupMembers, messages]);

  const systemNotices = useMemo(() => messages.filter((msg) => msg.isSystem), [messages]);

  const arcMessages = useMemo<ArcChatMessage[]>(() => {
    return messages
      .filter((msg) => !msg.isSystem)
      .map((msg) => {
        const isMine = msg.senderId === 'user-current' || msg.senderId === 'demo-user';
        const reactions: ArcChatReaction[] = msg.reactions
          ? Object.entries(msg.reactions)
              .filter(([, users]) => users.length > 0)
              .map(([emoji, users]) => ({
                emoji,
                count: users.length,
                mine:
                  users.includes('user-current') ||
                  users.includes('demo-user') ||
                  users.includes(currentUserId),
              }))
          : [];

        return {
          id: msg.id,
          authorId: isMine ? currentUserId : msg.senderId,
          text: msg.text,
          createdAt: msg.timestamp || new Date().toISOString(),
          reactions: reactions.length > 0 ? reactions : undefined,
          status: isMine ? 'sent' : undefined,
        };
      });
  }, [currentUserId, messages]);

  const submitText = (textToSend: string) => {
    setError(null);

    const validation = ChatMessageSchema.safeParse({
      senderId: currentUserId,
      senderName: currentUserName,
      text: textToSend,
    });

    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? 'Mensagem inválida');
      return;
    }

    const result = onSend
      ? onSend(validation.data.text)
      : onSendMessage
        ? onSendMessage(companion.id, validation.data.text)
        : store.sendChatMessage(companion.id, validation.data.text);

    if (!result.success) {
      setError(result.error ?? 'Não foi possível enviar a mensagem');
    }
  };

  const handleToggleJoin = () => {
    if (onToggleJoin) {
      onToggleJoin(companion.id);
    } else {
      store.toggleJoinCompanion(companion.id);
    }
  };

  const headerBorderClass = isDark ? 'border-white/10' : 'border-[rgba(15,23,42,0.08)]';
  const titleTextClass = isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]';
  const mutedTextClass = isDark ? 'text-[#8696A0]' : 'text-[#54656F]';
  const chatSurfaceClass = isDark
    ? 'bg-[#0B141A] border-white/10'
    : 'bg-[#EFEAE2] border-[rgba(15,23,42,0.08)]';

  return (
    <div className="flex flex-col gap-2.5 pt-1 pb-2" data-testid="companion-chat-view">
      {/* WhatsApp-Inspired Single Header: Borderless Back Link, Avatar, Title/Subtitle & Join Pill */}
      <header className={`flex items-center justify-between gap-2 pb-2.5 border-b ${headerBorderClass}`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para rota e colegas"
            className={`min-h-[44px] pl-1 pr-2 -ml-1 rounded-lg inline-flex items-center gap-0.5 text-[15px] font-medium transition-colors duration-150 active:opacity-70 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008069] ${
              isDark
                ? 'text-[#00A884] hover:bg-white/[0.06]'
                : 'text-[#008069] hover:bg-black/[0.04]'
            }`}
          >
            <ChevronLeft className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Voltar</span>
          </button>

          <TrioCharacterAvatar variant={avatarVariant} size={36} className="shrink-0" />

          <div className="min-w-0">
            <h3 className={`text-[15px] font-semibold tracking-tight leading-tight truncate ${titleTextClass}`}>
              {displayName}
            </h3>
            <p className={`text-[11px] leading-snug truncate mt-0.5 ${mutedTextClass}`}>
              {headerSubtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleJoin}
          aria-pressed={Boolean(companion.isUserJoined)}
          className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 transition-[transform,background-color,color] duration-150 active:scale-[0.96] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008069] ${
            companion.isUserJoined
              ? isDark
                ? 'bg-[#00A884] text-[#0B141A]'
                : 'bg-[#008069] text-white'
              : isDark
                ? 'bg-[#202C33] text-[#E9EDEF] hover:bg-[#2A3942]'
                : 'bg-[#0F172A]/[0.06] text-[#111B21] hover:bg-[#0F172A]/[0.10]'
          }`}
        >
          {companion.isUserJoined && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>{companion.isUserJoined ? 'No grupo' : 'Entrar'}</span>
        </button>
      </header>

      {/* WhatsApp-Style ChatThread Surface */}
      <div className={`flex flex-col rounded-2xl border overflow-hidden min-h-[260px] max-h-[48vh] ${chatSurfaceClass}`}>
        {systemNotices.length > 0 && (
          <div className="flex flex-col items-center gap-1 px-3 pt-2.5">
            {systemNotices.map((notice) => (
              <p
                key={notice.id}
                role="status"
                className={`text-[11px] text-center px-3 py-1 rounded-lg ${
                  isDark
                    ? 'bg-[#182229] text-[#8696A0]'
                    : 'bg-white/85 text-[#54656F] shadow-[0_1px_1px_rgba(11,20,26,0.06)]'
                }`}
              >
                {notice.text}
              </p>
            ))}
          </div>
        )}

        {arcMessages.length === 0 && (
          <p className={`text-[11px] text-center px-4 pt-2.5 pb-1 ${mutedTextClass}`}>
            Combine o ponto de encontro iluminado com {displayName}.
          </p>
        )}

        <ChatThread
          participants={participants}
          currentUserId={currentUserId}
          messages={arcMessages}
          typing={store.typingByChannel[companion.id] ?? []}
          readBy={store.readByChannel[companion.id]}
          dark={isDark}
          placeholder="Escreva uma mensagem segura..."
          composerAriaLabel={`Mensagem para ${displayName}`}
          label={`Conversa com ${displayName}`}
          onSend={submitText}
          onReact={(messageId, emoji) =>
            store.reactToChatMessage(companion.id, messageId, emoji)
          }
          className="flex-1 min-h-0"
        />
      </div>

      {/* Validation Alert */}
      {error && (
        <p
          role="alert"
          className={`text-xs font-medium px-2 ${
            isDark ? 'text-[#FF6B6B]' : 'text-[#D70015]'
          }`}
        >
          {error}
        </p>
      )}

      {/* Slim Horizontal Quick-Reply Chips + One-Tap Arrival Check-In */}
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            store.sendArrivalCheckIn(companion.id);
            onNotify?.('Check-in de chegada enviado para o grupo!');
          }}
          className={`shrink-0 min-h-[44px] px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-[transform,colors] duration-150 active:scale-[0.96] cursor-pointer ${
            isDark
              ? 'bg-[#00A884]/20 border-[#00A884]/45 text-[#6EE7B7] hover:bg-[#00A884]/30'
              : 'bg-[#D1FAE5] border-[#10B981]/35 text-[#065F46] hover:bg-[#A7F3D0]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Cheguei bem ✓</span>
        </button>

        {QUICK_REPLIES.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => submitText(chip)}
            className={`min-h-[44px] px-3.5 rounded-full text-xs font-medium shrink-0 transition-colors active:scale-[0.97] cursor-pointer ${
              isDark
                ? 'bg-[#202C33] text-[#E9EDEF] hover:bg-[#2A3942]'
                : 'bg-[#F0F2F5] text-[#111B21] hover:bg-[#E4E6EB]'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
};
