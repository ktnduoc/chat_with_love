import React, { useRef, useEffect, useState } from 'react';

interface ScratchToRevealProps {
  children: React.ReactNode;
  onComplete?: () => void;
  width?: number;
  height?: number;
  coverColor?: string;
  brushSize?: number;
}

export const ScratchToReveal: React.FC<ScratchToRevealProps> = ({ 
  children, 
  onComplete, 
  width = 300, 
  height = 150, 
  coverColor = '#ec4899', // Pink-500
  brushSize = 30 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScratched, setIsScratched] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scratchedPercentage, setScratchedPercentage] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Initial Cover
    ctx.fillStyle = coverColor;
    ctx.fillRect(0, 0, width, height);

    // Add some "golden dust" texture
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add Text over the cover
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cào ở đây nhé... ✨', width / 2, height / 2 + 5);
  }, [width, height, coverColor]);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isScratched) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();

    checkProgress(ctx);
  };

  const checkProgress = (ctx: CanvasRenderingContext2D) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    let transparentPixels = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) transparentPixels++;
    }

    const percentage = (transparentPixels / (width * height)) * 100;
    setScratchedPercentage(percentage);

    if (percentage > 50 && !isScratched) {
      setIsScratched(true);
      onComplete?.();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border-4 border-white/20 shadow-2xl" style={{ width, height }}>
      {/* Hidden Content */}
      <div className="absolute inset-0 flex items-center justify-center bg-transparent z-0">
        {children}
      </div>

      {/* Scratch Layer */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`absolute inset-0 z-10 cursor-crosshair transition-opacity duration-1000 ${isScratched ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onMouseDown={() => setIsDrawing(true)}
        onMouseUp={() => setIsDrawing(false)}
        onMouseMove={handleMove}
        onTouchStart={() => setIsDrawing(true)}
        onTouchEnd={() => setIsDrawing(false)}
        onTouchMove={handleMove}
      />
      
      {/* Progress Indicator */}
      {!isScratched && scratchedPercentage > 0 && (
        <div className="absolute bottom-2 right-2 z-20 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase italic">
          Cào: {Math.round(scratchedPercentage)}%
        </div>
      )}
    </div>
  );
};
