import { patchAgentData, setSkillMarkdown, addEvent, getAgent } from '@/lib/agentStore';
import { generateAgentImage, type ImageKind } from './imagePipeline';
import type { AgentMetric } from '@/lib/types';

/** Anthropic tool schema (subset we use). */
export type ToolDef = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const strArray = { type: 'array', items: { type: 'string' } };

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'set_identity',
    description:
      'Set the core identity of the agent. Call this FIRST. accent must be a hex color. authority is 3 (IC/field officer), 4 (leader/VP), or 5 (executive).',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Role as an Agent, e.g. "AP Automation Agent"' },
        subtitle: { type: 'string', description: '2-4 word command tag' },
        department: { type: 'string' },
        accent: { type: 'string', description: 'Hex color, e.g. #38bdf8' },
        authority: { type: 'integer', enum: [3, 4, 5] },
        callsign: { type: 'string', description: 'One uppercase word' },
        alignment: { type: 'string' },
        role: { type: 'string' },
        scope: { type: 'string' },
        focus: { type: 'string' },
        escalation: { type: 'string' },
      },
      required: ['title', 'subtitle', 'department', 'accent', 'authority'],
    },
  },
  {
    name: 'set_narrative',
    description: 'Set the narrative fields: mission, quote, motto, and the single most important near-term objective.',
    input_schema: {
      type: 'object',
      properties: {
        mission: { type: 'string' },
        quote: { type: 'string' },
        motto: { type: 'string' },
        q1Objective: { type: 'string', description: 'The single most important near-term outcome' },
      },
      required: ['mission', 'q1Objective'],
    },
  },
  {
    name: 'set_lists',
    description: 'Set all the list/array fields for the command card and detail page.',
    input_schema: {
      type: 'object',
      properties: {
        successCriteria: strArray,
        deliverables: { type: 'array', items: { type: 'string' }, description: 'Artifact filenames, lowercase-kebab .md' },
        primaryObjectives: strArray,
        responsibilities: strArray,
        inputs: strArray,
        outputs: strArray,
        decisionFramework: { type: 'array', items: { type: 'string' }, description: 'Ordered yes/no gating questions' },
        escalateWhen: strArray,
      },
      required: ['successCriteria', 'deliverables', 'primaryObjectives', 'responsibilities'],
    },
  },
  {
    name: 'set_metrics',
    description: 'Set 5-7 key metrics. Each has a label, a target value string, and a progress estimate 0-100.',
    input_schema: {
      type: 'object',
      properties: {
        keyMetrics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string', description: 'Target, e.g. ">30%" or "<90 days"' },
              progress: { type: 'integer', description: '0-100 current progress estimate' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['keyMetrics'],
    },
  },
  {
    name: 'write_skill_file',
    description:
      'Write the full Markdown skill file (the agent operating manual, 180-320 lines, GFM with tables). Follow the skill-file-author skill structure.',
    input_schema: {
      type: 'object',
      properties: { markdown: { type: 'string' } },
      required: ['markdown'],
    },
  },
  {
    name: 'generate_image',
    description:
      'Generate one visual asset. kind: "icon" (flat HUD glyph), "emblem" (3D winged badge center symbol), or "portrait" (cosplay commander bust). subject describes only the symbol/persona; the backend applies house style. Pass the agent accent and authority.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['icon', 'emblem', 'portrait'] },
        subject: { type: 'string' },
        accent: { type: 'string', description: 'Hex color' },
        authority: { type: 'integer', enum: [3, 4, 5] },
      },
      required: ['kind', 'subject', 'accent'],
    },
  },
  {
    name: 'finalize',
    description: 'Call once after all fields, the skill file, and all three images are set. Marks the agent complete.',
    input_schema: { type: 'object', properties: {} },
  },
];

export type ToolResult = { content: string; isError?: boolean };

