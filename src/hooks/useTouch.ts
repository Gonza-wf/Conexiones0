import { useEffect, useRef } from 'react';

export interface TouchInput {
  active: boolean;
  dirX: number;
  dirY: number;
}

export function useTouch() {
  const input = useRef<TouchInput>({ active: false, dirX: 0, dirY: 0 });
  const originRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const DEAD_ZONE = 10;

    const handleStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      originRef.current = { x: touch.clientX, y: touch.clientY };
      input.current.active = false;
      input.current.dirX = 0;
      input.current.dirY = 0;
    };

    const handleMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!originRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - originRef.current.x;
      const dy = touch.clientY - originRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > DEAD_ZONE) {
        input.current.active = true;
        input.current.dirX = dx / dist;
        input.current.dirY = dy / dist;
      } else {
        input.current.active = false;
        input.current.dirX = 0;
        input.current.dirY = 0;
      }
    };

    const handleEnd = (e: TouchEvent) => {
      e.preventDefault();
      originRef.current = null;
      input.current.active = false;
      input.current.dirX = 0;
      input.current.dirY = 0;
    };

    window.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd, { passive: false });
    window.addEventListener('touchcancel', handleEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleStart);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, []);

  return input;
}
