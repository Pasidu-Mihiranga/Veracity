'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Smooth Scroll-Aware Header Navigation Hook.
 *
 * Smoothly reduces header island width on scroll with hysteresis threshold.
 * Keeps outer wrapper height fixed to guarantee zero layout shifts or gaps.
 */
export function useHeaderCompress() {
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const headerIslandRef = useRef<HTMLElement>(null);
  const [headerCompact, setHeaderCompact] = useState(false);

  const onMainScroll = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    if (y > 25 && !headerCompact) {
      setHeaderCompact(true);
    } else if (y < 10 && headerCompact) {
      setHeaderCompact(false);
    }
  }, [headerCompact]);

  const resetHeaderCompress = useCallback(() => {
    setHeaderCompact(false);
  }, []);

  return {
    mainScrollRef,
    headerIslandRef,
    headerCompact,
    onMainScroll,
    resetHeaderCompress,
  };
}
