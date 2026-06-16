/** Stable ids for every LLM prompt the Forge can override. */
export type ForgePromptKey =
  | 'forge.system'
  | 'forge.user_template'
  | 'forge.example.system'
  | 'forge.example.user_template'
  | 'business.system'
  | 'business.user_template'
  | 'business.plan.system'
  | 'business.plan.user_template'
  | 'business.market.system'
  | 'business.market.user_template'
  | 'skills.agent_architect'
  | 'skills.skill_file_author'
  | 'skills.visual_identity'
  | 'skills.business_consultant'
  | 'skills.app_access'
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
  | 'image.portrait.template'
  | 'image.business.plaque_chroma_bg'
  | 'image.business.plaque_base'
  | 'image.business.plaque_forbidden'
  | 'image.business.plaque_template';

export type ForgePromptCategory = 'forge' | 'business' | 'skills' | 'image';

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
  business: 'Business Consultant (Anthropic)',
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
    key: 'forge.example.system',
    label: 'Generate example · system',
    category: 'forge',
    categoryLabel: CATEGORY_LABELS.forge,
    description:
      'System prompt for ad-hoc demo example generation on /new (Generate Example button). Model must return JSON only.',
    placeholders: [],
    format: 'markdown',
  },
  {
    key: 'forge.example.user_template',
    label: 'Generate example · user template',
    category: 'forge',
    categoryLabel: CATEGORY_LABELS.forge,
    description: 'User turn for example generation. {{themeInstruction}} expands to a theme hint or diversity constraint.',
    placeholders: ['{{themeInstruction}}'],
    format: 'markdown',
  },
  {
    key: 'business.system',
    label: 'Business consultant · system',
    category: 'business',
    categoryLabel: CATEGORY_LABELS.business,
    description:
      'System prompt for the multi-turn consulting agent. Designs roles + a SaaS/OSS app stack from a business description. The consultant skill is appended after this block.',
    placeholders: ['{{appTypes}}', '{{capacities}}', '{{visualNote}}'],
    format: 'markdown',
  },
  {
    key: 'business.user_template',
    label: 'Business consultant · user template',
    category: 'business',
    categoryLabel: CATEGORY_LABELS.business,
    description: 'First user turn sent when consulting on a business. {{businessSlug}} and {{businessDescription}} substitute at runtime.',
    placeholders: ['{{businessSlug}}', '{{businessName}}', '{{businessDescription}}'],
    format: 'markdown',
  },
  {
    key: 'business.plan.system',
    label: 'Business plan · system',
    category: 'business',
    categoryLabel: CATEGORY_LABELS.business,
    description:
      'System prompt for on-demand business-plan generation on an existing blueprint. Only the eight set_plan_* tools are available.',
    placeholders: [],
    format: 'markdown',
  },
  {
    key: 'business.plan.user_template',
    label: 'Business plan · user template',
    category: 'business',
    categoryLabel: CATEGORY_LABELS.business,
    description:
      'User turn for plan-only generation. Includes business description and any existing profile context.',
    placeholders: [
      '{{businessSlug}}',
      '{{businessName}}',
      '{{businessDescription}}',
      '{{profileContext}}',
    ],
    format: 'markdown',
  },
  {
    key: 'business.market.system',
    label: 'Market assessment · system',
    category: 'business',
    categoryLabel: CATEGORY_LABELS.business,
    description:
      'System prompt for the on-demand market analysis + advisory viability verdict. Tavily research + market/demand/timing/risk/verdict tools.',
    placeholders: [],
    format: 'markdown',
  },
  {
    key: 'business.market.user_template',
    label: 'Market assessment · user template',
    category: 'business',
    categoryLabel: CATEGORY_LABELS.business,
    description:
      'User turn for the market assessment run. Includes business description and any existing profile/plan context.',
    placeholders: [
      '{{businessSlug}}',
      '{{businessName}}',
      '{{businessDescription}}',
      '{{profileContext}}',
    ],
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
    key: 'skills.business_consultant',
    label: 'Business consultant skill',
    category: 'skills',
    categoryLabel: CATEGORY_LABELS.skills,
    description: 'How to profile a business, write pitch & plan, suggest agent roles, and recommend a SaaS/OSS app stack.',
    placeholders: [],
    format: 'markdown',
  },
  {
    key: 'skills.app_access',
    label: 'App access (least privilege) skill',
    category: 'skills',
    categoryLabel: CATEGORY_LABELS.skills,
    description: 'How to populate the per-agent SaaS access grid (which apps, at what capacity) using least privilege.',
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
  {
    key: 'image.business.plaque_chroma_bg',
    label: 'Business plaque · chroma key background',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Solid magenta #FF00FF behind plaque for chroma removal (not white — preserves silver metal).',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.business.plaque_base',
    label: 'Business plaque · riveted mount style',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Square riveted metal business identity plaque (not winged commander badge).',
    placeholders: ['{{accent}}'],
    format: 'text',
  },
  {
    key: 'image.business.plaque_forbidden',
    label: 'Business plaque · forbidden elements',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Negative constraints for sector plaques.',
    placeholders: [],
    format: 'text',
  },
  {
    key: 'image.business.plaque_template',
    label: 'Business plaque · full prompt template',
    category: 'image',
    categoryLabel: CATEGORY_LABELS.image,
    description: 'Gemini prompt wrapper for business sector plaques.',
    placeholders: [
      '{{plaque_chroma_bg}}',
      '{{business_plaque_base}}',
      '{{business_plaque_forbidden}}',
      '{{business_name}}',
      '{{business_context}}',
      '{{accent}}',
      '{{subject}}',
    ],
    format: 'text',
  },
];

export const FORGE_PROMPT_KEYS = FORGE_PROMPT_DEFS.map((d) => d.key);

/** Agent icon/emblem/portrait image prompts — white-key pipeline in imagePipeline.ts */
export const AGENT_IMAGE_PROMPT_KEYS = FORGE_PROMPT_KEYS.filter(
  (k) => k.startsWith('image.') && !k.startsWith('image.business.'),
);

/** Business sector plaque prompts — magenta chroma pipeline in generateBusinessPlaque() */
export const BUSINESS_PLAQUE_PROMPT_KEYS = FORGE_PROMPT_KEYS.filter((k) => k.startsWith('image.business.'));

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
