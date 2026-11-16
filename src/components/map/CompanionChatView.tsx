import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck, Send, CheckCircle2, Clock } from 'lucide-react';
import type { ChatMessage, CompanionMatch } from '../../types/campus';
import { ChatMessageSchema } from '../../security/schemas';
import { UFSC_LANDMARKS } from '../../data/ufscTrindade';

export interface CompanionChatViewProps {
  companion: CompanionMatch;
  messages: ChatMessage[];
  dark?: boolean;
  onBack: () => void;
  onSendMessage: (companionId: string, text: string) => { success: boolean; error?: string };
  onToggleJoin: (companionId: string) => void;
}

const QUICK_REPLIES = [
  'Saio em 5 min',
  'Nos vemos na entrada da BU?',
  'Vamos pela alameda iluminada?',
];

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * In-sheet chat view for coordinating safe walking routes with a Gov.br-verified peer.
 * Enforces fail-fast Zod XSS/length validation and pure React plain-text rendering.
 */
export const CompanionChatView: React.FC<CompanionChatViewProps> = ({
  companion,
  messages,
  dark = false,
  onBack,
  onSendMessage,
  onToggleJoin,
}) => {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const originLabel =
    UFSC_LANDMARKS.find((n) => n.id === companion.originId)?.shortName ?? companion.originId;
  const destLabel =
    UFSC_LANDMARKS.find((n) => n.id === companion.destinationId)?.shortName ??
    companion.destinationId;

  const submitText = (textToSend: string, clearInput: boolean) => {
    setError(null);

    const validation = ChatMessageSchema.safeParse({
      senderId: 'user-current',
      senderName: 'Você',
      text: textToSend,
    });

    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? 'Mensagem inválida');
      return;
    }

    const result = onSendMessage(companion.id, validation.data.text);
    if (!result.success) {
      setError(result.error ?? 'Não foi possível enviar a mensagem');
      return;
    }

    if (clearInput) {
      setDraft('');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitText(draft, true);
  };

  const borderClass = dark ? 'border-[#2e2e32]' : 'border-[#dfe3e6]';
  const mutedTextClass = dark ? 'text-[#a1a1aa]' : 'text-[#66646d]';
  const subtleBgClass = dark ? 'bg-[#262629]' : 'bg-[#f3f3f4]';

  return (
    <div className="flex flex-col gap-3 pt-1 pb-24" data-testid="companion-chat-view">
      {/* Header with >= 44px Voltar button */}
      <div className={`flex items-center justify-between gap-2 pb-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para rota e colegas"
            className={`min-h-[44px] min-w-[44px] px-3 rounded-full inline-flex items-center gap-1.5 text-sm font-medium border transition-colors active:scale-[0.97] cursor-pointer shrink-0 ${
              dark
                ? 'bg-[#262629] text-[#f3f3f4] border-[#3a3a3e] hover:bg-[#333337]'
                : 'bg-[#f3f3f4] text-[#131314] border-[#dfe3e6] hover:bg-[#e7e7ea]'
            }`}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Voltar</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-medium truncate">{companion.name}</h3>
              {companion.isGovBrVerified && (
                <span
                  title="Verificado Gov.br"
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                    dark
                      ? 'bg-[#befc65]/15 text-[#befc65]'
                      : 'bg-[#15803d]/10 text-[#15803d]'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  <span>Gov.br</span>
                </span>
              )}
            </div>
            <p className={`text-xs truncate ${mutedTextClass}`}>
              {originLabel} → {destLabel} •{' '}
              <Clock className="inline w-3 h-3 -mt-0.5" aria-hidden="true" /> {companion.departureTime}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleJoin(companion.id)}
          aria-pressed={Boolean(companion.isUserJoined)}
          className={`min-h-[44px] px-3 rounded-full text-xs font-semibold shrink-0 inline-flex items-center gap-1 transition-all active:scale-[0.97] cursor-pointer ${
            companion.isUserJoined
              ? 'bg-[#befc65] text-[#131314]'
              : dark
                ? 'bg-[#262629] text-[#f3f3f4] border border-[#3a3a3e]'
                : 'bg-[#f3f3f4] text-[#131314] border border-[#dfe3e6]'
          }`}
        >
          {companion.isUserJoined && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>{companion.isUserJoined ? 'No grupo' : 'Entrar'}</span>
        </button>
      </div>

      {/* Messages Thread (100% Pure React Plain Text) */}
      <div
        className={`rounded-2xl p-3 space-y-2.5 max-h-56 overflow-y-auto border ${borderClass} ${subtleBgClass}`}
      >
        {messages.length === 0 ? (
          <p className={`text-sm text-center py-4 ${mutedTextClass}`}>
            Envie uma mensagem rápida para combinar o ponto de encontro iluminado com{' '}
            {companion.name}.
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === 'user-current' || msg.senderId === 'demo-user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                    isOwn
                      ? 'bg-[#befc65] text-[#131314] rounded-br-sm'
                      : dark
                        ? 'bg-[#1c1c1e] text-[#f3f3f4] border border-[#2e2e32] rounded-bl-sm'
                        : 'bg-white text-[#131314] border border-[#dfe3e6] rounded-bl-sm'
                  }`}
                >
                  <p className="break-words">{msg.text}</p>
                </div>
                <span className={`text-[11px] mt-1 px-1 ${mutedTextClass}`}>
                  {isOwn ? 'Você' : msg.senderName}
                  {msg.timestamp ? ` • ${formatTime(msg.timestamp)}` : ''}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Quick-Reply Safe Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {QUICK_REPLIES.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => submitText(chip, false)}
            className={`min-h-[44px] px-3.5 rounded-full text-xs font-medium shrink-0 border transition-colors active:scale-[0.97] cursor-pointer ${
              dark
                ? 'bg-[#262629] text-[#f3f3f4] border-[#3a3a3e] hover:border-[#befc65]'
                : 'bg-white text-[#131314] border-[#dfe3e6] hover:border-[#131314]'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Input Form with Fail-Fast Zod Validation */}
      <form onSubmit={handleFormSubmit} className="space-y-2" noValidate>
        <div className="flex items-center gap-2">
          <label htmlFor="companion-chat-input" className="sr-only">
            Mensagem para {companion.name}
          </label>
          <input
            id="companion-chat-input"
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Escreva uma mensagem segura..."
            aria-label={`Mensagem para ${companion.name}`}
            aria-invalid={Boolean(error)}
            className={`flex-1 min-h-[44px] h-11 px-4 rounded-full border text-sm outline-none transition-colors ${
              dark
                ? 'bg-[#262629] text-[#f3f3f4] border-[#3a3a3e] placeholder:text-[#a1a1aa] focus:border-[#befc65]'
                : 'bg-white text-[#131314] border-[#dfe3e6] placeholder:text-[#66646d] focus:border-[#131314]'
            } ${error ? (dark ? 'border-[#FF3B30]' : 'border-[#D70015]') : ''}`}
          />
          <button
            type="submit"
            aria-label="Enviar mensagem"
            className="min-h-[44px] min-w-[44px] h-11 px-4 rounded-full bg-[#befc65] text-[#131314] font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#b0f34e] active:scale-[0.97] transition-all cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Enviar</span>
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className={`text-xs font-medium px-2 ${
              dark ? 'text-[#FF3B30]' : 'text-[#D70015]'
            }`}
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
};
