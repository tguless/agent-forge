'use client';

import Link from 'next/link';

export function ForgeNewAgentCard() {
  return (
    <Link
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
