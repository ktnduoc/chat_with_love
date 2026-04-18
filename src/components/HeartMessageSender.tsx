import React, { useState, useRef } from 'react';
import { Heart } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HeartMessageSenderProps {
  onSend: (size: number) => void;
  disabled?: boolean;
  hasText: boolean;
}

export const HeartMessageSender: React.FC<HeartMessageSenderProps> = ({ onSend, disabled, hasText }) => {
  const [isPumping, setIsPumping] = useState(false);
  const [pumpSize, setPumpSize] = useState(1);
  const pumpTimer = useRef<number | undefined>(undefined);

  const startPumping = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || !hasText) return;
    if (e.cancelable) e.preventDefault();
    
    console.log('🎈 [HeartSender] Start pumping heart...');
    setIsPumping(true);
    setPumpSize(1);
    
    pumpTimer.current = window.setInterval(() => {
      setPumpSize(prev => {
        const next = Math.min(prev + 0.15, 3.5); // Limiting to 3.5x for safety
        return next;
      });
    }, 100);
  };

  const stopPumping = () => {
    if (!isPumping) return;
    
    console.log('🚀 [HeartSender] Releasing heart! Final size:', pumpSize.toFixed(2));
    clearInterval(pumpTimer.current);
    setIsPumping(false);
    onSend(pumpSize);
    setPumpSize(1);
  };

  return (
    <div className="relative">
      <button
        onMouseDown={startPumping}
        onMouseUp={stopPumping}
        onMouseLeave={stopPumping}
        onTouchStart={startPumping}
        onTouchEnd={stopPumping}
        disabled={disabled || !hasText}
        className={cn(
          "p-3.5 rounded-full transition-all relative group touch-none",
          (disabled || !hasText)
            ? "bg-gray-100 dark:bg-white/5 text-gray-300 cursor-not-allowed opacity-50"
            : "bg-pink-100 dark:bg-pink-500/20 text-pink-500 hover:scale-110 active:scale-95 shadow-sm border border-pink-200/50",
          isPumping && "animate-pulse ring-4 ring-pink-500/30 bg-pink-500 text-white border-none"
        )}
        title={!hasText ? "Hãy nhập lời thương trước khi gởi tim nhé! 🎀" : "Nhấn giữ để thổi to trái tim bí mật 💖"}
      >
        <Heart 
          className={cn(
            "w-6 h-6 transition-transform duration-75", 
            isPumping ? "fill-white" : "fill-none"
          )} 
          style={{ transform: `scale(${isPumping ? Math.sqrt(pumpSize) : 1})` }}
        />
        
        {isPumping && (
           <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 text-pink-500 text-[10px] font-black px-3 py-1 rounded-full shadow-2xl border border-pink-100 dark:border-slate-700 animate-bounce flex items-center space-x-1">
              <span>{Math.round(pumpSize * 100)}%</span>
              <span className="animate-pulse">💓</span>
           </div>
        )}
      </button>
    </div>
  );
};
