import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
  rotate: number;
  size: number;
  type: 'confetti' | 'heart';
}

interface HeartExplosionProps {
  x: number;
  y: number;
  onComplete: () => void;
}

export const HeartExplosion: React.FC<HeartExplosionProps> = ({ x, y, onComplete }) => {
  const [active, setActive] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);
  const colors = ['#ff4d6d', '#ff85a1', '#ffb3c1', '#ffffff', '#ff0054', '#fb7185', '#fda4af'];

  useEffect(() => {
    const newParticles: Particle[] = [];
    const particleCount = 40;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 5 + Math.random() * 15;
      newParticles.push({
        id: i,
        x: x,
        y: y,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        rotate: Math.random() * 360,
        size: 4 + Math.random() * 8,
        type: Math.random() > 0.4 ? 'confetti' : 'heart'
      });
    }

    setParticles(newParticles);
    const timer = setTimeout(() => {
      setActive(false);
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [x, y, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ 
                left: p.x, 
                top: p.y, 
                scale: 1, 
                opacity: 1, 
                rotate: 0 
              }}
              animate={{ 
                left: p.x + p.vx * 15,
                top: [p.y, p.y + p.vy * 10, p.y + 300], // Gravity fall
                scale: [1, 1.2, 0],
                opacity: [1, 1, 0],
                rotate: p.rotate + 720
              }}
              transition={{ 
                duration: 1.5 + Math.random() * 1,
                ease: "easeOut"
              }}
              className="absolute flex items-center justify-center"
              style={{
                color: p.color,
              }}
            >
              {p.type === 'heart' ? (
                <Heart className="fill-current" style={{ width: p.size, height: p.size }} />
              ) : (
                <div 
                  className="rounded-sm" 
                  style={{ 
                    width: p.size, 
                    height: p.size / 1.5, 
                    backgroundColor: p.color,
                    boxShadow: `0 0 10px ${p.color}80` 
                  }} 
                />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};
