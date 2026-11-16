import React from 'react';

export type PillButtonVariant = 'lime' | 'ink' | 'glass' | 'danger' | 'outline';
export type PillButtonSize = 'compact' | 'feature';

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant;
  size?: PillButtonSize;
  children: React.ReactNode;
}

export const PillButton: React.FC<PillButtonProps> = ({
  variant = 'lime',
  size = 'compact',
  className = '',
  children,
  type = 'button',
  ...props
}) => {
  const sizeClasses =
    size === 'feature'
      ? 'h-20 min-h-[44px] px-8 text-xl font-medium tracking-normal'
      : 'h-12 min-h-[44px] px-6 text-base font-medium tracking-normal';

  const variantClasses = (() => {
    switch (variant) {
      case 'lime':
        return 'bg-[#befc65] text-[#131314] hover:bg-[#b0f34e] active:scale-[0.97] shadow-sm';
      case 'ink':
        return 'bg-[#131314] text-white hover:bg-[#26262b] active:scale-[0.97] shadow-sm';
      case 'glass':
        return 'liquid-glass text-[#131314] hover:bg-white/85 active:scale-[0.97]';
      case 'danger':
        return 'bg-[#D70015] text-white hover:bg-[#b50012] active:scale-[0.97] shadow-sm';
      case 'outline':
        return 'border border-[#dfe3e6] bg-transparent text-[#131314] hover:bg-[#f3f3f4] active:scale-[0.97]';
      default:
        return 'bg-[#befc65] text-[#131314]';
    }
  })();

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-120 ease-out select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#131314] disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