/** Execute a tool call against the store / image pipeline. */
export async function runTool(slug: string, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  const agent = getAgent(slug);
  if (!agent) return { content: `Agent ${slug} not found`, isError: true };

  switch (name) {
    case 'set_identity': {
      patchAgentData(slug, {
        title: String(input.title ?? ''),
        subtitle: String(input.subtitle ?? ''),
        department: String(input.department ?? ''),
        accent: String(input.accent ?? '#38bdf8'),
        authority: Number(input.authority ?? 3),
        callsign: input.callsign ? String(input.callsign) : undefined,
        alignment: input.alignment ? String(input.alignment) : undefined,
        role: input.role ? String(input.role) : undefined,
        scope: input.scope ? String(input.scope) : undefined,
        focus: input.focus ? String(input.focus) : undefined,
        escalation: input.escalation ? String(input.escalation) : undefined,
      });
      addEvent(slug, 'tool', `Identity set: ${input.title} (${input.callsign ?? 'no callsign'})`);
      return { content: 'Identity saved.' };
    }
    case 'set_narrative': {
      patchAgentData(slug, {
        mission: input.mission ? String(input.mission) : undefined,
        quote: input.quote ? String(input.quote) : undefined,
        motto: input.motto ? String(input.motto) : undefined,
        q1Objective: String(input.q1Objective ?? ''),
      });
      addEvent(slug, 'tool', 'Narrative set (mission, quote, motto, objective).');
      return { content: 'Narrative saved.' };
    }
    case 'set_lists': {
      const arr = (k: string): string[] =>
        Array.isArray(input[k]) ? (input[k] as unknown[]).map((x) => String(x)) : [];
      patchAgentData(slug, {
        successCriteria: arr('successCriteria'),
        deliverables: arr('deliverables'),
        primaryObjectives: arr('primaryObjectives'),
        responsibilities: arr('responsibilities'),
        inputs: arr('inputs'),
        outputs: arr('outputs'),
        decisionFramework: arr('decisionFramework'),
        escalateWhen: arr('escalateWhen'),
      });
      addEvent(slug, 'tool', 'Lists set (objectives, responsibilities, I/O, framework).');
      return { content: 'Lists saved.' };
    }
    case 'set_metrics': {
      const raw = Array.isArray(input.keyMetrics) ? (input.keyMetrics as Record<string, unknown>[]) : [];
      const keyMetrics: AgentMetric[] = raw.map((m) => ({
        label: String(m.label ?? ''),
        value: String(m.value ?? ''),
        progress: m.progress != null ? Math.max(0, Math.min(100, Number(m.progress))) : undefined,
      }));
      patchAgentData(slug, { keyMetrics });
      addEvent(slug, 'tool', `Metrics set (${keyMetrics.length}).`);
      return { content: 'Metrics saved.' };
    }
    case 'write_skill_file': {
      const markdown = String(input.markdown ?? '');
      setSkillMarkdown(slug, markdown);
      patchAgentData(slug, { skillsFile: `${slug}.skills.md` });
      addEvent(slug, 'tool', `Skill file written (${markdown.split('\n').length} lines).`);
      return { content: `Skill file saved (${markdown.length} chars).` };
    }
    case 'generate_image': {
      const kind = String(input.kind) as ImageKind;
      addEvent(slug, 'image', `Generating ${kind}…`);
      const result = await generateAgentImage({
        slug,
        kind,
        subject: String(input.subject ?? ''),
        accent: String(input.accent ?? agent.data.accent ?? '#38bdf8'),
        authority: input.authority ? Number(input.authority) : agent.data.authority,
      });
      const field = kind === 'icon' ? 'iconPath' : kind === 'emblem' ? 'emblemPath' : 'portraitPath';
      patchAgentData(slug, { [field]: result.webPath } as Record<string, string>);
      addEvent(
        slug,
        result.generated ? 'image' : 'warn',
        `${kind}: ${result.generated ? 'generated' : 'placeholder'}${result.notes.length ? ` — ${result.notes.join(' ')}` : ''}`,
      );
      return { content: `${kind} ${result.generated ? 'generated' : 'placeholder created'} at ${result.webPath}.` };
    }
    case 'finalize': {
      addEvent(slug, 'tool', 'Agent finalized.');
      return { content: 'Finalized.' };
    }
    default:
      return { content: `Unknown tool: ${name}`, isError: true };
  }
}
