import React, { useId } from 'react';

export type TrioVariant = 'blue' | 'gold' | 'pink';

const TRIO_THEME: Record<
  TrioVariant,
  { from: string; to: string; ring: string; ink: string }
> = {
  blue: { from: '#87D7FA', to: '#5EC2F3', ring: '#BCE7FD', ink: '#0F172A' },
  gold: { from: '#FFE270', to: '#F7C648', ring: '#FDE896', ink: '#0F172A' },
  pink: { from: '#F5A4CE', to: '#EE86BF', ring: '#FBCFE8', ink: '#0F172A' },
};

export function pickTrioVariant(index: number): TrioVariant {
  const order: TrioVariant[] = ['blue', 'gold', 'pink'];
  return order[Math.abs(index) % order.length]!;
}

/**
 * Miniature expressive orb sharing the exact WelcomeBack trio visual identity
 * (Sky Blue, Solar Gold, Friendly Pink) to keep Home, Map, Chat, Lights & Reports unified.
 */
export const TrioCharacterAvatar: React.FC<{
  variant: TrioVariant;
  size?: number;
  className?: string;
  label?: string;
}> = ({ variant, size = 32, className = '', label }) => {
  const uid = useId();
  const palette = TRIO_THEME[variant];

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center rounded-full shrink-0 relative ${className}`.trim()}
    >
      <svg
        viewBox="0 0 40 40"
        width={size}
        height={size}
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`${uid}-g`} cx="35%" cy="30%" r="72%">
            <stop offset="0%" stopColor={palette.from} />
            <stop offset="100%" stopColor={palette.to} />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="18.5" fill={`url(#${uid}-g)`} stroke="#FFFFFF" strokeWidth="1.5" />

        {variant === 'blue' && (
          <g fill={palette.ink}>
            <ellipse cx="14.5" cy="18" rx="2.6" ry="3.3" transform="rotate(-12 14.5 18)" />
            <ellipse cx="25.5" cy="19.5" rx="2.7" ry="3.4" transform="rotate(-8 25.5 19.5)" />
            <circle cx="15.2" cy="16.8" r="0.9" fill="#FFFFFF" />
            <circle cx="26.2" cy="18.2" r="0.9" fill="#FFFFFF" />
          </g>
        )}

        {variant === 'gold' && (
          <g>
            <path d="M12.5 19.5c.4-2.5 3.6-2.5 4 0" fill="none" stroke={palette.ink} strokeWidth="2.1" strokeLinecap="round" />
            <path d="M23.5 19.5c.4-2.5 3.6-2.5 4 0" fill="none" stroke={palette.ink} strokeWidth="2.1" strokeLinecap="round" />
            <path d="M14.5 24c2.8 3 8.2 3 11 0" fill="none" stroke={palette.ink} strokeWidth="2.1" strokeLinecap="round" />
          </g>
        )}

        {variant === 'pink' && (
          <g fill={palette.ink}>
            <ellipse cx="15" cy="18.5" rx="2.4" ry="3.2" transform="rotate(14 15 18.5)" />
            <ellipse cx="24.5" cy="21" rx="2.3" ry="3.1" transform="rotate(14 24.5 21)" />
          </g>
        )}
      </svg>
    </span>
  );
};

/**
 * Overlapping trio stack connecting WelcomeBack's 3 mascots directly to Home & Group headers.
 */
export const TrioMascotStack: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 26, className = '' }) => (
  <span
    className={`inline-flex items-center -space-x-2 ${className}`.trim()}
    aria-hidden="true"
  >
    <TrioCharacterAvatar variant="blue" size={size} />
    <TrioCharacterAvatar variant="gold" size={size} className="z-10" />
    <TrioCharacterAvatar variant="pink" size={size} />
  </span>
);

