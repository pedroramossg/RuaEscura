import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';
import { ArrowDown, ArrowUp, RotateCw, SmilePlus } from 'lucide-react';
import { motionTokens } from '../../lib/motion-tokens';
import { TrioCharacterAvatar, type TrioVariant } from '../mascot/TrioMascotBadge';
import styles from './chat-thread.module.css';

export interface ArcChatParticipant {
  id: string;
  name: string;
  mascotVariant?: TrioVariant;
}

export interface ArcChatReaction {
  emoji: string;
  count: number;
  mine?: boolean;
}

export type ArcChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ArcChatMessage {
  id: string;
  authorId: string;
  text?: string;
  createdAt: Date | string | number;
  reactions?: ArcChatReaction[];
  status?: ArcChatMessageStatus;
}

export interface ChatThreadLabels {
  send?: string;
  sending?: string;
  sent?: string;
  delivered?: string;
  read?: string;
  failed?: string;
  retry?: string;
  readBy?: (names: string[]) => string;
  today?: string;
  yesterday?: string;
  typing?: (names: string[]) => string;
  newMessages?: (count: number) => string;
  jumpToLatest?: string;
  unknownAuthor?: string;
  addReaction?: string;
  reactions?: string;
  reactWith?: (emoji: string) => string;
  reactionCount?: (emoji: string, count: number, includesYou: boolean) => string;
}

const DEFAULT_LABELS: Omit<Required<ChatThreadLabels>, 'today' | 'yesterday'> = {
  send: 'Enviar',
  sending: 'Enviando',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou',
  retry: 'Tentar novamente',
  readBy: (names) => `Lido por ${names.join(', ')}`,
  typing: (names) =>
    names.length === 1
      ? `${names[0]?.split(' ')[0]} está digitando`
      : names.length === 2
        ? `${names[0]?.split(' ')[0]} e ${names[1]?.split(' ')[0]} estão digitando`
        : 'Colegas estão digitando',
  newMessages: (count) => `${count} ${count === 1 ? 'nova mensagem' : 'novas mensagens'}`,
  jumpToLatest: 'Ir para a última',
  unknownAuthor: 'Colega UFSC',
  addReaction: 'Reagir',
  reactions: 'Reações',
  reactWith: (emoji) => `Reagir com ${emoji}`,
  reactionCount: (emoji, count, includesYou) =>
    `${emoji} ${count}${includesYou ? ', incluindo você' : ''}`,
};

export interface ChatThreadHandle {
  scrollToBottom: (smooth?: boolean) => void;
  focusComposer: () => void;
}

export interface ChatThreadProps {
  participants: ArcChatParticipant[];
  currentUserId: string;
  messages: ArcChatMessage[];
  typing?: string[];
  readBy?: Record<string, string>;
  onSend: (text: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRetry?: (messageId: string) => void;
  reactions?: string[];
  placeholder?: string;
  composerAriaLabel?: string;
  groupWindow?: number;
  locale?: string;
  label?: string;
  dark?: boolean;
  labels?: ChatThreadLabels;
  className?: string;
}

type Row =
  | { type: 'day'; key: string; label: string }
  | {
      type: 'message';
      key: string;
      message: ArcChatMessage;
      author: ArcChatParticipant;
      mine: boolean;
      first: boolean;
      last: boolean;
      index: number;
    };

const { spring, duration, ease, blur } = motionTokens;
const enter = [...ease.enter] as [number, number, number, number];
const standard = [...ease.standard] as [number, number, number, number];

const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2);
  return { type: 'spring', stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 };
};

const SETTLE = physical(spring.morph.visualDuration, 0);
const GROW = physical(spring.smooth.visualDuration, 0);
const POP = physical(spring.morph.visualDuration, 0);
const ARRIVE = physical(spring.smooth.visualDuration, 0);
const DEFAULT_REACTIONS = ['👍', '💡', '🚶', '🙌', '👀'];
const STICK_DISTANCE = 48;
const FAR_DISTANCE = 180;

const subscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

const toDate = (value: ArcChatMessage['createdAt']) =>
  value instanceof Date ? value : new Date(value);
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

function dayLabel(date: Date, locale: string) {
  const today = new Date();
  const start = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((start(today) - start(date)) / 86_400_000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function withCount(text: string, value: number, node: ReactNode) {
  const digits = String(value);
  const at = text.indexOf(digits);
  return at < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, at)}
      {node}
      {text.slice(at + digits.length)}
    </>
  );
}

