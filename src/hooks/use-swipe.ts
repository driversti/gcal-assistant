import { useRef, useCallback, type RefObject } from "react";

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipe<T extends HTMLElement>({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true,
}: UseSwipeOptions): {
  ref: RefObject<T | null>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
} {
  const ref = useRef<T | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      const dx = e.changedTouches[0].clientX - startX.current;
      const dy = e.changedTouches[0].clientY - startY.current;

      // Only trigger if horizontal movement is dominant
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;

      if (dx > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold, enabled]
  );

  return { ref, onTouchStart, onTouchEnd };
}
