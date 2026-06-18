'use client';

import React from 'react';
import Link from 'next/link';
import { useForgeInteractive } from '@/hooks/useForgeInteractive';

export function ForgeNewAgentCard() {
  const ref = React.useRef<HTMLAnchorElement>(null);

  useForgeInteractive(ref, {
    color: 'color-mix(in srgb, var(--ops-cyan, #38bdf8) 28%, transparent)',
    size: 300,
  });

  return (
    <Link
      ref={ref}
      href="/new"
      className="ops-agent-card forge-add-card"
      aria-label="Forge new agent"
    >
      <span className="ops-box-corner ops-box-corner-tl" aria-hidden />
      <span className="ops-box-corner ops-box-corner-tr" aria-hidden />
      <span className="ops-box-corner ops-box-corner-bl" aria-hidden />
      <span className="ops-box-corner ops-box-corner-br" aria-hidden />

      <div className="forge-add-card-inner">
        <span className="forge-add-card-plus" aria-hidden>
          +
        </span>
        <p className="forge-add-card-label">Forge new agent</p>
      </div>
    </Link>
  );
}

export default ForgeNewAgentCard;
