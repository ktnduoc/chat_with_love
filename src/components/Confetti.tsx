import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Piece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  size: number;
  duration: number;
}

export const Confetti: React.FC = () => {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#3b82f6'];

  useEffect(() => {
    const newPieces = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20 - Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      size: 5 + Math.random() * 10,
      duration: 3 + Math.random() * 4
    }));
    setPieces(newPieces);

    // Clean up after 8 seconds
    const timer = setTimeout(() => setPieces([]), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
      <AnimatePresence>
        {pieces.map((p) => (
          <motion.div
            key={p.id}
            initial={{ 
              top: `${p.y}%`, 
              left: `${p.x}%`, 
              rotate: p.rotation,
              opacity: 1
            }}
            animate={{ 
              top: '120%', 
              left: `${p.x + (Math.random() * 20 - 10)}%`, 
              rotate: p.rotation + 720,
              opacity: 0.2
            }}
            transition={{ 
              duration: p.duration, 
              ease: "linear",
              opacity: { duration: p.duration - 1, delay: 1 }
            }}
            className="absolute rounded-sm"
            style={{ 
              width: p.size, 
              height: p.size, 
              backgroundColor: p.color,
              boxShadow: `0 0 10px ${p.color}44`
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
