import React, { useState } from 'react';
import { motion, PanInfo, useDragControls } from 'motion/react';

export type SheetDetent = 'peek' | 'medium' | 'expanded';

export interface BottomSheetProps {
  detent?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
  dark?: boolean;
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
  grabberLabel = 'Alternar tamanho do painel',
  children,
  className = '',
}) => {
  const [internalDetent, setInternalDetent] = useState<SheetDetent>('peek');
  const isControlled = controlledDetent !== undefined;
  const currentDetent = isControlled ? controlledDetent : internalDetent;
  const dragControls = useDragControls();

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
    ? 'bg-[#1c1c1e] text-[#f3f3f4] border-t border-[#2e2e32]'
    : 'bg-white text-[#131314] border-t border-[#dfe3e6]';

  const grabberPillClass = dark ? 'bg-[#46444a]' : 'bg-[#dfe3e6]';

  return (
    <motion.aside
      data-testid="bottom-sheet"
      data-detent={currentDetent}
      aria-label="Painel de detalhes"
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      animate={{ height: currentDetent === 'peek' ? 140 : currentDetent === 'medium' ? '48vh' : '88vh' }}
      transition={{ type: 'spring', bounce: 0.16, duration: 0.4 }}
      className={`fixed inset-x-0 bottom-0 z-40 rounded-t-[32px] shadow-2xl flex flex-col will-change-[height] ${sheetThemeClasses} ${DETENT_HEIGHTS[currentDetent]} ${className}`}
    >
      {/* Clickable grabber hit target >= 44px with dedicated drag initiation */}
      <button
        type="button"
        aria-label={grabberLabel}
        onClick={handleCycle}
        onPointerDown={(e) => dragControls.start(e)}
        className="w-full min-h-[44px] h-11 flex items-center justify-center cursor-grab active:cursor-grabbing focus:outline-none select-none py-3 touch-none"
      >
        <span
          className={`w-9 h-1 rounded-full pointer-events-none transition-colors duration-150 ${grabberPillClass}`}
        />
      </button>

      {/* Sheet content container with pb-24 to clear FloatingTabBar */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 pt-1">
        {children}
      </div>
    </motion.aside>
  );
};
