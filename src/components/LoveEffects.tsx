import React, { useEffect, useState } from 'react';

type Effect = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  opacity: number;
};

interface LoveEffectsProps {
  type: 'none' | 'hearts' | 'bubbles' | 'kiss';
  trigger?: number;
}

const HEART_ICONS = ['❤️', '💖', '💗', '💓', '💝', '💕'];
const BUBBLE_COLORS = ['#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899'];
const KISS_ICONS = ['💋', '😘', '👄', '❤️', '🌹'];

export const LoveEffects: React.FC<LoveEffectsProps> = ({ type, trigger = 0 }) => {
  const [effects, setEffects] = useState<Effect[]>([]);

  const generateEffects = () => {
    const newEffects = Array.from({ length: type === 'kiss' ? 30 : 15 }).map((_, i) => ({
      id: Date.now() + i + Math.random(),
      x: Math.random() * 100,
      y: Math.random() * 20 + 80, // Start from bottom
      size: Math.random() * (type === 'kiss' ? 45 : 30) + (type === 'kiss' ? 35 : 20),
      delay: Math.random() * (type === 'kiss' ? 0.3 : 2), // Kisses start almost immediately
      duration: Math.random() * (type === 'kiss' ? 2 : 3) + 3,
      rotation: Math.random() * 360,
      opacity: Math.random() * 0.5 + 0.5,
    }));
    
    if (type === 'kiss') {
      setEffects(prev => [...prev.slice(-60), ...newEffects]);
    } else {
      setEffects(newEffects);
    }
    
    setTimeout(() => {
      setEffects(prev => prev.filter(e => !newEffects.find(ne => ne.id === e.id)));
    }, 6000);
  };

  useEffect(() => {
    if (type !== 'none') {
      generateEffects();
    } else {
      setEffects([]);
    }
  }, [type, trigger]);

  if (type === 'none' || effects.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {effects.map((effect) => {
        const commonStyle: React.CSSProperties = {
          left: `${effect.x}%`,
          animationDuration: `${effect.duration}s`,
          animationDelay: `${effect.delay}s`,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          opacity: 0,
        };

        if (type === 'hearts') {
          return (
            <div
              key={effect.id}
              className="absolute"
              style={{
                ...commonStyle,
                animationName: 'float-heart',
                fontSize: `${effect.size}px`,
                transform: `rotate(${effect.rotation}deg)`,
              }}
            >
              {HEART_ICONS[Math.floor(Math.random() * HEART_ICONS.length)]}
            </div>
          );
        }

        if (type === 'bubbles') {
          return (
            <div
              key={effect.id}
              className="absolute rounded-full blur-[1px]"
              style={{
                ...commonStyle,
                animationName: 'float-bubble',
                width: `${effect.size}px`,
                height: `${effect.size}px`,
                backgroundColor: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
              }}
            />
          );
        }

        if (type === 'kiss') {
          return (
            <div
              key={effect.id}
              className="absolute"
              style={{
                ...commonStyle,
                animationName: 'float-kiss',
                fontSize: `${effect.size}px`,
                transform: `rotate(${effect.rotation}deg)`,
              }}
            >
              {KISS_ICONS[Math.floor(Math.random() * KISS_ICONS.length)]}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
