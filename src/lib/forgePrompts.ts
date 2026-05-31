/** Stable ids for every LLM prompt the Forge can override. */
export type ForgePromptKey =
  | 'forge.system'
  | 'forge.user_template'
  | 'skills.agent_architect'
  | 'skills.skill_file_author'
  | 'skills.visual_identity'
  | 'image.shared.white_bg'
  | 'image.shared.fill_hint'
  | 'image.icon.template'
  | 'image.emblem.white_bg'
  | 'image.emblem.winged_plaque'
  | 'image.emblem.forbidden'
  | 'image.emblem.rank_wings_3'
  | 'image.emblem.rank_wings_4'
  | 'image.emblem.rank_wings_5'
  | 'image.emblem.template'
  | 'image.portrait.base'
  | 'image.portrait.rank_uniform_3'
  | 'image.portrait.rank_uniform_4'
  | 'image.portrait.rank_uniform_5'
  | 'image.portrait.template';

export type ForgePromptCategory = 'forge' | 'skills' | 'image';

export type ForgePromptDef = {
  key: ForgePromptKey;
  label: string;
  category: ForgePromptCategory;
  categoryLabel: string;
  description: string;
  placeholders: string[];
  format: 'markdown' | 'text';
};

const CATEGORY_LABELS: Record<ForgePromptCategory, string> = {
  forge: 'Agent Forge (Anthropic)',
  skills: 'Meta skills (Anthropic system)',
  image: 'Image generation (Gemini)',
};

export const FORGE_PROMPT_DEFS: ForgePromptDef[] = [
  {
    key: 'forge.system',
    label: 'System instructions',
    category: 'forge',
    categoryLabel: CATEGORY_LABELS.forge,
    description: 'Core Anthropic system prompt for the Forge agent loop. Meta skills are appended after this block.',
    placeholders: ['{{visualNote}}'],
    format: 'markdown',
  },
  {
    key: 'forge.user_template',
    label: 'User message template',
    category: 'forge',
    categoryLabel: CATEGORY_LABELS.forge,
    description: 'First user turn sent when forging an agent. Substitute slug and inputs at runtime.',
    placeholders: ['{{slug}}', '{{businessContext}}', '{{jobDescription}}'],
    format: 'markdown',
  },
  {
    key: 'skills.agent_architect',
    label: 'Agent architect skill',
    category: 'skills',
    categoryLabel: CATEGORY_LABELS.skills,
    description: 'How to design identity, narrative fields, lists, and metrics for the command card.',
    placeholders: [],
    format: 'markdown',
  },
  {
    key: 'skills.skill_file_author',
    label: 'Skill-file author skill',
    category: 'skills',
    categoryLabel: CATEGORY_LABELS.skills,
    description: 'How to write the generated agent operating manual (Markdown skill module).',
    placeholders: [],
    format: 'markdown',
  },
  {
    key: 'skills.visual_identity',
    label: 'Visual identity skill',
    category: 'skills',
    categoryLabel: CATEGORY_LABELS.skills,
    description: 'How to commission emblem, portrait, and icon subjects via generate_image.',
    placeholders: [],
    format: 'markdown',
  },
  {
    key: 'image.shared.white_bg',
    label: 'Shared · white background',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Background constraint for flat icon prompts.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.shared.fill_hint',
    label: 'Shared · glyph fill hint',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Size/fill guidance for HUD icon glyphs.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.icon.template',
    label: 'Icon · full prompt template',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Gemini prompt wrapper for index-card icons.',
    placeholders: ['{{white_bg}}', '{{fill_hint}}', '{{accent}}', '{{subject}}'],
    format: 'text',
  },
  {
    key: 'image.emblem.white_bg',
    label: 'Emblem · white background',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Background + framing for 3D emblem renders.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.emblem.winged_plaque',
    label: 'Emblem · winged plaque style',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'House style for C&C winged commander insignia.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.emblem.forbidden',
    label: 'Emblem · forbidden elements',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Negative constraints for emblem centerpieces.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.emblem.rank_wings_3',
    label: 'Emblem · rank wings (authority 3)',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Wing size copy when authority = 3.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.emblem.rank_wings_4',
    label: 'Emblem · rank wings (authority 4)',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Wing size copy when authority = 4.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.emblem.rank_wings_5',
    label: 'Emblem · rank wings (authority 5)',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Wing size copy when authority = 5.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.emblem.template',
    label: 'Emblem · full prompt template',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Gemini prompt wrapper for winged emblems.',
    placeholders: [
      '{{emblem_white_bg}}',
      '{{winged_plaque}}',
      '{{rank_wings}}',
      '{{accent}}',
      '{{subject}}',
      '{{emblem_forbidden}}',
    ],
    format: 'text',
  },
  {
    key: 'image.portrait.base',
    label: 'Portrait · base style',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'House style for commander portrait busts.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.portrait.rank_uniform_3',
    label: 'Portrait · uniform (authority 3)',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Uniform copy when authority = 3.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.portrait.rank_uniform_4',
    label: 'Portrait · uniform (authority 4)',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Uniform copy when authority = 4.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.portrait.rank_uniform_5',
    label: 'Portrait · uniform (authority 5)',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Uniform copy when authority = 5.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.portrait.template',
    label: 'Portrait · full prompt template',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Gemini prompt wrapper for commander portraits.',
    placeholders: ['{{portrait_base}}', '{{rank_uniform}}', '{{accent}}', '{{subject}}'],
    format: 'text',
  },
];

export const FORGE_PROMPT_KEYS = FORGE_PROMPT_DEFS.map((d) => d.key);

export function getPromptDef(key: ForgePromptKey): ForgePromptDef | undefined {
  return FORGE_PROMPT_DEFS.find((d) => d.key === key);
}

export function applyPromptTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : match,
  );
}

/** True when count is small enough for a tab strip instead of a dropdown. */
export const USE_PROMPT_TABS = FORGE_PROMPT_DEFS.length <= 8;
