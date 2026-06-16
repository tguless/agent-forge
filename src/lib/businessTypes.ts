/**
 * Types for the business blueprint layer: businesses, the app catalog +
 * controlled capacity vocabulary, the selected app stack, suggested roles,
 * and the per-agent SaaS access grid.
 */

export type BusinessStatus = 'queued' | 'consulting' | 'ready' | 'error';

/** One section of the structured business plan (each filled by its own consulting tool). */
export type BusinessPlanSectionKey =
  | 'executiveSummary'
  | 'problemAndSolution'
  | 'targetMarket'
  | 'revenueModel'
  | 'goToMarket'
  | 'operations'
  | 'yearOneMilestones'
  | 'risksAndMitigations';

export type BusinessPlanSections = Partial<Record<BusinessPlanSectionKey, string>>;

/** Per-competitor subsection (each filled by its own tool call). */
export type CompetitorSectionKey =
  | 'positioning'
  | 'offerings'
  | 'pricing'
  | 'strengths'
  | 'weaknesses'
  | 'ourEdge';

export type CompetitorSections = Partial<Record<CompetitorSectionKey, string>>;

export type Competitor = {
  /** Slug derived from name; stable id for subsection updates. */
  id: string;
  name: string;
  website?: string;
  /** One-line summary of who they are. */
  oneLiner?: string;
  sections: CompetitorSections;
  /** Source URLs gathered via web search. */
  sources: string[];
};

export type CompetitorAnalysis = {
  /** Markdown landscape overview of the competitive set. */
  landscape?: string;
  competitors: Competitor[];
};

/**
 * Advisory go/no-go verdict for the business idea. Ordered most → least
 * favorable. This is ALWAYS informational — it surfaces pros, cons, and risks
 * so the operator can decide; it never decides for them.
 */
export type ViabilityVerdict =
  | 'pursue'
  | 'pursue-conditional'
  | 'mixed'
  | 'high-risk'
  | 'reconsider';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type RiskSeverity = 'low' | 'medium' | 'high';

export type MarketRisk = {
  /** The risk, stated plainly. */
  risk: string;
  severity: RiskSeverity;
  /** Likelihood it materializes, if known. */
  likelihood?: RiskSeverity;
  /** Concrete mitigation or what to validate first. */
  mitigation?: string;
};

/**
 * Qualitative "is this worth pursuing?" assessment: sized market, demand
 * signals, timing, an explicit pros/cons/risks ledger, and an advisory verdict.
 */
export type MarketAssessment = {
  /** Sized market (TAM / SAM / SOM) with sourced figures — Markdown. */
  marketSize?: string;
  /** Evidence of real demand: search trends, hiring, funding, willingness to pay — Markdown. */
  demandSignals?: string;
  /** Why now: tailwinds, headwinds, regulatory or technology shifts — Markdown. */
  timing?: string;
  /** Reasons it could work. */
  pros?: string[];
  /** Reasons it might not. */
  cons?: string[];
  /** Enumerated risks with severity + mitigation. */
  risks?: MarketRisk[];
  /** Advisory verdict (never binding). */
  verdict?: ViabilityVerdict;
  /** How confident the assessment is, given evidence quality. */
  confidence?: ConfidenceLevel;
  /** One-line headline read, e.g. "Real, growing market — but crowded and capital-intensive." */
  headline?: string;
  /** Honest closing read; explicitly frames the decision as the operator's. Markdown. */
  recommendation?: string;
  /** Source URLs gathered via web search. */
  sources?: string[];
};

export type BusinessProfile = {
  industry?: string;
  businessModel?: string;
  summary?: string;
  valueChain?: string[];
  /** 30–45 second spoken pitch (~50–90 words). */
  elevatorPitch?: string;
  /** Structured plan sections (Markdown bodies, no headings — UI adds labels). */
  businessPlan?: BusinessPlanSections;
  /** Tavily-researched competitor landscape. */
  competitorAnalysis?: CompetitorAnalysis;
  /** Advisory market analysis + go/no-go viability verdict (Tavily-researched). */
  marketAssessment?: MarketAssessment;
  /** Gemini business identity plaque (riveted mount) — `/businesses/<slug>/plaque.png`. */
  plaquePath?: string;
  /** LLM-authored center-icon subject for regenerate-plaque. */
  plaqueSubject?: string;
};

export type Business = {
  slug: string;
  name: string;
  description: string;
  profile: BusinessProfile;
  status: BusinessStatus;
  isPlaceholder: boolean;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type BusinessSummary = {
  slug: string;
  name: string;
  description: string;
  status: BusinessStatus;
  isPlaceholder: boolean;
  roleCount: number;
  agentCount: number;
  appCount: number;
  updatedAt: number;
};

export type AppKind = 'saas' | 'oss';

export type Capacity = {
  key: string;
  label: string;
  description: string;
  sortOrder: number;
};

export type AppType = {
  key: string;
  label: string;
  description: string;
  /** Allowed capacity keys for this type (subset of the master superset). */
  capacities: string[];
};

export type App = {
  id: number;
  slug: string;
  name: string;
  appTypeKey: string;
  kind: AppKind;
  website?: string;
  description: string;
  isSeed: boolean;
};

/** A chosen app for a business, scoped to an app type, with the agent default + user override. */
export type BusinessApp = {
  id: number;
  businessSlug: string;
  appTypeKey: string;
  appId: number;
  isAgentDefault: boolean;
  isSelected: boolean;
  rationale: string;
  app: App;
};

export type BusinessRoleStatus = 'suggested' | 'forging' | 'forged' | 'dismissed';

/** A suggested agent-generation prompt (becomes a forge input). */
export type BusinessRole = {
  id: number;
  businessSlug: string;
  title: string;
  businessContext: string;
  jobDescription: string;
  authorityHint: number;
  rationale: string;
  status: BusinessRoleStatus;
  agentSlug?: string | null;
  createdAt: number;
};

/** One cell of the per-agent SaaS access grid: agent × app × capacity. */
export type AgentAppAccess = {
  id: number;
  agentSlug: string;
  appId: number;
  capacityKey: string;
  rationale: string;
  /** Hydrated for display. */
  app?: App;
  capacityLabel?: string;
  appTypeKey?: string;
};
