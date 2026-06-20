'use client';

import React from 'react';

/** Keep card height from shrinking/growing during ARWES fill — grows only when copy gets longer (poll updates). */
export function useForgeCardLayoutLock(deps: React.DependencyList) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const height = el.offsetHeight;
    if (height <= 0) return;
    const prev = Number.parseFloat(el.style.minHeight) || 0;
    if (height > prev) {
      el.style.minHeight = `${height}px`;
    }
  }, deps);

  return ref;
}
