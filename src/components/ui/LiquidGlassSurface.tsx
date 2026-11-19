import React from 'react';

export type LiquidGlassVariant = 'control' | 'panel' | 'card' | 'pill' | 'nav';

export interface LiquidGlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LiquidGlassVariant;
  dark?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const LiquidGlassSurface: React.FC<LiquidGlassSurfaceProps> = ({
  variant = 'control',
  dark = false,
  className = '',
  children,
  ...props
}) => {
  const baseGlassClass = dark
    ? 'liquid-glass-dark text-[#F8FAFC]'
    : 'liquid-glass text-[var(--label-primary)]';

  const variantClass = (() => {
    switch (variant) {
      case 'pill':
      case 'nav':
        return 'rounded-full';
      case 'panel':
      case 'card':
        return 'rounded-[24px] p-4';
      case 'control':
      default:
        return 'rounded-2xl p-3';
    }
  })();

  return (
    <div
      className={`${baseGlassClass} ${variantClass} transition-colors duration-200 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};
