import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Users } from 'lucide-react';
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
}) => {
  const store = useCampusStore();
  const isDark = isNightMap ?? dark ?? store.isNightMap ?? false;
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
  const groupMembers = companion.isGroup && companion.members ? companion.members : [];

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

  const borderClass = isDark ? 'border-[#1E293B]' : 'border-[#D5E0EE]';
  const mutedTextClass = isDark ? 'text-[#94A3B8]' : 'text-[#475569]';
  const surfaceClass = isDark ? 'bg-[#0F172A] border-[#1E293B]' : 'bg-[#FFFFFF] border-[#D5E0EE]';

  return (
    <div className="flex flex-col gap-3 pt-1 pb-2" data-testid="companion-chat-view">
      {/* Header with >= 44px Voltar button, Trio Avatar(s) & Join toggle */}
      <div className={`flex items-center justify-between gap-2 pb-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para rota e colegas"
            className={`min-h-[44px] min-w-[44px] px-3 rounded-full inline-flex items-center gap-1.5 text-sm font-medium border transition-colors active:scale-[0.97] cursor-pointer shrink-0 ${
              isDark
                ? 'bg-[#111C34] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]'
                : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
            }`}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Voltar</span>
          </button>

          {groupMembers.length > 0 ? (
            <span className="inline-flex items-center -space-x-2 shrink-0" aria-hidden="true">
              {groupMembers.slice(0, 3).map((member, idx) => (
                <TrioCharacterAvatar
                  key={member.id}
                  variant={member.mascotVariant}
                  size={28}
                  className={idx === 1 ? 'z-10' : ''}
                />
              ))}
            </span>
          ) : (
            <TrioCharacterAvatar
              variant={getVariantForId(companion.id)}
              size={34}
              className="shrink-0"
            />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-semibold tracking-tight truncate">{displayName}</h3>
              {companion.isGroup && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                    isDark
                      ? 'bg-[#5EC2F3]/15 text-[#5EC2F3]'
                      : 'bg-[#EFF6FF] text-[#2563EB]'
                  }`}
                >
                  <Users className="w-3 h-3" aria-hidden="true" />
                  <span>{groupMembers.length + 1}</span>
                </span>
              )}
            </div>
            <p className={`text-xs truncate ${mutedTextClass}`}>
              {originLabel} → {destLabel} •{' '}
              <Clock className="inline w-3 h-3 -mt-0.5" aria-hidden="true" />{' '}
              {companion.departureTime}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleJoin}
          aria-pressed={Boolean(companion.isUserJoined)}
          className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 border transition-all active:scale-[0.97] cursor-pointer ${
            companion.isUserJoined
              ? 'bg-[#2563EB] text-white border-[#2563EB]'
              : isDark
                ? 'bg-[#111C34] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]'
                : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
          }`}
        >
          {companion.isUserJoined && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>{companion.isUserJoined ? 'No grupo' : 'Entrar'}</span>
        </button>
      </div>

      {/* Group Members Strip */}
      {groupMembers.length > 0 && (
        <div
          aria-label="Integrantes do grupo"
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
        >
          {companion.isUserJoined && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                isDark
                  ? 'bg-[#2563EB]/20 text-[#93C5FD] border-[#2563EB]/40'
                  : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
              }`}
            >
              <TrioCharacterAvatar variant="blue" size={18} />
              <span>Você</span>
            </span>
          )}
          {groupMembers.map((member) => (
            <span
              key={member.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                isDark
                  ? 'bg-[#111C34] text-[#E2E8F0] border-[#1E293B]'
                  : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE]'
              }`}
            >
              <TrioCharacterAvatar variant={member.mascotVariant} size={18} />
              <span>{member.name.split(' ')[0]}</span>
            </span>
          ))}
        </div>
      )}

      {/* System Notices (e.g. group created status) */}
      {systemNotices.length > 0 && (
        <div className="space-y-1">
          {systemNotices.map((notice) => (
            <p
              key={notice.id}
              role="status"
              className={`text-xs text-center px-3 py-1.5 rounded-xl border ${
                isDark
                  ? 'bg-[#111C34] text-[#CBD5E1] border-[#1E293B]'
                  : 'bg-[#F8FAFC] text-[#475569] border-[#E5ECF6]'
              }`}
            >
              {notice.text}
            </p>
          ))}
        </div>
      )}

      {/* UIArc ChatThread */}
      <div className={`flex flex-col rounded-2xl border overflow-hidden min-h-[250px] max-h-[46vh] ${surfaceClass}`}>
        {arcMessages.length === 0 && (
          <p className={`text-xs text-center px-4 pt-3 pb-1 ${mutedTextClass}`}>
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

      {/* Quick-Reply Safe Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {QUICK_REPLIES.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => submitText(chip)}
            className={`min-h-[44px] px-3.5 rounded-full text-xs font-medium shrink-0 border transition-colors active:scale-[0.97] cursor-pointer ${
              isDark
                ? 'bg-[#111C34] text-[#F8FAFC] border-[#1E293B] hover:border-[#5EC2F3]'
                : 'bg-[#FFFFFF] text-[#0F172A] border-[#D5E0EE] hover:border-[#2563EB]'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
};
