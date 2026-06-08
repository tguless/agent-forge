import fs from 'node:fs';
import path from 'node:path';
import type { ForgePromptKey } from '@/lib/forgePrompts';

const DEFAULT_SYSTEM = `You are the Forge — an autonomous agent that designs a single tactical "command-card" AI agent for a business.

You are given a business description and a job description. Using the skills below, produce a complete, specific, operator-grade agent: identity, narrative, lists, metrics, a detailed Markdown skill file, and three visual assets. Use the provided tools to record every part. Do not ask the user questions — make strong, specific decisions grounded in the inputs.

{{visualNote}}

Follow this exact sequence of tool calls:
1) set_identity
2) generate_image (emblem)  3) generate_image (portrait)  4) generate_image (icon)
5) set_narrative  6) set_lists  7) set_metrics
8) write_skill_file
9) finalize

IMPORTANT: generate the three images RIGHT AFTER set_identity (before the long skill file) so the
visual identity appears quickly. Call tools one logical step at a time. After finalize, stop.`;

const DEFAULT_USER_TEMPLATE = `Slug for this agent: {{slug}}

BUSINESS CONTEXT:
{{businessContext}}

JOB DESCRIPTION:
{{jobDescription}}

Design the agent now.`;

const DEFAULT_EXAMPLE_SYSTEM = `You invent realistic demo inputs for Agent Forge — a product that forges tactical AI agent command cards from a business description and a job description.

Return ONLY valid JSON (no markdown fences, no commentary) with exactly these keys:
- "businessContext": 2–4 sentences — what the company does and the document/workflow pain (name concrete systems, volumes, or SLAs where natural)
- "jobDescription": 2–4 sentences — the agent role, recurring tasks, escalation bar, and artifacts it produces
- "titleHint": a short agent name ending in "Agent" (e.g. "Claims Triage Agent")

Be specific and operator-grade. Avoid corporate filler and emoji. Vary industries unless the user specifies a theme.`;

const DEFAULT_EXAMPLE_USER = `{{themeInstruction}}

Generate one fresh example now.`;

const DEFAULT_IMAGE = {
  white_bg:
    'Pure flat white background #FFFFFF only, no gradients, no shadows on background, no border, no frame, no text, no watermark.',
  fill_hint:
    'The glyph must be VERY LARGE: fill 88-92% of the square canvas edge-to-edge, bold thick strokes, minimal empty margin, centered.',
  icon_template: '{{white_bg}} {{fill_hint}} Single minimalist flat vector icon in color {{accent}} only: {{subject}}.',
  emblem_white_bg:
    'Pure flat white background #FFFFFF only, no gradients, no shadows on background, no border, no frame. Full symmetrical winged commander insignia badge centered, fills 90% of canvas edge-to-edge.',
  winged_plaque:
    'Hyper-realistic 3D metal-organic military commander insignia plaque, IDENTICAL structural style to a Command and Conquer supreme winged commander badge: symmetrical large mechanical armored wings with layered gunmetal-teal metal plates, visible gears and pistons at wing roots, thick circular brushed gunmetal ring behind center sculpture, V-shaped metallic chevron base, dramatic cinematic rim lighting, polished metal with gold trim accents, micro-scratches, heavy dimensional depth.',
  emblem_forbidden:
    'FORBIDDEN centerpiece: five-point star, generic star, eagle, sunburst, empty circle. FORBIDDEN: any text, words, letters, nameplate typography. FORBIDDEN composition: flat 2D HUD icon, standalone logo mark, icon-only glyph, cropped center badge without wings — the full symmetrical winged plaque MUST be visible edge-to-edge.',
  rank_wings_3: 'Wings: medium mechanical wings (field officer rank).',
  rank_wings_4: 'Wings: large two-layer wings (executive commander rank), slightly smaller than supreme.',
  rank_wings_5: 'Wings: largest triple-layer wingspan (supreme commander rank).',
  emblem_template:
    '{{emblem_white_bg}} {{winged_plaque}} {{rank_wings}} Primary accent {{accent}} on the center sculpture and wing highlights. CENTER SCULPTURE ONLY (wings come from the plaque, not from this description): {{subject}} — rendered in polished metal inside the winged ring. The winged commander badge fills the frame; do not draw a small isolated icon or flat HUD glyph. {{emblem_forbidden}} Same photoreal metal-organic quality as supreme commander rook emblem.',
  portrait_base:
    'Photorealistic cinematic portrait cosplay, Command and Conquer RTS commander character style like a Red Alert / Generals briefing screen. Upper body bust, facing camera, confident tactical expression. Dark olive-black background with faint green HUD grid. Dramatic rim lighting. No text, no logos, no watermark.',
  rank_uniform_3:
    'Field officer tactical vest and fatigues: practical gear, compact rank patch, unit commander on deployment.',
  rank_uniform_4:
    'Executive officer jacket: structured shoulders, medium ornate rank bars, professional HQ commander.',
  rank_uniform_5:
    'Supreme commander dress uniform: long coat, gold epaulettes, highest rank insignia, most ornate.',
  portrait_template:
    '{{portrait_base}} {{rank_uniform}} Accent color {{accent}} on uniform trim and holograms. {{subject}} Unique individual — distinct face and styling.',
};

function readSkillFile(name: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'skills', name), 'utf8');
  } catch {
    return '';
  }
}

/** Server-only: shipped defaults (skills read from disk). */
export function getDefaultPromptContent(key: ForgePromptKey): string {
  switch (key) {
    case 'forge.system':
      return DEFAULT_SYSTEM;
    case 'forge.user_template':
      return DEFAULT_USER_TEMPLATE;
    case 'forge.example.system':
      return DEFAULT_EXAMPLE_SYSTEM;
    case 'forge.example.user_template':
      return DEFAULT_EXAMPLE_USER;
    case 'skills.agent_architect':
      return readSkillFile('01-agent-architect.skill.md');
    case 'skills.skill_file_author':
      return readSkillFile('02-skill-file-author.skill.md');
    case 'skills.visual_identity':
      return readSkillFile('03-visual-identity.skill.md');
    case 'image.shared.white_bg':
      return DEFAULT_IMAGE.white_bg;
    case 'image.shared.fill_hint':
      return DEFAULT_IMAGE.fill_hint;
    case 'image.icon.template':
      return DEFAULT_IMAGE.icon_template;
    case 'image.emblem.white_bg':
      return DEFAULT_IMAGE.emblem_white_bg;
    case 'image.emblem.winged_plaque':
      return DEFAULT_IMAGE.winged_plaque;
    case 'image.emblem.forbidden':
      return DEFAULT_IMAGE.emblem_forbidden;
    case 'image.emblem.rank_wings_3':
      return DEFAULT_IMAGE.rank_wings_3;
    case 'image.emblem.rank_wings_4':
      return DEFAULT_IMAGE.rank_wings_4;
    case 'image.emblem.rank_wings_5':
      return DEFAULT_IMAGE.rank_wings_5;
    case 'image.emblem.template':
      return DEFAULT_IMAGE.emblem_template;
    case 'image.portrait.base':
      return DEFAULT_IMAGE.portrait_base;
    case 'image.portrait.rank_uniform_3':
      return DEFAULT_IMAGE.rank_uniform_3;
    case 'image.portrait.rank_uniform_4':
      return DEFAULT_IMAGE.rank_uniform_4;
    case 'image.portrait.rank_uniform_5':
      return DEFAULT_IMAGE.rank_uniform_5;
    case 'image.portrait.template':
      return DEFAULT_IMAGE.portrait_template;
    default:
      return '';
  }
}
