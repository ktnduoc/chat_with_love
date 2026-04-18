import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Heart {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
}

export const HeartPop: React.FC<{ x: number; y: number; onComplete: () => void }> = ({ x, y, onComplete }) => {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const colors = ['#ff4d6d', '#ff758f', '#ff8fa3', '#ffb3c1', '#ffccd5'];

  useEffect(() => {
    const newHearts = Array.from({ length: 8 }).map((_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 15 + 10,
    }));
    setHearts(newHearts);

    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            initial={{ opacity: 1, scale: 0, x: heart.x, y: heart.y }}
            animate={{ 
              opacity: 0, 
              scale: 1.5, 
              y: heart.y - 120,
              x: heart.x + (Math.random() - 0.5) * 100,
              rotate: Math.random() * 360
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ position: 'absolute' }}
          >
            <svg
              width={heart.size}
              height={heart.size}
              viewBox="0 0 24 24"
              fill={heart.color}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
