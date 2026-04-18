import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Message } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FlyingMessageProps {
  message: Message & { font_size?: number; sequence?: number };
  onOpen: (id: string | number) => void;
  isMe: boolean;
  isLocked?: boolean;
  initialPos?: { x: string; y: string };
}

export const FlyingMessage: React.FC<FlyingMessageProps> = ({ message, onOpen, isMe, isLocked, initialPos }) => {
  const [xTarget] = useState(`${20 + Math.random() * 60}%`);
  const [yTarget] = useState(`${20 + Math.random() * 40}%`);
  const [scale] = useState((message.font_size || 1.0) * 1.25);
  const [showHint, setShowHint] = useState(false);

  const handleClick = () => {
    if (isMe) return;
    
    if (isLocked) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 2500);
      return;
    }

    console.log('👆 [FlyingMessage] Heart Clicked!', { id: message.id, isMe });
    onOpen(message.id);
  };

  return (
    <motion.div
      initial={{ 
        left: initialPos?.x || (isMe ? '85%' : '50%'), 
        top: initialPos?.y || '110%', 
        scale: 0,
        rotate: isMe ? 45 : -45 
      }}
      animate={{ 
        left: [initialPos?.x || '50%', xTarget, '50%', isMe ? '80%' : '20%', initialPos?.x || '50%'],
        top: ['80%', yTarget, '50%', '30%', '80%'],
        scale: isMe ? scale * 0.8 : scale,
        rotate: [0, 5, -5, 5, 0],
        x: showHint ? [0, -10, 10, -10, 10, 0] : 0
      }}
      transition={{ 
        left: { duration: 25 + Math.random() * 10, repeat: Infinity, ease: "linear" },
        top: { duration: 20 + Math.random() * 8, repeat: Infinity, ease: "linear" },
        scale: { duration: 0.8, ease: "backOut" },
        rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" },
        x: { duration: 0.4 }
      }}
      style={{ zIndex: message.sequence ? (100 - message.sequence) : 50 }}
      className={`absolute pointer-events-auto group flex items-center justify-center ${isMe ? 'cursor-default opacity-40 grayscale-[0.3]' : 'cursor-pointer opacity-100'}`}
      onClick={handleClick}
    >
      <div className="relative flex items-center justify-center">
        {/* Immersive Hint Tooltip */}
        <AnimatePresence>
          {showHint && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.5 }}
              animate={{ opacity: 1, y: -60, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="absolute whitespace-nowrap bg-pink-500 text-white text-[10px] font-black px-3 py-2 rounded-full shadow-2xl z-[100] border-2 border-white pointer-events-none"
            >
              Nhấn vào trái số 1 trước nhé ❤️
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-pink-500 rotate-45 border-r-2 border-b-2 border-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Magic Glowing Aura */}
        <div className={`absolute inset-0 blur-2xl opacity-30 rounded-full scale-150 animate-pulse ${isMe ? 'bg-pink-300' : 'bg-red-500'}`} />
        
        {/* Dynamic Shape based on Effect */}
        {message.effect === 'kiss' ? (
          <div 
            className={`flex items-center justify-center filter drop-shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse`}
            style={{ 
              width: `${56 * scale}px`, 
              height: `${56 * scale}px`,
              fontSize: `${42 * scale}px`
            }}
          >
            💋
          </div>
        ) : (
          <Heart 
            className={`transition-all duration-500 ${isMe ? 'text-pink-300 fill-pink-200' : 'text-red-500 fill-red-500 filter drop-shadow-[0_0_20px_rgba(220,38,38,0.7)] group-hover:scale-110'}`}
            style={{ 
              width: `${56 * scale}px`, 
              height: `${56 * scale}px` 
            }}
          />
        )}
        
        {/* Central Sequence Number */}
        <div className="absolute inset-0 flex items-center justify-center">
           <span 
             className={cn(
               "font-black italic drop-shadow-md select-none",
               isMe ? "text-pink-100/50" : "text-white"
             )}
             style={{ fontSize: `${24 * scale}px` }}
           >
             {message.sequence}
           </span>
        </div>
      </div>
    </motion.div>
  );
};
