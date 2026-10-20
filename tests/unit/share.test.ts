import { describe, expect, it, vi } from 'vitest';
import { copyText, shareLink } from '../../src/scripts/share.ts';

const abortError = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });

describe('copyText', () => {
  it('uses the Clipboard API when it works', async () => {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const legacyCopy = vi.fn();
    expect(await copyText('https://lin.ee/x', { writeClipboard, legacyCopy })).toBe(true);
    expect(writeClipboard).toHaveBeenCalledWith('https://lin.ee/x');
    expect(legacyCopy).not.toHaveBeenCalled();
  });

  it('falls back to the legacy method when the Clipboard API is refused', async () => {
    const writeClipboard = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    const legacyCopy = vi.fn().mockReturnValue(true);
    expect(await copyText('u', { writeClipboard, legacyCopy })).toBe(true);
    expect(legacyCopy).toHaveBeenCalled();
  });

  it('reports failure when every method fails — never a false success', async () => {
    expect(await copyText('u', { writeClipboard: vi.fn().mockRejectedValue(new Error()), legacyCopy: () => false })).toBe(false);
    expect(await copyText('u', { legacyCopy: () => { throw new Error('blocked'); } })).toBe(false);
    expect(await copyText('u', {})).toBe(false);
  });
});

describe('shareLink', () => {
  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeClipboard = vi.fn();
    expect(await shareLink('LINE Official', 'https://lin.ee/x', { share, writeClipboard })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'LINE Official', url: 'https://lin.ee/x' });
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it('treats closing the share sheet as a cancel, not an error', async () => {
    expect(await shareLink('t', 'u', { share: vi.fn().mockRejectedValue(abortError()) })).toBe('cancelled');
  });

  it('reports a failed share', async () => {
    expect(await shareLink('t', 'u', { share: vi.fn().mockRejectedValue(new Error('NotAllowedError')) })).toBe('share-failed');
  });

  it('copies the link instead when Web Share is not supported', async () => {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink('t', 'https://x.example.com', { writeClipboard })).toBe('copied-instead');
    expect(writeClipboard).toHaveBeenCalledWith('https://x.example.com');
  });

  it('reports copy-failed when there is no Web Share and copying fails', async () => {
    expect(await shareLink('t', 'u', { legacyCopy: () => false })).toBe('copy-failed');
  });
});
