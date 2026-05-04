export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '$0.00';
  const abs = Math.abs(usd);
  const fractionDigits = abs >= 1 ? 2 : 4;
  return `$${usd.toFixed(fractionDigits)}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
