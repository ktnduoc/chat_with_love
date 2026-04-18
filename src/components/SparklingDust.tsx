import React from 'react';

// Fixed: Changed to Named Export to match ChatBox.tsx import
export const SparklingDust: React.FC = () => {
  const dustParticles = Array.from({ length: 20 });

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {dustParticles.map((_, i) => {
        const size = Math.random() * 4 + 1;
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        const delay = Math.random() * 5;
        const duration = 3 + Math.random() * 4;

        return (
          <div
            key={i}
            className="absolute rounded-full bg-pink-200/40 mix-blend-screen"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${left}%`,
              top: `${top}%`,
              animationName: 'float-dust',
              animationDuration: `${duration}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDelay: `${delay}s`,
              opacity: 0,
            }}
          />
        );
      })}
      <style>{`
        @keyframes float-dust {
          0%, 100% { transform: translate(0, 0); opacity: 0; }
          50% { transform: translate(${(Math.random() - 0.5) * 100}px, ${(Math.random() - 0.5) * 100}px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
