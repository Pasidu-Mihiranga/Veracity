'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useHeaderCompress() {
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const headerIslandRef = useRef<HTMLElement>(null);
  const headerCompress = useRef(0);
  const headerTarget = useRef(0);
  const headerRaf = useRef(0);
  const [headerCompact, setHeaderCompact] = useState(false);

  function tickHeaderCompress() {
    headerRaf.current = 0;
    const island = headerIslandRef.current;
    if (!island) return;

    const next = headerCompress.current + (headerTarget.current - headerCompress.current) * 0.14;
    headerCompress.current = Math.abs(headerTarget.current - next) < 0.001
      ? headerTarget.current
      : next;

    const t = headerCompress.current;
    island.style.setProperty('--hc', t.toFixed(4));
    const compact = t > 0.58;
    island.classList.toggle('header-island--compact', compact);
    setHeaderCompact((prev) => (prev === compact ? prev : compact));

    if (headerCompress.current !== headerTarget.current) {
      headerRaf.current = requestAnimationFrame(tickHeaderCompress);
    }
  }

  const onMainScroll = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const raw = Math.min(1, Math.max(0, el.scrollTop / 96));
    headerTarget.current = raw * raw * (3 - 2 * raw);
    if (!headerRaf.current) {
      headerRaf.current = requestAnimationFrame(tickHeaderCompress);
    }
  }, []);

  useEffect(
    () => () => {
      if (headerRaf.current) cancelAnimationFrame(headerRaf.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const island = headerIslandRef.current;
    if (!island) return;
    island.style.setProperty('--hc', headerCompress.current.toFixed(4));
  });

  const resetHeaderCompress = useCallback(() => {
    headerCompress.current = 0;
    headerTarget.current = 0;
    if (headerRaf.current) {
      cancelAnimationFrame(headerRaf.current);
      headerRaf.current = 0;
    }
    const island = headerIslandRef.current;
    if (island) {
      island.style.setProperty('--hc', '0');
      island.classList.remove('header-island--compact');
    }
    setHeaderCompact(false);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, []);

  return {
    mainScrollRef,
    headerIslandRef,
    headerCompact,
    onMainScroll,
    resetHeaderCompress,
  };
}
