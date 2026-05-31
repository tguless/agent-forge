'use client';

import React from 'react';

const SEGMENTS = 10;

export function SegmentedProgress({ progress }: { progress: number }) {
  const filled = Math.round((progress / 100) * SEGMENTS);
  return (
    <div className="ops-segments" aria-hidden>
      {Array.from({ length: SEGMENTS }).map((_, i) => (
        <div key={i} className={`ops-segment${i < filled ? ' filled' : ''}`} />
      ))}
    </div>
  );
}

export default SegmentedProgress;
