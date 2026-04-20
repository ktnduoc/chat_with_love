import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Heart } from 'lucide-react';

interface FlyingHeart {
  id: number;
  sx: number;
  sy: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  ex: number;
  ey: number;
  size: number;
  startAt: number;
  duration: number;
  startRotate: number;
  rotateDelta: number;
}

interface RenderHeart {
  id: number;
  x: number;
  y: number;
  size: number;
  scale: number;
  rotate: number;
  opacity: number;
}

interface FloatingHeartTapperProps {
  targetRef: React.RefObject<HTMLElement | null>;
  onTap?: () => void;
}

export const FloatingHeartTapper: React.FC<FloatingHeartTapperProps> = ({
  targetRef,
  onTap
}) => {
  const HEART_BUTTON_SIZE = 56;
  const HEART_BUTTON_PADDING = 12;
  const HEART_BUTTON_STORAGE_KEY = 'lovechat:floating-heart-button';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const heartsRef = useRef<FlyingHeart[]>([]);
  const rafRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const movedDuringDragRef = useRef(false);
  const [flyingHearts, setFlyingHearts] = useState<RenderHeart[]>([]);
  const [burstKey, setBurstKey] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });

  const heartPath = useMemo(
    () =>
      "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A5.5 5.5 0 0 1 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z",
    []
  );

  const stopAnimationLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopAnimationLoop();
      heartsRef.current = [];
    };
  }, []);

  const clampButtonPos = (x: number, y: number) => {
    const maxX = Math.max(HEART_BUTTON_PADDING, window.innerWidth - HEART_BUTTON_SIZE - HEART_BUTTON_PADDING);
    const maxY = Math.max(HEART_BUTTON_PADDING, window.innerHeight - HEART_BUTTON_SIZE - HEART_BUTTON_PADDING);
    return {
      x: Math.min(Math.max(x, HEART_BUTTON_PADDING), maxX),
      y: Math.min(Math.max(y, HEART_BUTTON_PADDING), maxY)
    };
  };

  useEffect(() => {
    const fallback = clampButtonPos(window.innerWidth - HEART_BUTTON_SIZE - 20, window.innerHeight - HEART_BUTTON_SIZE - 112);
    try {
      const raw = window.localStorage.getItem(HEART_BUTTON_STORAGE_KEY);
      if (!raw) {
        setButtonPos(fallback);
        return;
      }
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        setButtonPos(clampButtonPos(parsed.x, parsed.y));
      } else {
        setButtonPos(fallback);
      }
    } catch {
      setButtonPos(fallback);
    }
  }, []);

  useEffect(() => {
    if (buttonPos.x === 0 && buttonPos.y === 0) return;
    try {
      window.localStorage.setItem(HEART_BUTTON_STORAGE_KEY, JSON.stringify(buttonPos));
    } catch {
      // ignore storage failures
    }
  }, [buttonPos]);

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (event: PointerEvent) => {
      const next = clampButtonPos(event.clientX - dragOffsetRef.current.x, event.clientY - dragOffsetRef.current.y);
      movedDuringDragRef.current = true;
      setButtonPos(next);
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const onResize = () => {
      setButtonPos(prev => clampButtonPos(prev.x, prev.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startAnimationLoop = () => {
    if (rafRef.current !== null) return;

    const tick = () => {
      const now = performance.now();
      const active = heartsRef.current.filter(heart => now - heart.startAt < heart.duration);
      heartsRef.current = active;

      const renderList: RenderHeart[] = active.map(heart => {
        const elapsed = Math.max(0, now - heart.startAt);
        const progress = Math.min(1, elapsed / heart.duration);
        // Keep speed close to uniform by using linear progress on one smooth cubic path.
        const eased = progress;
        const oneMinus = 1 - eased;
        const x =
          oneMinus * oneMinus * oneMinus * heart.sx +
          3 * oneMinus * oneMinus * eased * heart.c1x +
          3 * oneMinus * eased * eased * heart.c2x +
          eased * eased * eased * heart.ex;
        const y =
          oneMinus * oneMinus * oneMinus * heart.sy +
          3 * oneMinus * oneMinus * eased * heart.c1y +
          3 * oneMinus * eased * eased * heart.c2y +
          eased * eased * eased * heart.ey;
        const scale = 1 - eased * 0.5;
        const rotate = heart.startRotate + heart.rotateDelta * eased;
        const opacity = 0.95 - eased * 0.78;

        return {
          id: heart.id,
          x,
          y,
          size: heart.size,
          scale,
          rotate,
          opacity
        };
      });

      setFlyingHearts(renderList);

      if (active.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        stopAnimationLoop();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const spawnHeart = () => {
    if (!triggerRef.current) return;

    const sourceRect = triggerRef.current.getBoundingClientRect();
    const targetRect = targetRef.current?.getBoundingClientRect();

    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;

    const targetX = targetRect
      ? targetRect.left + targetRect.width / 2
      : window.innerWidth * 0.5;
    const targetY = targetRect
      ? targetRect.top + targetRect.height / 2
      : 48;

    const launchDistance = 180;
    const launchDrop = Math.tan((15 * Math.PI) / 180) * launchDistance;
    const dipDepth = 230;
    const dipPullToTarget = 210;
    const next: FlyingHeart = {
      id: Date.now(),
      sx: startX,
      sy: startY,
      // Make the dip obvious: start at ~15deg down-left, sink deeper, then curve up to header.
      c1x: startX - launchDistance,
      c1y: startY + launchDrop + dipDepth,
      c2x: targetX - dipPullToTarget,
      c2y: startY + dipDepth,
      ex: targetX,
      ey: targetY,
      size: 20,
      startAt: performance.now(),
      duration: 2100,
      startRotate: 0,
      rotateDelta: 24
    };

    heartsRef.current = [...heartsRef.current, next];
    startAnimationLoop();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    movedDuringDragRef.current = false;
    setIsDragging(true);
    dragOffsetRef.current = {
      x: event.clientX - buttonPos.x,
      y: event.clientY - buttonPos.y
    };
  };

  const handleTap = () => {
    if (movedDuringDragRef.current) {
      movedDuringDragRef.current = false;
      return;
    }
    setBurstKey(prev => prev + 1);
    spawnHeart();
    onTap?.();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={handlePointerDown}
        onClick={handleTap}
        className="fixed z-[1450] w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-[0_16px_34px_rgba(244,63,94,0.45)] border border-white/40 flex items-center justify-center active:scale-95 transition-transform touch-none select-none"
        title="Thả tim"
        style={{
          left: `${buttonPos.x}px`,
          top: `${buttonPos.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          animation: burstKey > 0 ? 'floating-heart-tap-burst 340ms ease-out' : undefined
        }}
      >
        <Heart className="w-7 h-7 fill-current" />
      </button>

      {flyingHearts.map(heart => {
        return (
          <svg
            key={heart.id}
            viewBox="0 0 24 24"
            className="fixed z-[1490] pointer-events-none"
            style={{
              left: `${heart.x}px`,
              top: `${heart.y}px`,
              width: `${heart.size}px`,
              height: `${heart.size}px`,
              transform: `translate(-50%, -50%) scale(${heart.scale}) rotate(${heart.rotate}deg)`,
              opacity: heart.opacity,
              filter: 'drop-shadow(0 0 8px rgba(251,113,133,0.8))'
            }}
          >
            <path d={heartPath} fill="currentColor" className="text-rose-400" />
          </svg>
        );
      })}
    </>
  );
};
