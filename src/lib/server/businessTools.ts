/**
 * Business-consulting agent tools (Vercel AI SDK `tool()` + Zod).
 * Each execute writes to SQLite via the threaded business slug.
 */
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { patchBusinessProfile, addRole, addBusinessApp } from '@/lib/businessStore';
import { upsertApp, ensureCapacity, appTypeExists } from '@/lib/catalogStore';

export type BusinessToolContext = {
  businessSlug: string;
};

export function createBusinessTools(ctx: BusinessToolContext): ToolSet {
  return {
    set_business_profile: tool({
      description:
        'Capture the business profile. Call once near the start. valueChain is 4–7 ordered stages from input to delivered value.',
      inputSchema: z.object({
        industry: z.string().describe('Sector in plain language'),
        businessModel: z.string().describe('How the business makes money'),
        summary: z.string().describe('2–3 sentence operator-grade summary'),
        valueChain: z.array(z.string()).optional().describe('Ordered value-chain stages'),
      }),
      execute: async (input) => {
        patchBusinessProfile(ctx.businessSlug, {
          industry: input.industry,
          businessModel: input.businessModel,
          summary: input.summary,
          valueChain: input.valueChain ?? [],
        });
        return `Profile saved: ${input.industry} · ${input.businessModel}.`;
      },
    }),

    recommend_app: tool({
      description:
        'Recommend one app for an app TYPE. Mark isDefault=true for the single best pick per type; add alternatives with isDefault=false. Offer both a SaaS and an OSS option per type where possible.',
      inputSchema: z.object({
        appType: z.string().describe('App type key, e.g. crm, accounting, esign, storage, email'),
        name: z.string(),
        kind: z.enum(['saas', 'oss']),
        website: z.string().optional(),
        description: z.string().optional(),
        isDefault: z.boolean().optional(),
        rationale: z.string().optional(),
      }),
      execute: async (input) => {
        const newType = !appTypeExists(input.appType);
        const app = upsertApp({
          name: input.name,
          appTypeKey: input.appType,
          kind: input.kind,
          website: input.website,
          description: input.description,
        });
        addBusinessApp({
          businessSlug: ctx.businessSlug,
          appId: app.id,
          appTypeKey: app.appTypeKey,
          isDefault: input.isDefault,
          rationale: input.rationale,
        });
        return `${input.isDefault ? 'Default' : 'Alternative'} for ${app.appTypeKey}: ${app.name} (${input.kind})${newType ? ' [new type]' : ''}.`;
      },
    }),

    suggest_role: tool({
      description:
        'Suggest one agent role to run the business. Each role is a forge prompt (businessContext + jobDescription). authorityHint: 3=IC, 4=leader, 5=executive.',
      inputSchema: z.object({
        title: z.string().describe('Role title, e.g. "AP Automation Agent"'),
        businessContext: z.string().describe('2–3 sentences framing the business for this role'),
        jobDescription: z.string().describe('Recurring tasks, escalation bar, artifacts produced'),
        authorityHint: z.number().int().min(3).max(5).optional(),
        rationale: z.string().optional(),
      }),
      execute: async (input) => {
        const role = addRole({
          businessSlug: ctx.businessSlug,
          title: input.title,
          businessContext: input.businessContext,
          jobDescription: input.jobDescription,
          authorityHint: input.authorityHint,
          rationale: input.rationale,
        });
        return `Role suggested: ${role.title} (authority ${role.authorityHint}).`;
      },
    }),

    define_capacity: tool({
      description:
        'OPTIONAL: add a new access capacity to the controlled vocabulary when no existing capacity fits. appTypes lists which app types it applies to.',
      inputSchema: z.object({
        key: z.string().describe('snake_case key, e.g. "reconcile"'),
        label: z.string(),
        description: z.string().optional(),
        appTypes: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        const cap = ensureCapacity({
          key: input.key,
          label: input.label,
          description: input.description,
          appTypeKeys: input.appTypes,
        });
        return `Capacity ensured: ${cap.key} (${cap.label}).`;
      },
    }),

    finalize_blueprint: tool({
      description: 'Call once after the profile, app stack, and roles are recorded. Marks the blueprint complete.',
      inputSchema: z.object({}),
      execute: async () => ({ completed: true }),
    }),
  };
}