function Avatar({ person, size }: { person: ArcChatParticipant; size: number }) {
  if (person.mascotVariant) {
    return <TrioCharacterAvatar variant={person.mascotVariant} size={size} />;
  }
  const letters = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: '#D7ECFF' }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}

function Count({ value, reduced }: { value: number; reduced: boolean }) {
  const [last, setLast] = useState({ value, direction: 1 });
  if (last.value !== value) setLast({ value, direction: value > last.value ? 1 : -1 });
  const direction = last.value !== value ? (value > last.value ? 1 : -1) : last.direction;
  return (
    <span className={styles.countRoll}>
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={{
            in: (dir: number) => ({ opacity: 0, y: reduced ? 0 : dir * 8 }),
            rest: { opacity: 1, y: 0 },
            out: (dir: number) => ({ opacity: 0, y: reduced ? 0 : dir * -8 }),
          }}
          initial="in"
          animate="rest"
          exit="out"
          transition={reduced ? { duration: duration.fast } : spring.snappy}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TypingDots() {
  return (
    <span className={styles.dots} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function useAutoHeight(mirror: RefObject<HTMLElement | null>, maxHeight: number, reduced: boolean) {
  const height = useMotionValue<number | 'auto'>('auto');
  const measured = useRef(false);
  useLayoutEffect(() => {
    const node = mirror.current;
    if (!node) return;
    const fit = () => {
      const target = Math.min(maxHeight, node.offsetHeight);
      if (!measured.current || reduced) {
        height.jump(target);
        measured.current = true;
        return;
      }
      animate(height, target, GROW);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, maxHeight, mirror, reduced]);
  return height;
}

const ChatComposer = forwardRef<
  { focus: () => void },
  {
    onSend: (text: string) => void;
    placeholder: string;
    ariaLabel: string;
    sendLabel: string;
  }
>(function ChatComposer({ onSend, placeholder, ariaLabel, sendLabel }, ref) {
  const reduced = !!useReducedMotion();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const height = useAutoHeight(mirrorRef, 5 * 22 + 20, reduced);
  const ready = text.trim().length > 0;

  useImperativeHandle(ref, () => ({ focus: () => areaRef.current?.focus() }), []);

  const send = () => {
    const raw = text;
    onSend(raw);
    if (raw.trim().length > 0 && !raw.includes('<') && !raw.toLowerCase().includes('javascript:') && raw.trim().length <= 240) {
      setText('');
      setSent((c) => c + 1);
      areaRef.current?.focus();
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className={styles.composer}>
      <div className={styles.inputRow}>
        <div className={styles.box}>
          <motion.div className={styles.field} style={{ height }}>
            <div ref={mirrorRef} className={styles.mirror} aria-hidden="true">
              {text}
              {'\u200b'}
            </div>
            <textarea
              ref={areaRef}
              className={styles.textarea}
              value={text}
              rows={1}
              placeholder={placeholder}
              aria-label={ariaLabel}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </motion.div>
          <button
            type="button"
            className={styles.send}
            data-ready={ready || undefined}
            aria-label={sendLabel}
            onClick={send}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={sent}
                className={styles.sendIcon}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: -18, transition: { duration: duration.fast, ease: standard } }
                }
                transition={reduced ? { duration: duration.fast } : spring.snappy}
              >
                <ArrowUp size={16} strokeWidth={2.25} aria-hidden="true" />
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </div>
  );
});

/**
 * UIArc ChatThread ported cleanly for RuaEscura group & peer walking coordination:
 * - Grouped bubbles with continuous author attribution & avatar faces
 * - Smooth animated message arrival, read receipts, emoji reaction picker & live typing dots
 */
export const ChatThread = forwardRef<ChatThreadHandle, ChatThreadProps>(function ChatThread(
  {
    participants,
    currentUserId,
    messages,
    typing = [],
    readBy,
    onSend,
    onReact,
    onRetry,
    reactions = DEFAULT_REACTIONS,
    placeholder = 'Escreva uma mensagem para o grupo...',
    composerAriaLabel,
    groupWindow = 5 * 60_000,
    locale = 'pt-BR',
    label = 'Conversa do trajeto',
    dark = false,
    labels,
    className,
  },
  ref
) {
  const t = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const reduced = !!useReducedMotion();
  const hydrated = useHydrated();
  const uid = useId();
  const people = useMemo(
    () => new Map(participants.map((entry) => [entry.id, entry])),
    [participants]
  );
  const composerRef = useRef<{ focus: () => void }>(null);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    messages.forEach((message, index) => {
      const date = toDate(message.createdAt);
      const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
      const key = dayKey(validDate);
      if (key !== lastDay) {
        out.push({ type: 'day', key: `day-${key}`, label: hydrated ? dayLabel(validDate, locale) : '' });
        lastDay = key;
      }
      const joins = (other: ArcChatMessage | undefined) => {
        if (!other || other.authorId !== message.authorId) return false;
        const od = toDate(other.createdAt);
        const validOd = Number.isNaN(od.getTime()) ? new Date() : od;
        return (
          dayKey(validOd) === key && Math.abs(validOd.getTime() - validDate.getTime()) <= groupWindow
        );
      };
      out.push({
        type: 'message',
        key: message.id,
        message,
        index,
        author: people.get(message.authorId) ?? { id: message.authorId, name: t.unknownAuthor },
        mine: message.authorId === currentUserId,
        first: !joins(messages[index - 1]),
        last: !joins(messages[index + 1]),
      });
    });
    return out;
  }, [currentUserId, groupWindow, hydrated, locale, messages, people, t.unknownAuthor]);

  const receipts = useMemo(() => {
    const map = new Map<string, ArcChatParticipant[]>();
    for (const [personId, messageId] of Object.entries(readBy ?? {})) {
      const who = people.get(personId);
      const read = messages.find((m) => m.id === messageId);
      if (!who || personId === currentUserId || !read || read.authorId === personId) continue;
      map.set(messageId, [...(map.get(messageId) ?? []), who]);
    }
    return map;
  }, [currentUserId, messages, people, readBy]);

  const readIndex = useMemo(() => {
    let furthest = -1;
    receipts.forEach((_, messageId) => {
      furthest = Math.max(furthest, messages.findIndex((m) => m.id === messageId));
    });
    return furthest;
  }, [messages, receipts]);

  const lastMine = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index]!.authorId === currentUserId) return index;
    }
    return -1;
  }, [currentUserId, messages]);

  const time = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const stick = useRef(true);
  const lastHeight = useRef(0);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  const [atBottom, setAtBottom] = useState(true);
  const [far, setFar] = useState(false);
  const [seen, setSeen] = useState(() => messages.length);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    lastHeight.current = content.offsetHeight;
    scroller.scrollTop = scroller.scrollHeight;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const height = content.offsetHeight;
      const delta = height - lastHeight.current;
      lastHeight.current = height;
      if (!stick.current) return;
      scroller.scrollTop = scroller.scrollHeight;
      if (delta > 0 && delta < scroller.clientHeight && !reducedRef.current) {
        y.jump(y.get() + delta);
        animate(y, 0, SETTLE);
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [y]);

  const known = useRef(new Set(messages.map((m) => m.id)));
  useLayoutEffect(() => {
    const fresh = messages.filter((m) => !known.current.has(m.id));
    fresh.forEach((m) => known.current.add(m.id));
    if (fresh.some((m) => m.authorId === currentUserId)) stick.current = true;
  }, [currentUserId, messages]);

  const onScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    stick.current = distance < STICK_DISTANCE;
    setAtBottom(stick.current);
    setFar(distance > FAR_DISTANCE);
    if (stick.current) setSeen(messages.length);
  };

  const scrollToBottom = useCallback((smooth = true) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    stick.current = true;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: smooth && !reducedRef.current ? 'smooth' : 'auto',
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({ scrollToBottom, focusComposer: () => composerRef.current?.focus() }),
    [scrollToBottom]
  );

  const unread = atBottom
    ? 0
    : messages.slice(seen).filter((m) => m.authorId !== currentUserId).length;
  const pill = !atBottom && (unread > 0 || far);

  const [picker, setPicker] = useState<string | null>(null);
  const react = (messageId: string, emoji: string) => {
    setPicker(null);
    onReact?.(messageId, emoji);
  };

  const typers = typing
    .map((id) => people.get(id))
    .filter((entry): entry is ArcChatParticipant => !!entry && entry.id !== currentUserId);
  const typingLabel = typers.length ? t.typing(typers.map((entry) => entry.name)) : '';

  const arrive = (mine: boolean) =>
    reduced
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.92, y: 12, x: mine ? 8 : -8, filter: `blur(${blur.subtle}px)` };

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-theme={dark ? 'dark' : 'light'}
    >
      <div className={styles.viewport}>
        <div ref={scrollRef} className={styles.scroller} onScroll={onScroll} data-chat-scroller="">
          <div className={styles.track}>
            <motion.div ref={contentRef} className={styles.content} style={{ y }}>
              <ol
                className={styles.list}
                role="log"
                aria-label={label}
                aria-live="polite"
                aria-relevant="additions"
              >
                <AnimatePresence initial={false}>
                  {rows.map((row) => {
                    if (row.type === 'day') {
                      return (
                        <li key={row.key} className={styles.day}>
                          <span suppressHydrationWarning>{row.label}</span>
                        </li>
                      );
                    }
                    const { message, author, mine, first, last, index } = row;
                    const date = toDate(message.createdAt);
                    const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
                    const seenBy = receipts.get(message.id) ?? [];
                    const showStatus = index === lastMine && mine;
                    const status =
                      message.status === 'failed'
                        ? 'failed'
                        : message.status === 'sending'
                          ? 'sending'
                          : readIndex >= index
                            ? 'read'
                            : message.status ?? 'sent';
                    return (
                      <motion.li
                        key={row.key}
                        className={styles.row}
                        data-mine={mine || undefined}
                        data-first={first || undefined}
                        data-last={last || undefined}
                        data-failed={message.status === 'failed' || undefined}
                        initial={arrive(mine)}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, transition: { duration: duration.exit } }}
                        transition={
                          reduced
                            ? { duration: duration.fast }
                            : {
                                ...ARRIVE,
                                opacity: { duration: duration.standard, ease: enter },
                                filter: { duration: duration.standard, ease: enter },
                              }
                        }
                        style={{ transformOrigin: mine ? '100% 100%' : '0 100%' }}
                      >
                        {!mine && <div className={styles.gutter} />}
                        <div className={styles.stack}>
                          {first && (
                            <p className={styles.meta}>
                              {!mine && <span className={styles.author}>{author.name}</span>}
                              <time dateTime={validDate.toISOString()} suppressHydrationWarning>
                                {hydrated ? time.format(validDate) : ''}
                              </time>
                            </p>
                          )}
                          <div className={styles.line}>
                            {!mine && last && (
                              <span className={styles.face}>
                                <Avatar person={author} size={28} />
                              </span>
                            )}
                            <div className={styles.parts}>
                              {message.text && <div className={styles.bubble}>{message.text}</div>}
                            </div>
                            <ReactionPicker
                              open={picker === message.id}
                              mine={mine}
                              reactions={reactions}
                              reduced={reduced}
                              labels={t}
                              id={`${uid}-picker-${message.id}`}
                              onToggle={() =>
                                setPicker((current) => (current === message.id ? null : message.id))
                              }
                              onClose={() => setPicker(null)}
                              onPick={(emoji) => react(message.id, emoji)}
                            />
                          </div>
                          <AnimatePresence initial={false}>
                            {!!message.reactions?.length && (
                              <motion.div
                                key="reactions"
                                className={styles.reactionClip}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={
                                  reduced
                                    ? { duration: 0 }
                                    : { height: GROW, opacity: { duration: duration.fast } }
                                }
                              >
                                <ul className={styles.reactions} aria-label={t.reactions}>
                                  <AnimatePresence initial={false} mode="popLayout">
                                    {message.reactions.map((reaction) => (
                                      <motion.li
                                        key={reaction.emoji}
                                        layout={!reduced}
                                        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                                        transition={POP}
                                      >
                                        <button
                                          type="button"
                                          className={styles.reaction}
                                          aria-pressed={!!reaction.mine}
                                          aria-label={t.reactionCount(
                                            reaction.emoji,
                                            reaction.count,
                                            !!reaction.mine
                                          )}
                                          onClick={() => react(message.id, reaction.emoji)}
                                        >
                                          <span aria-hidden="true">{reaction.emoji}</span>
                                          <Count value={reaction.count} reduced={reduced} />
                                        </button>
                                      </motion.li>
                                    ))}
                                  </AnimatePresence>
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {(showStatus || seenBy.length > 0) && (
                            <div className={styles.receipts}>
                              {showStatus && (
                                <span className={styles.status} data-status={status}>
                                  {status === 'failed' ? (
                                    <>
                                      {t.failed}
                                      {onRetry && (
                                        <button
                                          type="button"
                                          className={styles.retry}
                                          onClick={() => onRetry(message.id)}
                                        >
                                          <RotateCw size={12} strokeWidth={2} aria-hidden="true" />
                                          {t.retry}
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    t[status]
                                  )}
                                </span>
                              )}
                              {seenBy.length > 0 && (
                                <span
                                  className={styles.readers}
                                  aria-label={t.readBy(seenBy.map((entry) => entry.name))}
                                >
                                  {seenBy.map((entry) => (
                                    <motion.span
                                      key={entry.id}
                                      layoutId={
                                        reduced ? undefined : `${uid}-receipt-${entry.id}`
                                      }
                                      className={styles.reader}
                                      transition={SETTLE}
                                    >
                                      <Avatar person={entry} size={16} />
                                    </motion.span>
                                  ))}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                  {typers.length > 0 && (
                    <motion.li
                      key="typing"
                      className={styles.row}
                      data-first
                      data-last
                      aria-hidden="true"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={
                        reduced
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.9, transition: { duration: duration.exit, ease: standard } }
                      }
                      transition={reduced ? { duration: duration.fast } : spring.snappy}
                      style={{ transformOrigin: '0 100%' }}
                    >
                      <div className={styles.gutter} />
                      <div className={styles.stack}>
                        <div className={styles.line}>
                          <span className={styles.face}>
                            <Avatar person={typers[0]!} size={28} />
                          </span>
                          <div className={`${styles.bubble} ${styles.typing}`}>
                            <TypingDots />
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  )}
                </AnimatePresence>
              </ol>
            </motion.div>
          </div>
        </div>
        <span className={styles.srOnly} role="status">
          {typingLabel}
        </span>
        <AnimatePresence>
          {pill && (
            <motion.button
              key="pill"
              type="button"
              className={styles.pill}
              onClick={() => scrollToBottom()}
              layout={!reduced}
              style={{ borderRadius: 16 }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: 12,
                      scale: 0.94,
                      transition: { duration: duration.exit, ease: standard },
                    }
              }
              transition={
                reduced
                  ? { duration: duration.fast }
                  : { ...spring.morph, opacity: { duration: duration.fast } }
              }
            >
              <motion.span
                className={styles.pillIcon}
                layout={reduced ? false : 'position'}
                transition={spring.morph}
              >
                <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />
              </motion.span>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={unread > 0 ? 'new' : 'latest'}
                  layout={reduced ? false : 'position'}
                  initial={{ opacity: 0, filter: `blur(${blur.subtle}px)` }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: `blur(${blur.subtle}px)` }}
                  transition={{ duration: duration.fast }}
                >
                  {unread > 0
                    ? withCount(t.newMessages(unread), unread, <Count value={unread} reduced={reduced} />)
                    : t.jumpToLatest}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <ChatComposer
        ref={composerRef}
        onSend={onSend}
        placeholder={placeholder}
        ariaLabel={composerAriaLabel ?? placeholder}
        sendLabel={t.send}
      />
    </div>
  );
});

function ReactionPicker({
  open,
  mine,
  reactions,
  reduced,
  labels,
  id,
  onToggle,
  onClose,
  onPick,
}: {
  open: boolean;
  mine: boolean;
  reactions: string[];
  reduced: boolean;
  labels: Pick<Required<ChatThreadLabels>, 'addReaction' | 'reactions' | 'reactWith'>;
  id: string;
  onToggle: () => void;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(0);
  const [below, setBelow] = useState(false);

  const toggle = () => {
    const wrap = wrapRef.current;
    const scroller = wrap?.closest('[data-chat-scroller]');
    if (!open && wrap && scroller) {
      setBelow(wrap.getBoundingClientRect().top - scroller.getBoundingClientRect().top < 56);
    }
    onToggle();
  };

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) closeRef.current();
    };
    document.addEventListener('pointerdown', down);
    const frame = requestAnimationFrame(() =>
      wrapRef.current?.querySelector<HTMLElement>("[data-emoji-index='0']")?.focus({ preventScroll: true })
    );
    return () => {
      document.removeEventListener('pointerdown', down);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      triggerRef.current?.focus();
      return;
    }
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + reactions.length) % reactions.length;
    setActive(next);
    wrapRef.current?.querySelector<HTMLElement>(`[data-emoji-index='${next}']`)?.focus();
  };

  return (
    <div
      ref={wrapRef}
      className={styles.pickerWrap}
      data-open={open || undefined}
      data-below={below || undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.reactButton}
        aria-label={labels.addReaction}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
      >
        <SmilePlus size={16} strokeWidth={1.75} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="group"
            aria-label={labels.reactions}
            className={styles.picker}
            data-mine={mine || undefined}
            onKeyDown={onKeyDown}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: below ? -6 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, y: below ? -4 : 4, transition: { duration: duration.exit, ease: standard } }
            }
            transition={reduced ? { duration: duration.fast } : POP}
          >
            {reactions.map((emoji, index) => (
              <motion.button
                key={emoji}
                type="button"
                className={styles.emoji}
                aria-label={labels.reactWith(emoji)}
                data-emoji-index={index}
                tabIndex={index === active ? 0 : -1}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...POP,
                  delay: reduced ? 0 : index * motionTokens.stagger.item,
                }}
                onFocus={() => setActive(index)}
                onClick={() => onPick(emoji)}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

