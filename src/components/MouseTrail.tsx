import React, { useEffect, useState, useCallback } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  velocity: { x: number; y: number };
  life: number;
}

export const MouseTrail: React.FC = () => {
  const [stars, setStars] = useState<Star[]>([]);
  const colors = ['#FFD700', '#FF69B4', '#FFB6C1', '#FFFFFF', '#FF1493'];

  const addStar = useCallback((x: number, y: number) => {
    const id = Math.random();
    const newStar: Star = {
      id,
      x,
      y,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 2 + 1,
      },
      life: 1.0,
    };
    setStars(prev => [...prev.slice(-40), newStar]); // Keep last 40 stars for performance
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only add star sometimes to avoid overcrowding
      if (Math.random() > 0.6) {
        addStar(e.clientX, e.clientY);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [addStar]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStars(prev => 
        prev
          .map(star => ({
            ...star,
            x: star.x + star.velocity.x,
            y: star.y + star.velocity.y,
            life: star.life - 0.02,
          }))
          .filter(star => star.life > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
      {stars.map(star => (
        <div
          key={star.id}
          className="absolute flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: star.x,
            top: star.y,
            opacity: star.life,
            scale: star.life,
          }}
        >
          <svg
            width={star.size}
            height={star.size}
            viewBox="0 0 24 24"
            fill={star.color}
            style={{ filter: `drop-shadow(0 0 ${star.size / 2}px ${star.color})` }}
          >
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>
      ))}
    </div>
  );
};
