'use client';

import React from 'react';
import { HudBox } from '@/components/HudBox';
import { ForgeDecodeText, ForgeFlowText, ForgeHeaderText } from '@/components/ForgeArwesText';
import { FORGE_DECODE_HUD_OPTS, getForgeTextDuration } from '@/lib/forgeArwesAnimate';

const OUTCOME_LABEL = 'How it works';
const WORDMARK_TEXT = 'AGENTFORGE';
/** Plain-text length of the outcome blurb (for decode timing only). */
const OUTCOME_BODY_CHARS =
  'Describe your BUSINESS and a ROLE, and the Forge designs a full tactical command card — identity, metrics, a detailed skill file, and a generated emblem, portrait, and icon.'
    .length;

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
            <ForgeDecodeText
              as="div"
              className="forge-wordmark forge-wordmark--lg"
              layout="inline"
              contentStyle={{ color: 'inherit', fontFamily: 'inherit' }}
              animateId="hud:wordmark"
              playOnce
              duration={getForgeTextDuration(WORDMARK_TEXT.length, FORGE_DECODE_HUD_OPTS)}
            >
              AGENT<span>FORGE</span>
            </ForgeDecodeText>
          </div>

          <h1 id="forge-main-title" className="ops-title">
            <ForgeHeaderText
              className="ops-title-arwes"
              duration={1.2}
              easing="outExpo"
              animateId="hud:title"
              playOnce
            >
              Agent Command Foundry
            </ForgeHeaderText>
            <span className="ops-title-line2">
              <ForgeFlowText
                contentStyle={{ color: 'var(--ops-cyan-bright)' }}
                animateId="hud:subtitle"
                playOnce
              >
                Forge an agent from a job description
              </ForgeFlowText>
            </span>
          </h1>

          <HudBox className="ops-outcome-box" variant="chamfer">
            <ForgeDecodeText
              as="p"
              className="ops-outcome-label"
              animateId="hud:outcome-label"
              playOnce
              duration={getForgeTextDuration(OUTCOME_LABEL.length, FORGE_DECODE_HUD_OPTS)}
            >
              {OUTCOME_LABEL}
            </ForgeDecodeText>
            <ForgeDecodeText
              as="p"
              className="ops-outcome-text"
              layout="block"
              animateId="hud:outcome"
              playOnce
              duration={getForgeTextDuration(OUTCOME_BODY_CHARS, FORGE_DECODE_HUD_OPTS)}
            >
              Describe your <span className="ops-funnel-stage">BUSINESS</span> and a{' '}
              <span className="ops-funnel-stage">ROLE</span>, and the Forge designs a full tactical
              command card — identity, metrics, a detailed skill file, and a generated emblem,
              portrait, and icon.
            </ForgeDecodeText>
          </HudBox>
        </div>
      </div>
    </header>
  );
}

export default ForgeHudHeader;
