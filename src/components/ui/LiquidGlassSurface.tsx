import React from 'react';

export type LiquidGlassVariant = 'control' | 'panel' | 'pill' | 'nav';

export interface LiquidGlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LiquidGlassVariant;
  dark?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const LiquidGlassSurface: React.FC<LiquidGlassSurfaceProps> = ({
  variant = 'panel',
  dark = false,
  className = '',
  children,
  ...props
}) => {
  const baseGlassClass = dark ? 'liquid-glass-dark text-[#f3f3f4]' : 'liquid-glass text-[#131314]';

  const variantClass = (() => {
    switch (variant) {
      case 'pill':
        return 'rounded-full';
      case 'nav':
        return 'rounded-full px-4 py-2';
      case 'control':
        return 'rounded-2xl p-3';
      case 'panel':
      default:
        return 'rounded-[24px] p-4';
    }
  })();

  return (
    <div
      className={`${baseGlassClass} ${variantClass} transition-colors duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
