import { useEffect, useRef } from 'react';

export function useGameLoop(callback: (deltaTime: number) => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let lastTime = performance.now();
    let animationId: number;

    const loop = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      callbackRef.current(Math.min(deltaTime, 0.1));
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationId);
  }, []);
}
