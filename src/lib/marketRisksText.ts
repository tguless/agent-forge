/**
 * Serialize / parse market risks for the unified text-section editor.
 * One risk per block separated by `---`.
 */
import type { MarketRisk, RiskSeverity } from '@/lib/businessTypes';
import { RISK_SEVERITIES } from '@/lib/marketAssessment';

const SEP = '\n---\n';

export function marketRisksToText(risks: MarketRisk[]): string {
  if (!risks.length) return '';
  return risks
    .map((r) => {
      const lines = [
        `severity: ${r.severity}`,
        r.likelihood ? `likelihood: ${r.likelihood}` : '',
        `risk: ${r.risk}`,
        r.mitigation ? `mitigation: ${r.mitigation}` : '',
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join(SEP);
}

function parseSeverity(value: string | undefined): RiskSeverity {
  const v = value?.trim().toLowerCase();
  if (v && RISK_SEVERITIES.includes(v as RiskSeverity)) return v as RiskSeverity;
  return 'medium';
}

export function textToMarketRisks(text: string): MarketRisk[] {
  const blocks = text
    .split(/^---$/m)
    .map((b) => b.trim())
    .filter(Boolean);

  const risks: MarketRisk[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    let severity: RiskSeverity = 'medium';
    let likelihood: RiskSeverity | undefined;
    let risk = '';
    let mitigation = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^(severity|likelihood|risk|mitigation):\s*(.*)$/i);
      if (!match) {
        if (!risk) risk = trimmed;
        continue;
      }
      const [, key, value] = match;
      const val = value.trim();
      switch (key.toLowerCase()) {
        case 'severity':
          severity = parseSeverity(val);
          break;
        case 'likelihood':
          likelihood = parseSeverity(val);
          break;
        case 'risk':
          risk = val;
          break;
        case 'mitigation':
          mitigation = val;
          break;
        default:
          break;
      }
    }

    if (risk.trim()) {
      risks.push({
        risk: risk.trim(),
        severity,
        likelihood,
        mitigation: mitigation.trim() || undefined,
      });
    }
  }

  return risks;
}

export const MARKET_RISKS_EDIT_HINT =
  'One risk per block. Separate blocks with a line containing only ---. Fields: severity, likelihood (optional), risk, mitigation (optional).';
