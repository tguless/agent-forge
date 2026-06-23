/**
 * Shared AI rewrite handler for editable blueprint sections.
 */
import { NextResponse } from 'next/server';
import { stepCountIs, ToolLoopAgent } from 'ai';
import { getBusiness } from '@/lib/businessStore';
import {
  buildEditableRewriteContext,
  resolveEditableSection,
  writeEditableSection,
} from '@/lib/server/editableSectionService';
import {
  createSectionRewriteSearchTool,
  createReplaceSectionTool,
} from '@/lib/server/sectionRewriteTools';
import { appendTextSectionVersion } from '@/lib/server/textSectionVersionHistory';
import {
  createLanguageModel,
  runWithLlmCandidates,
  sdkMaxRetries,
  textLlmConfigError,
  textLlmConfigured,
} from '@/lib/agent/textModel';

export async function runSectionRewrite(slug: string, path: string[], instructions: string) {
  const section = resolveEditableSection(slug, path);
  if (!section) return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
  if (!section.canRewrite) {
    return NextResponse.json({ error: 'This section does not support AI rewrite' }, { status: 400 });
  }
  if (!section.content.trim()) {
    return NextResponse.json({ error: 'Section has no content to rewrite yet' }, { status: 400 });
  }

  const business = getBusiness(slug);
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!instructions.trim()) {
    return NextResponse.json({ error: 'instructions is required' }, { status: 400 });
  }

  if (!textLlmConfigured()) {
    return NextResponse.json({ error: textLlmConfigError() }, { status: 503 });
  }

  const blueprintContext = buildEditableRewriteContext(business, path);
  const pathLabel = path.join('/');

  const kindHint =
    section.kind === 'bullets' ? 'Output one bullet per line (- item).'
    : section.kind === 'lines' ? 'Output one value-chain stage per line.'
    : section.kind === 'plain' ? 'Output plain text only — no markdown headings.'
    : 'Output markdown body only — no ## section heading (the UI renders the title).';

  const systemInstructions = [
    `You are a business blueprint editor improving "${section.label}" for "${business.name}".`,
    '',
    'You MUST call replace_section_content to apply your edits. Do not only describe changes in prose.',
    'Keep tone operator-grade: concrete, specific to this business.',
    'Preserve facts and strategy from the blueprint unless the user explicitly asks to change them.',
    'When the user asks for fresh market data, competitors, pricing, or citations, use tavily_search first, then weave findings into the rewrite with source URLs where appropriate.',
    kindHint,
    section.rewriteHint ? `Section note: ${section.rewriteHint}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = [
    '# Full business blueprint for context',
    blueprintContext,
    '\n\n---\n\n# Your task',
    `Edit section "${section.label}" (path: ${pathLabel}).`,
    `\nUser instructions: ${instructions.trim()}`,
    `\nCurrent section text:\n\n${section.content}`,
  ].join('\n');

  let rewrittenContent: string | null = null;
  let changeSummary: string | null = null;

  const rewriteTools = {
    ...createSectionRewriteSearchTool(),
    ...createReplaceSectionTool((content, summary) => {
      rewrittenContent = content;
      changeSummary = summary;
    }),
  };

  try {
    const { result, candidate } = await runWithLlmCandidates(
      { role: 'author', label: 'section-rewrite' },
      async (candidate) => {
        const agent = new ToolLoopAgent({
          model: createLanguageModel(candidate.provider, candidate.modelId),
          instructions: systemInstructions,
          tools: rewriteTools,
          stopWhen: stepCountIs(8),
          maxOutputTokens: 8000,
          maxRetries: sdkMaxRetries(candidate.provider),
        });

        const agentResult = await agent.generate({ prompt: userPrompt });
        const agentText = agentResult.text ?? '';

        if (!rewrittenContent) {
          throw new Error(
            agentText.trim()
              ? `AI did not call replace_section_content. Response: ${agentText.slice(0, 200)}`
              : 'AI did not produce an edit',
          );
        }

        return { content: rewrittenContent, summary: changeSummary ?? undefined, agentText };
      },
    );

    writeEditableSection(slug, path, result.content);
    const version = appendTextSectionVersion(slug, path, {
      content: result.content,
      source: 'ai_rewrite',
      userInstructions: instructions.trim(),
      llmModel: candidate.modelId,
      changeSummary: result.summary,
    });

    return NextResponse.json({
      ok: true,
      version: version.version,
      content: result.content,
      changeSummary: result.summary ?? null,
      provider: candidate.label,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[section-rewrite] failed:', pathLabel, msg, err);
    return NextResponse.json({ error: `Rewrite failed: ${msg.slice(0, 400)}` }, { status: 502 });
  }
}
