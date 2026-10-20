// Share / copy logic for the store action sheet. Kept free of DOM queries so it can be unit tested.

export type ShareOutcome =
  | 'shared' // native share sheet completed
  | 'cancelled' // user closed the native share sheet
  | 'copied-instead' // no Web Share support, link copied
  | 'share-failed' // Web Share threw; nothing was shared
  | 'copy-failed'; // no Web Share and copying failed

export interface ShareEnvironment {
  share?: (data: ShareData) => Promise<void>;
  writeClipboard?: (text: string) => Promise<void>;
  /** Legacy copy from a selected text field (document.execCommand('copy')). Returns success. */
  legacyCopy?: () => boolean;
}

/** Copies text, trying the Clipboard API first and the legacy method second. Resolves to true only on real success. */
export async function copyText(text: string, env: ShareEnvironment): Promise<boolean> {
  if (env.writeClipboard) {
    try {
      await env.writeClipboard(text);
      return true;
    } catch {
      // fall through to the legacy method (e.g. permission denied in an in-app browser)
    }
  }
  if (env.legacyCopy) {
    try {
      return env.legacyCopy();
    } catch {
      return false;
    }
  }
  return false;
}

/** Opens the native share sheet when available; otherwise copies the link. */
export async function shareLink(title: string, url: string, env: ShareEnvironment): Promise<ShareOutcome> {
  if (env.share) {
    try {
      await env.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      return 'share-failed';
    }
  }
  return (await copyText(url, env)) ? 'copied-instead' : 'copy-failed';
}

/** Builds the environment from the real browser APIs. */
export function browserShareEnvironment(field: HTMLInputElement): ShareEnvironment {
  const nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    share: nav && typeof nav.share === 'function' ? (data) => nav.share(data) : undefined,
    writeClipboard:
      nav?.clipboard && window.isSecureContext ? (text) => nav.clipboard.writeText(text) : undefined,
    legacyCopy: () => {
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
      return document.execCommand('copy');
    },
  };
}
