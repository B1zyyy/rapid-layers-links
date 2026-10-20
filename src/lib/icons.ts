// Icons a store entry may reference via its "icon" field.
// To support a new platform icon: add its key here and its SVG in src/components/PlatformIcon.astro.
export const ICON_KEYS = ['website', 'line', 'facebook', 'pdf', 'link'] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export function isIconKey(value: string): value is IconKey {
  return (ICON_KEYS as readonly string[]).includes(value);
}
