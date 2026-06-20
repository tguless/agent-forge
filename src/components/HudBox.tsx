'use client';

import React from 'react';

type HudBoxProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
  variant?: 'chamfer' | 'rect';
};

/** HUD panel with explicit L-bracket corners (avoids clip-path eating corners). */
export const HudBox = React.forwardRef<HTMLDivElement, HudBoxProps>(function HudBox(
  { children, className = '', variant = 'rect', ...rest },
  ref,
) {
  return (
    <div ref={ref} className={`ops-hud-box ops-hud-box--${variant} ${className}`.trim()} {...rest}>
      <span className="ops-box-corner ops-box-corner-tl" aria-hidden />
      <span className="ops-box-corner ops-box-corner-tr" aria-hidden />
      <span className="ops-box-corner ops-box-corner-bl" aria-hidden />
      <span className="ops-box-corner ops-box-corner-br" aria-hidden />
      <div className="ops-hud-box-body">{children}</div>
    </div>
  );
});

export default HudBox;
