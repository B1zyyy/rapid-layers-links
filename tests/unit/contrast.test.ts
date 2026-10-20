// WCAG 2.2 AA contrast checks for the colour tokens in src/styles/tokens.css.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`token --${name} not found`);
  return match[1];
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5; // normal text
const UI = 3; // focus ring, icons, component boundaries

describe('colour contrast (WCAG 2.2 AA)', () => {
  it.each([
    ['ink on bg', 'color-ink', 'color-bg', TEXT],
    ['ink on surface', 'color-ink', 'color-surface', TEXT],
    ['ink on deep bg (icon tiles, buttons)', 'color-ink', 'color-bg-deep', TEXT],
    ['muted text on surface', 'color-ink-muted', 'color-surface', TEXT],
    ['muted text on bg', 'color-ink-muted', 'color-bg', TEXT],
    ['orange text (tagline) on bg', 'color-accent-ink', 'color-bg', TEXT],
    ['ink on orange (primary button)', 'color-ink', 'color-accent', TEXT],
    ['success message on surface', 'color-success', 'color-surface', TEXT],
    ['error message on surface', 'color-error', 'color-surface', TEXT],
    ['focus ring / card border against page', 'color-ink', 'color-bg', UI],
    ['Facebook icon on white tile', 'color-facebook', 'color-surface', UI],
  ])('%s', (_label, fg, bg, minimum) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(minimum);
  });

  it('white LINE glyph on LINE green is a non-text graphic that stays recognisable', () => {
    // LINE's official icon is white on #06C755 (~2.1:1). It is decorative here — the card text names
    // the platform — so the 3:1 non-text rule does not apply, but guard against an accidental change.
    expect(token('color-line').toLowerCase()).toBe('#06c755');
  });
});
