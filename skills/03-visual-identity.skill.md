# Skill: Visual Identity

You commission three images per agent via the `generate_image` tool. The backend wraps your `subject` in the correct house style — so you only describe the **subject**, plus pass the agent's `accent` and `authority`.

**Critical:** icon and emblem are **different art styles**. The index-card icon is a flat HUD glyph. The detail emblem is a full winged C&C commander badge with a single 3D metal center sculpture. Call `generate_image` three times with **three different subject strings** — never copy the icon subject into the emblem call.

## icon (flat HUD glyph — homepage / index card)

- Flat minimalist vector, single accent color, pure white background (backend adds style).
- One simple, instantly readable symbol for the role's core function.
- Describe shape only, e.g.: "a line chart with an upward trend arrow", "an erlenmeyer flask with liquid level", "a magnifying glass over a person silhouette".
- Avoid text/letters. Prefer one bold concept, centered and large.

## emblem (winged commander badge — detail page header)

Matches PaperIQ operations emblems: **full symmetrical winged metal-organic plaque** (mechanical wings, ring, chevron) with **one** polished metal object in the center — **not** a flat icon and **not** a 3D version of the homepage glyph layout.

- Your subject is **only** the center metal sculpture. The backend template supplies the entire winged plaque around it.
- Distill the role to **one** sculptural noun — the same *metaphor* as the icon, but a **different, shorter** description formatted like: `large magnifying glass with thick circular lens and handle in violet metal — magnifying glass is the only center symbol`.
- **Never** paste or paraphrase the icon subject (no "flat vector", no multi-panel workflow, no arrows between icons, no calendars/dollar signs clustered like the HUD glyph).
- Never request a star, eagle, sunburst, or text — forbidden centerpieces.
- Never describe wings, frame, ring, or badge structure — the template adds those.

### Paired examples (icon subject ≠ emblem subject)

| icon (flat HUD) | emblem (center sculpture only) |
|---|---|
| line chart with upward trend arrow | large upward trending line chart with bold arrow tip in green metal — growth chart is the only center symbol |
| magnifying glass over person silhouette | large magnifying glass with human person silhouette inside lens in orange metal — magnifying glass is the only center symbol |
| erlenmeyer flask with liquid level | large erlenmeyer laboratory flask with liquid meniscus in cyan metal — flask is the only center symbol |
| chess rook piece | large Staunton chess rook in polished cyan-teal metal with gold rings — rook is the only center symbol |

## portrait (C&C cosplay commander bust)

- A single sentence describing the commander persona for this role: gender presentation, a role-specific prop/hologram, and accent-colored gear.
- Example: "Female finance strategist commander, amber officer coat, rising bar-chart hologram at her shoulder, ledger-plate armor."
- Make it distinct and on-theme for the function.

## Rules

- Choose one accent hex for the whole agent and pass it to all three calls (matches the card theme).
- Pass `authority` (3–5) so the emblem wing tier and portrait uniform rank match the role's seniority.
- Generate all three. If the backend reports a placeholder (no image model), continue — the card still renders.
