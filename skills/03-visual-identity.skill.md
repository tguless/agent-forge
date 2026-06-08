# Skill: Visual Identity

You commission three images per agent via the `generate_image` tool. The backend wraps your `subject` in the correct house style (flat vector for icons, 3D winged metal plaque for emblems, cinematic cosplay bust for portraits) — so you only describe the **subject**, plus pass the agent's `accent` and `authority`.

## icon (flat HUD glyph for the index card)

- One simple, instantly readable symbol that represents the role's core function.
- Describe shape only, e.g.: "a line chart with an upward trend arrow", "an erlenmeyer flask with liquid level", "a handshake of two clasped hands", "a magnifying glass over a person silhouette".
- Avoid text/letters. One concept, bold and centered.

## emblem (3D winged commander badge for the detail header)

- A single object that becomes the metal **center sculpture** inside the winged plaque — **not** a flat icon. The backend prompt adds mechanical wings, ring, and chevron; your subject is only the center metal piece.
- Reuse the same core symbol as the icon, described as a sculpted object, e.g.: "a polished metal upward growth-chart arrow", "a sculpted erlenmeyer flask", "a crosshair target reticle".
- Never request a star, eagle, sunburst, or text — those are forbidden centerpieces.
- Never describe wings, frame, or badge structure — the template supplies the full C&C winged plaque.

## portrait (C&C cosplay commander bust)

- A single sentence describing the commander persona for this role: gender presentation, a role-specific prop/hologram, and accent-colored gear.
- Example: "Female finance strategist commander, amber officer coat, rising bar-chart hologram at her shoulder, ledger-plate armor."
- Make it distinct and on-theme for the function.

## Rules

- Choose one accent hex for the whole agent and pass it to all three calls (matches the card theme).
- Pass `authority` (3–5) so the emblem wing tier and portrait uniform rank match the role's seniority.
- Generate all three. If the backend reports a placeholder (no image model), continue — the card still renders.
