import React, { useState } from 'react';
import { motion, PanInfo, useDragControls, useReducedMotion } from 'motion/react';

export type SheetDetent = 'peek' | 'medium' | 'expanded';

export interface BottomSheetProps {
  detent?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
  dark?: boolean;
  isModal?: boolean;
  grabberLabel?: string;
  children: React.ReactNode;
  className?: string;
}

const DETENT_HEIGHTS: Record<SheetDetent, string> = {
  peek: 'h-[140px]',
  medium: 'h-[48vh]',
  expanded: 'h-[88vh]',
};

export const BottomSheet: React.FC<BottomSheetProps> = ({
  detent: controlledDetent,
  onDetentChange,
  dark = false,
  isModal = false,
  grabberLabel = 'Alternar tamanho do painel',
  children,
  className = '',
}) => {
  const [internalDetent, setInternalDetent] = useState<SheetDetent>('peek');
  const isControlled = controlledDetent !== undefined;
  const currentDetent = isControlled ? controlledDetent : internalDetent;
  const dragControls = useDragControls();
  const shouldReduceMotion = useReducedMotion();

  const updateDetent = (nextDetent: SheetDetent) => {
    if (!isControlled) {
      setInternalDetent(nextDetent);
    }
    onDetentChange?.(nextDetent);
  };

  const handleCycle = () => {
    let nextDetent: SheetDetent = 'medium';
    if (currentDetent === 'peek') {
      nextDetent = 'medium';
    } else if (currentDetent === 'medium') {
      nextDetent = 'expanded';
    } else {
      nextDetent = 'peek';
    }
    updateDetent(nextDetent);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    // Dragging UP
    if (offset.y < -50 || velocity.y < -250) {
      if (currentDetent === 'peek') updateDetent('medium');
      else if (currentDetent === 'medium') updateDetent('expanded');
    }
    // Dragging DOWN
    else if (offset.y > 50 || velocity.y > 250) {
      if (currentDetent === 'expanded') updateDetent('medium');
      else if (currentDetent === 'medium') updateDetent('peek');
    }
  };

  const sheetThemeClasses = dark
    ? 'bg-[#0B132B] text-[#FEF1CF] border-t border-[#0131CD]/40 shadow-[0_-12px_36px_rgba(1,49,205,0.24)]'
    : 'bg-[#FFF9EA] text-[#0B1226] border-t border-[#E4D6B2] shadow-[0_-12px_32px_rgba(11,18,38,0.12)]';

  const grabberPillClass = dark
    ? 'bg-[#B9FC01]/70 group-hover:bg-[#B9FC01]'
    : 'bg-[#0131CD]/30 group-hover:bg-[#0131CD]/60';

  return (
    <motion.aside
      data-testid="bottom-sheet"
      data-detent={currentDetent}
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? 'true' : undefined}
      aria-label={isModal ? grabberLabel : 'Painel de detalhes'}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={shouldReduceMotion ? 0 : 0.2}
      onDragEnd={handleDragEnd}
      animate={{ height: currentDetent === 'peek' ? 140 : currentDetent === 'medium' ? '48vh' : '88vh' }}
      transition={shouldReduceMotion ? { duration: 0.01 } : { type: 'spring', bounce: 0.16, duration: 0.4 }}
      className={`fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] flex flex-col will-change-[height] ${sheetThemeClasses} ${DETENT_HEIGHTS[currentDetent]} ${className}`.trim()}
    >
      {/* Clickable grabber hit target >= 44px with dedicated drag initiation */}
      <button
        type="button"
        aria-label={grabberLabel}
        onClick={handleCycle}
        onPointerDown={(e) => dragControls.start(e)}
        className={`group w-full min-h-[44px] h-11 flex items-center justify-center cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-[-4px] ${
          dark ? 'focus-visible:outline-[#B9FC01]' : 'focus-visible:outline-[#0131CD]'
        } select-none py-3 touch-none`}
      >
        <span
          className={`w-10 h-1 rounded-full pointer-events-none transition-colors duration-150 ${grabberPillClass}`}
        />
      </button>

      {/* Sheet content container with pb-24 to clear FloatingTabBar */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 pt-1">
        {children}
      </div>
    </motion.aside>
  );
};
