import React from 'react';

export type PillButtonVariant = 'lime' | 'ink' | 'cobalt' | 'glass' | 'danger' | 'outline';
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
        return 'bg-[#111827] text-white hover:bg-[#1F2937] active:scale-[0.97] shadow-sm';
      case 'ink':
      case 'cobalt':
        return 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:scale-[0.97] shadow-sm';
      case 'glass':
        return 'liquid-glass text-[#111827] hover:bg-white active:scale-[0.97]';
      case 'danger':
        return 'bg-[#D70015] text-white hover:bg-[#b50012] active:scale-[0.97] shadow-sm';
      case 'outline':
        return 'border border-[#E5EAF4] bg-white text-[#111827] hover:bg-[#F6F8FC] active:scale-[0.97]';
      default:
        return 'bg-[#2563EB] text-white';
    }
  })();

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-120 ease-out select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};
