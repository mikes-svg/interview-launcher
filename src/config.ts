/**
 * Runtime config — all values read from Vite env vars at build time.
 *
 * Required:
 *   VITE_VAPI_PUBLIC_KEY     — Vapi public/web key
 *   VITE_VAPI_ASSISTANT_ID   — default assistant ID (used when ?position is missing/unknown)
 *
 * Optional:
 *   VITE_INTERVIEWER_NAME    — name shown in the speaking indicator (default: "Alex")
 *   VITE_COMPANY_NAME        — shown in the heading (default: "Screening Interview")
 *   VITE_POSITIONS           — JSON array of additional positions, see Position type below.
 *                              Each entry: { slug, label, assistantId }. The default assistant
 *                              from VITE_VAPI_ASSISTANT_ID is always available under slug "default".
 */

export type Position = {
  slug: string;
  label: string;
  assistantId: string;
};

const DEFAULT_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID ?? '';

function parsePositions(): Position[] {
  const raw = import.meta.env.VITE_POSITIONS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Position =>
        p && typeof p.slug === 'string' && typeof p.label === 'string' && typeof p.assistantId === 'string'
    );
  } catch (err) {
    console.warn('VITE_POSITIONS is not valid JSON:', err);
    return [];
  }
}

const extraPositions = parsePositions();

export const POSITIONS: Position[] = [
  {
    slug: 'default',
    label: 'Screening Interview',
    assistantId: DEFAULT_ASSISTANT_ID,
  },
  ...extraPositions,
];

export function resolvePosition(slug: string | null | undefined): Position {
  if (slug) {
    const match = POSITIONS.find((p) => p.slug === slug);
    if (match) return match;
  }
  return POSITIONS[0];
}

export const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY ?? '';
export const INTERVIEWER_NAME = import.meta.env.VITE_INTERVIEWER_NAME ?? 'Alex';
export const COMPANY_NAME = import.meta.env.VITE_COMPANY_NAME ?? 'Screening Interview';
