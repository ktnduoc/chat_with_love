import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FireworkParticle {
  id: number;
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
}

export const Fireworks: React.FC = () => {
  const [active, setActive] = useState(true);
  const [particles, setParticles] = useState<FireworkParticle[]>([]);
  const colors = ['#ff4d6d', '#ff85a1', '#ffb3c1', '#ffffff', '#ff0054', '#fb7185', '#fda4af'];

  useEffect(() => {
    const newParticles: FireworkParticle[] = [];
    // Create multiple bursts across the screen
    const bursts = [
      { x: 20, y: 30 },
      { x: 80, y: 25 },
      { x: 50, y: 50 },
      { x: 30, y: 70 },
      { x: 70, y: 65 }
    ];

    bursts.forEach((burst, bIdx) => {
      for (let i = 0; i < 30; i++) {
        const angle = (Math.PI * 2 * i) / 30 + (Math.random() * 0.5);
        const velocity = 3 + Math.random() * 6;
        newParticles.push({
          id: bIdx * 30 + i,
          x: burst.x,
          y: burst.y,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity
        });
      }
    });

    setParticles(newParticles);
    const timer = setTimeout(() => setActive(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <div className="absolute inset-0 pointer-events-none z-[150] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ left: `${p.x}%`, top: `${p.y}%`, scale: 1, opacity: 1 }}
              animate={{ 
                left: [`${p.x}%`, `${p.x + p.vx}%`],
                top: [`${p.y}%`, `${p.y + p.vy}%`, `${p.y + p.vy + 20}%`], // Added Gravity fall
                scale: [1, 1.5, 0],
                opacity: [1, 1, 0]
              }}
              transition={{ 
                duration: 2.5 + Math.random() * 1.5,
                ease: "easeOut"
              }}
              className="absolute w-2 h-2 rounded-full shadow-[0_0_15px_currentColor]"
              style={{
                color: p.color,
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};
