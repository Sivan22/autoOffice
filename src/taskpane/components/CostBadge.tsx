import React from 'react';
import {
  makeStyles,
  tokens,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Text,
} from '@fluentui/react-components';
import { type CallCost, PRICING_VERSION } from '../agent/pricing.ts';
import { formatTokens, formatUsd } from '../lib/cost.ts';
import { useTranslation } from '../i18n/index.ts';

const useStyles = makeStyles({
  badge: { cursor: 'pointer' },
  surface: { padding: '12px 14px', minWidth: '220px' },
  table: { width: '100%', fontSize: '12px', borderCollapse: 'collapse' },
  label: { color: tokens.colorNeutralForeground3, paddingRight: '12px' },
  num: { textAlign: 'end', fontFamily: tokens.fontFamilyMonospace, whiteSpace: 'nowrap' },
  total: { fontWeight: 600, paddingTop: '4px', borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  footer: { marginTop: '8px', fontSize: '11px', color: tokens.colorNeutralForeground3 },
});

interface Row { labelKey: 'cost.input' | 'cost.cachedRead' | 'cost.cacheWrite' | 'cost.output';
                tokens: number; usd: number }

export function CostBadge({ cost }: { cost: CallCost | undefined }) {
  const styles = useStyles();
  const { t } = useTranslation();
  if (!cost || (cost.totalUsd === 0 && cost.tokens.input === 0 && cost.tokens.output === 0
                                     && cost.tokens.cachedRead === 0 && cost.tokens.cacheWrite === 0)) {
    return null;
  }

  const compact = cost.source === 'tokens-only'
    ? `${formatTokens(cost.tokens.input + cost.tokens.cachedRead + cost.tokens.cacheWrite + cost.tokens.output)} tok`
    : formatUsd(cost.totalUsd);

  const rows: Row[] = (
    [
      { labelKey: 'cost.input'      as const, tokens: cost.tokens.input,      usd: cost.inputUsd },
      { labelKey: 'cost.cachedRead' as const, tokens: cost.tokens.cachedRead, usd: cost.cachedReadUsd },
      { labelKey: 'cost.cacheWrite' as const, tokens: cost.tokens.cacheWrite, usd: cost.cacheWriteUsd },
      { labelKey: 'cost.output'     as const, tokens: cost.tokens.output,     usd: cost.outputUsd },
    ] satisfies Row[]
  ).filter(r => r.tokens > 0 || r.usd > 0);

  const sourceLabel =
    cost.source === 'gateway-exact'    ? t('cost.sourceGatewayExact') :
    cost.source === 'openrouter-exact' ? t('cost.sourceOpenRouterExact') :
    cost.source === 'tokens-only'      ? t('cost.sourceTokensOnly') :
                                         t('cost.sourceEstimated', { version: PRICING_VERSION });

  return (
    <Popover withArrow positioning="below-end">
      <PopoverTrigger disableButtonEnhancement>
        <Badge appearance="outline" size="small" color="informative" className={styles.badge}>
          {compact}
        </Badge>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface}>
        <Text weight="semibold" size={200}>{t('cost.title')}</Text>
        <table className={styles.table} style={{ marginTop: '6px' }}>
          <tbody>
            {rows.map(r => (
              <tr key={r.labelKey}>
                <td className={styles.label}>{t(r.labelKey)}</td>
                <td className={styles.num}>{r.tokens > 0 ? `${formatTokens(r.tokens)} tok` : ''}</td>
                <td className={styles.num} style={{ paddingLeft: '12px' }}>
                  {cost.source === 'tokens-only' ? '' : formatUsd(r.usd)}
                </td>
              </tr>
            ))}
            {cost.source !== 'tokens-only' && (
              <tr>
                <td className={`${styles.label} ${styles.total}`}>{t('cost.total')}</td>
                <td className={`${styles.num} ${styles.total}`} />
                <td className={`${styles.num} ${styles.total}`} style={{ paddingLeft: '12px' }}>
                  {formatUsd(cost.totalUsd)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className={styles.footer}>{sourceLabel}</div>
      </PopoverSurface>
    </Popover>
  );
}
