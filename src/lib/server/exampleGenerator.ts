import { generateObject } from 'ai';
import { z } from 'zod';
import { getPromptContent } from '@/lib/forgeConfigStore';
import { applyPromptTemplate } from '@/lib/forgePrompts';
import {
  createLanguageModel,
  runWithLlmCandidates,
  sdkMaxRetries,
} from '@/lib/agent/textModel';

export type GeneratedForgeExample = {
  businessContext: string;
  jobDescription: string;
  titleHint: string;
};

const exampleSchema = z.object({
  businessContext: z.string(),
  jobDescription: z.string(),
  titleHint: z.string().optional(),
});

const BUILTIN_THEMES =
  'commercial real estate lease abstraction, AP invoice automation, and healthcare prior auth intake';

function buildThemeInstruction(theme?: string): string {
  const trimmed = theme?.trim();
  if (trimmed) {
    return `Theme hint from the user: ${trimmed}\nStay grounded in that domain but still invent a specific company and workflow.`;
  }
  return `Pick a creative industry and document-intelligence use case we have NOT used before. Avoid these built-in examples: ${BUILTIN_THEMES}.`;
}

function parseExamplePayload(raw: z.infer<typeof exampleSchema>): GeneratedForgeExample {
  const businessContext = raw.businessContext.trim();
  const jobDescription = raw.jobDescription.trim();
  const titleHint = (raw.titleHint ?? '').trim();
  if (!businessContext || !jobDescription) {
    throw new Error('Generated example missing businessContext or jobDescription.');
  }
  return {
    businessContext,
    jobDescription,
    titleHint: titleHint || 'Custom Agent',
  };
}

/** Ad-hoc forge-form example via configured text LLM (configurable prompts). */
export async function generateForgeExample(theme?: string): Promise<GeneratedForgeExample> {
  const system = getPromptContent('forge.example.system');
  const user = applyPromptTemplate(getPromptContent('forge.example.user_template'), {
    themeInstruction: buildThemeInstruction(theme),
  });

  const { result } = await runWithLlmCandidates({ role: 'author', label: 'forge example' }, async (candidate) => {
    const { object } = await generateObject({
      model: createLanguageModel(candidate.provider, candidate.modelId),
      schema: exampleSchema,
      system,
      prompt: user,
      maxOutputTokens: 1200,
      maxRetries: sdkMaxRetries(candidate.provider),
    });
    return parseExamplePayload(object);
  });

  return result;
}
