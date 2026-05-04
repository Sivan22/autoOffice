import { describe, expect, it } from 'vitest';
import { formatTokens, formatUsd } from './cost.ts';

describe('formatUsd', () => {
  it('uses 4 fractional digits below $1', () => {
    expect(formatUsd(0)).toBe('$0.0000');
    expect(formatUsd(0.123)).toBe('$0.1230');
    expect(formatUsd(0.99999)).toBe('$1.0000');
  });

  it('uses 2 fractional digits at or above $1', () => {
    expect(formatUsd(1)).toBe('$1.00');
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatUsd(123.456)).toBe('$123.46');
  });

  it('handles negative amounts symmetrically', () => {
    expect(formatUsd(-0.5)).toBe('$-0.5000');
    expect(formatUsd(-5)).toBe('$-5.00');
  });

  it('returns $0.00 for non-finite values', () => {
    expect(formatUsd(Number.NaN)).toBe('$0.00');
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('$0.00');
    expect(formatUsd(Number.NEGATIVE_INFINITY)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('shows raw count under 1000', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(999)).toBe('999');
  });

  it('uses K with one decimal under 10K, no decimals under 1M', () => {
    expect(formatTokens(1000)).toBe('1.0K');
    expect(formatTokens(1500)).toBe('1.5K');
    expect(formatTokens(9999)).toBe('10.0K');
    expect(formatTokens(15_000)).toBe('15K');
    expect(formatTokens(999_999)).toBe('1000K');
  });

  it('uses M with two decimals at and above 1M', () => {
    expect(formatTokens(1_000_000)).toBe('1.00M');
    expect(formatTokens(1_500_000)).toBe('1.50M');
  });
});
