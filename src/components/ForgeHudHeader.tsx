'use client';

import React from 'react';
import { HudBox } from '@/components/HudBox';

export function ForgeHudHeader() {
  return (
    <header className="ops-hud-header" aria-labelledby="forge-main-title">
      <div className="ops-hud-header-frame">
        <span className="ops-hf-crest" aria-hidden />
        <span className="ops-hf-corner ops-hf-corner-tl" aria-hidden />
        <span className="ops-hf-corner ops-hf-corner-tr" aria-hidden />
        <span className="ops-hf-corner ops-hf-corner-bl" aria-hidden />
        <span className="ops-hf-corner ops-hf-corner-br" aria-hidden />

        <div className="ops-hud-header-inner">
          <div className="ops-hud-header-brand">
            <div className="forge-wordmark forge-wordmark--lg">
              AGENT<span>FORGE</span>
            </div>
          </div>

          <h1 id="forge-main-title" className="ops-title">
            Agent Command Foundry
            <span className="ops-title-line2">Forge an agent from a job description</span>
          </h1>

          <HudBox className="ops-outcome-box" variant="chamfer">
            <p className="ops-outcome-label">How it works</p>
            <p className="ops-outcome-text">
              Describe your <span className="ops-funnel-stage">BUSINESS</span> and a{' '}
              <span className="ops-funnel-stage">ROLE</span>, and the Forge designs a full tactical
              command card — identity, metrics, a detailed skill file, and a generated emblem,
              portrait, and icon.
            </p>
          </HudBox>
        </div>
      </div>
    </header>
  );
}

export default ForgeHudHeader;
