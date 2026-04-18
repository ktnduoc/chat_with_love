import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

interface StickerExplosionProps {
  imageUrl: string;
  onComplete: () => void;
}

export const StickerExplosion: React.FC<StickerExplosionProps> = ({ imageUrl, onComplete }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate 10-12 random particles
    const newParticles = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 400, // Random X direction
      y: (Math.random() - 0.7) * 400, // Random Y (mostly up and out)
      rotate: Math.random() * 360,
      scale: 0.3 + Math.random() * 0.4
    }));
    setParticles(newParticles);

    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[100]">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-16 h-16 animate-out fade-out zoom-out duration-1000 fill-mode-forwards"
          style={{
            transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg) scale(${p.scale})`,
            transition: 'all 1s cubic-bezier(0.19, 1, 0.22, 1)'
          }}
        >
          <img src={imageUrl} className="w-full h-full object-contain drop-shadow-lg" />
        </div>
      ))}
    </div>
  );
};
