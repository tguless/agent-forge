/** Layout tokens — keep in sync with CSS vars in operations-dashboard.css */
export const FORGE_LAYOUT = {
  contentMaxPx: 1180,
  pageGutterPx: 16,
} as const;

export type ForgePageTheme = 'dashboard' | 'detail';
export type ForgePageFrame = 'hud' | 'detail' | 'body';
