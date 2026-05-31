/**
 * Dynamic, DB-driven port of the PaperIQ "operations agent" shapes.
 * Unlike the source repo (15 hard-coded agents), every field here is produced
 * at generation time by the LLM agent and stored in SQLite.
 */

export type AgentStatus = 'queued' | 'generating' | 'complete' | 'error';

export type AgentMetric = {
  label: string;
  value: string;
  /** 0–100 progress bar */
  progress?: number;
};

/** Visual assets, served from /agents/<slug>/<file>.png */
export type AgentAssets = {
  iconPath?: string;
  emblemPath?: string;
  portraitPath?: string;
};

/** Everything the command card + detail page render. */
export type AgentData = {
  slug: string;
  title: string;
  subtitle: string;
  department: string;
  accent: string;
  authority: number; // 3–5 (drives emblem wings / portrait rank)

  // index card
  q1Objective: string;
  successCriteria: string[];
  deliverables: string[];
  skillsFile: string;

  // hero / identity
  callsign?: string;
  alignment?: string;
  role?: string;
  scope?: string;
  focus?: string;
  escalation?: string;
  quote?: string;
  motto?: string;

  // body sections
  mission?: string;
  primaryObjectives?: string[];
  responsibilities?: string[];
  keyMetrics?: AgentMetric[];
  inputs?: string[];
  outputs?: string[];
  decisionFramework?: string[];
  escalateWhen?: string[];

  // assets
  iconPath?: string;
  emblemPath?: string;
  portraitPath?: string;
};

export type AgentRecord = {
  slug: string;
  title: string;
  status: AgentStatus;
  data: AgentData;
  skillMarkdown: string;
  businessContext: string;
  jobDescription: string;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
};

/** Lightweight row for the index grid. */
export type AgentSummary = {
  slug: string;
  title: string;
  subtitle: string;
  department: string;
  accent: string;
  status: AgentStatus;
  q1Objective: string;
  successCriteria: string[];
  deliverables: string[];
  skillsFile: string;
  iconPath?: string;
  authority: number;
  updatedAt: number;
};

export type GenerationEvent = {
  id: number;
  slug: string;
  ts: number;
  type: 'info' | 'tool' | 'image' | 'warn' | 'error' | 'done';
  message: string;
};
