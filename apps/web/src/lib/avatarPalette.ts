const AVATAR_PALETTES: [string, string][] = [
  ["#7C3AED", "#A78BFA"],
  ["#0EA5E9", "#7DD3FC"],
  ["#F59E0B", "#FCD34D"],
  ["#10B981", "#6EE7B7"],
  ["#EC4899", "#F9A8D4"],
  ["#6366F1", "#A5B4FC"],
];

export function paletteFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}
