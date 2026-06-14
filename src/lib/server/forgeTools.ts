/**
 * Forge agent tools (Vercel AI SDK `tool()` + Zod) — the migrated equivalent of
 * the former hand-rolled JSON tool defs in tools.ts. Adds set_app_access to
 * populate the per-agent SaaS access grid from the business's selected stack.
 *
 * addEvent(...) calls are preserved so the existing generation_events polling UI
 * keeps working alongside the new agent_turns timeline.
 */
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { patchAgentData, setSkillMarkdown, addEvent, getAgent } from '@/lib/agentStore';
import { selectedBusinessApps } from '@/lib/businessStore';
import { grantAccess, clearAgentAccess } from '@/lib/accessStore';
import { generateAgentImage, type ImageKind } from './imagePipeline';
import type { AgentMetric } from '@/lib/types';

export type ForgeToolContext = {
  agentSlug: string;
  businessSlug: string | null;
};

export function createForgeTools(ctx: ForgeToolContext): ToolSet {
  const slug = ctx.agentSlug;

  return {
    set_identity: tool({
      description:
        'Set the core identity of the agent. Call this FIRST. accent must be a hex color. authority is 3 (IC/field officer), 4 (leader/VP), or 5 (executive).',
      inputSchema: z.object({
        title: z.string().describe('Role as an Agent, e.g. "AP Automation Agent"'),
        subtitle: z.string().describe('2-4 word command tag'),
        department: z.string(),
        accent: z.string().describe('Hex color, e.g. #38bdf8'),
        authority: z.union([z.literal(3), z.literal(4), z.literal(5)]),
        callsign: z.string().optional().describe('One uppercase word'),
        alignment: z.string().optional(),
        role: z.string().optional(),
        scope: z.string().optional(),
        focus: z.string().optional(),
        escalation: z.string().optional(),
      }),
      execute: async (input) => {
        patchAgentData(slug, {
          title: input.title,
          subtitle: input.subtitle,
          department: input.department,
          accent: input.accent || '#38bdf8',
          authority: input.authority,
          callsign: input.callsign,
          alignment: input.alignment,
          role: input.role,
          scope: input.scope,
          focus: input.focus,
          escalation: input.escalation,
        });
        addEvent(slug, 'tool', `Identity set: ${input.title} (${input.callsign ?? 'no callsign'})`);
        return 'Identity saved.';
      },
    }),

    set_narrative: tool({
      description: 'Set the narrative fields: mission, quote, motto, and the single most important near-term objective.',
      inputSchema: z.object({
        mission: z.string(),
        quote: z.string().optional(),
        motto: z.string().optional(),
        q1Objective: z.string().describe('The single most important near-term outcome'),
      }),
      execute: async (input) => {
        patchAgentData(slug, {
          mission: input.mission,
          quote: input.quote,
          motto: input.motto,
          q1Objective: input.q1Objective,
        });
        addEvent(slug, 'tool', 'Narrative set (mission, quote, motto, objective).');
        return 'Narrative saved.';
      },
    }),

    set_lists: tool({
      description: 'Set all the list/array fields for the command card and detail page.',
      inputSchema: z.object({
        successCriteria: z.array(z.string()),
        deliverables: z.array(z.string()).describe('Artifact filenames, lowercase-kebab .md'),
        primaryObjectives: z.array(z.string()),
        responsibilities: z.array(z.string()),
        inputs: z.array(z.string()).optional(),
        outputs: z.array(z.string()).optional(),
        decisionFramework: z.array(z.string()).optional().describe('Ordered yes/no gating questions'),
        escalateWhen: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        patchAgentData(slug, {
          successCriteria: input.successCriteria,
          deliverables: input.deliverables,
          primaryObjectives: input.primaryObjectives,
          responsibilities: input.responsibilities,
          inputs: input.inputs ?? [],
          outputs: input.outputs ?? [],
          decisionFramework: input.decisionFramework ?? [],
          escalateWhen: input.escalateWhen ?? [],
        });
        addEvent(slug, 'tool', 'Lists set (objectives, responsibilities, I/O, framework).');
        return 'Lists saved.';
      },
    }),

    set_metrics: tool({
      description: 'Set 5-7 key metrics. Each has a label, a target value string, and a progress estimate 0-100.',
      inputSchema: z.object({
        keyMetrics: z.array(
          z.object({
            label: z.string(),
            value: z.string().describe('Target, e.g. ">30%" or "<90 days"'),
            progress: z.number().int().optional().describe('0-100 current progress estimate'),
          }),
        ),
      }),
      execute: async (input) => {
        const keyMetrics: AgentMetric[] = input.keyMetrics.map((m) => ({
          label: m.label,
          value: m.value,
          progress: m.progress != null ? Math.max(0, Math.min(100, m.progress)) : undefined,
        }));
        patchAgentData(slug, { keyMetrics });
        addEvent(slug, 'tool', `Metrics set (${keyMetrics.length}).`);
        return 'Metrics saved.';
      },
    }),

    set_app_access: tool({
      description:
        'Populate the per-agent SaaS access grid. items = which apps from the business stack this agent needs, each at a least-privilege capacity. Only apps in the SELECTED APP STACK are valid; capacities must be valid for the app type. Call after set_lists, before finalize.',
      inputSchema: z.object({
        items: z.array(
          z.object({
            app: z.string().describe('App name or slug from the selected stack'),
            capacity: z.string().describe('A controlled capacity key valid for the app type'),
            rationale: z.string().optional(),
          }),
        ),
      }),
      execute: async (input) => {
        if (!ctx.businessSlug) {
          return 'No business is attached to this agent; access grid skipped.';
        }
        const stack = selectedBusinessApps(ctx.businessSlug);
        if (stack.length === 0) {
          return 'The business has no selected apps yet; access grid skipped.';
        }
        const byKey = new Map<string, number>();
        for (const ba of stack) {
          byKey.set(ba.app.slug.toLowerCase(), ba.appId);
          byKey.set(ba.app.name.toLowerCase(), ba.appId);
        }

        clearAgentAccess(slug);
        const granted: string[] = [];
        const errors: string[] = [];
        for (const item of input.items) {
          const appId = byKey.get(item.app.trim().toLowerCase());
          if (!appId) {
            errors.push(`"${item.app}" is not in the selected stack`);
            continue;
          }
          const res = grantAccess({ agentSlug: slug, appId, capacityKey: item.capacity, rationale: item.rationale });
          if (res.ok) granted.push(`${item.app}:${item.capacity}`);
          else errors.push(res.error);
        }

        const available = stack.map((b) => `${b.app.name} [${b.appTypeKey}]`).join(', ');
        addEvent(slug, 'tool', `Access grid: ${granted.length} grant(s)${errors.length ? `, ${errors.length} rejected` : ''}.`);
        let msg = `Granted ${granted.length}: ${granted.join(', ') || '(none)'}.`;
        if (errors.length) msg += ` Rejected: ${errors.join('; ')}. Available apps: ${available}.`;
        return msg;
      },
    }),

    write_skill_file: tool({
      description:
        'Write the full Markdown skill file (the agent operating manual, 180-320 lines, GFM with tables). Follow the skill-file-author skill structure.',
      inputSchema: z.object({ markdown: z.string() }),
      execute: async (input) => {
        setSkillMarkdown(slug, input.markdown);
        patchAgentData(slug, { skillsFile: `${slug}.skills.md` });
        addEvent(slug, 'tool', `Skill file written (${input.markdown.split('\n').length} lines).`);
        return `Skill file saved (${input.markdown.length} chars).`;
      },
    }),

    generate_image: tool({
      description:
        'Generate one visual asset. kind: "icon" (flat HUD glyph), "emblem" (ONE polished metal center sculpture inside a winged C&C badge — different subject from the icon), or "portrait" (commander bust). Pass three different subject strings across the three calls. Backend applies house style.',
      inputSchema: z.object({
        kind: z.enum(['icon', 'emblem', 'portrait']),
        subject: z.string(),
        accent: z.string().describe('Hex color'),
        authority: z.union([z.literal(3), z.literal(4), z.literal(5)]).optional(),
      }),
      execute: async (input) => {
        const agent = getAgent(slug);
        const kind = input.kind as ImageKind;
        addEvent(slug, 'image', `Generating ${kind}…`);
        const result = await generateAgentImage({
          slug,
          kind,
          subject: input.subject,
          accent: input.accent || agent?.data.accent || '#38bdf8',
          authority: input.authority ?? agent?.data.authority,
        });
        const field = kind === 'icon' ? 'iconPath' : kind === 'emblem' ? 'emblemPath' : 'portraitPath';
        const subjectField = kind === 'icon' ? 'iconSubject' : kind === 'emblem' ? 'emblemSubject' : 'portraitSubject';
        patchAgentData(slug, {
          [field]: result.webPath,
          [subjectField]: input.subject,
        } as Record<string, string>);
        addEvent(
          slug,
          result.generated ? 'image' : 'warn',
          `${kind}: ${result.generated ? 'generated' : 'placeholder'}${result.notes.length ? ` — ${result.notes.join(' ')}` : ''}`,
        );
        return `${kind} ${result.generated ? 'generated' : 'placeholder created'} at ${result.webPath}.`;
      },
    }),

    finalize: tool({
      description: 'Call once after all fields, the skill file, the access grid (if a business is attached), and all three images are set. Marks the agent complete.',
      inputSchema: z.object({}),
      execute: async () => {
        addEvent(slug, 'tool', 'Agent finalized.');
        return { completed: true };
      },
    }),
  };
}
