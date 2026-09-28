import {
  FEEDBACK_STATUS_LABELS,
  FeedbackKind,
  FeedbackStatus,
  type FeedbackReport,
  type FeedbackSeverity,
} from "@octa/contracts";

/**
 * `/feedback`'s words and the address it lives in, kept out of the JSX so they
 * can be tested. See `design/templates/console/feedback/SPEC.md`.
 */

export interface FeedbackFilters {
  status: FeedbackStatus | null;
  kind: FeedbackKind | null;
}

/** What the address says, keeping only what it understands. */
export function readFilters(p: URLSearchParams): FeedbackFilters {
  const status = FeedbackStatus.safeParse(p.get("status"));
  const kind = FeedbackKind.safeParse(p.get("kind"));
  return { status: status.success ? status.data : null, kind: kind.success ? kind.data : null };
}

export function apiParams(f: FeedbackFilters, before?: string | null): URLSearchParams {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.kind) p.set("kind", f.kind);
  if (before) p.set("before", before);
  return p;
}

export const STATUS_ORDER: readonly FeedbackStatus[] = FeedbackStatus.options;
export const SEVERITIES: readonly FeedbackSeverity[] = ["low", "medium", "high"];
export const SEVERITY_WORD: Readonly<Record<FeedbackSeverity, string>> = { low: "Low", medium: "Medium", high: "High" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

/** "28 Sep 2026", local, built by hand: ICU writes "Sept" (NEXT-SESSION.md §0e.5). */
export function day(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "28 Sep 2026, 16:40": a report is evidence, so it carries its time. */
export function when(iso: string): string {
  const d = new Date(iso);
  return `${day(iso)}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export interface Variant {
  stem: string | null;
  options: string[];
  params: Array<[string, string]>;
}

/** The instance a question report was about, read defensively: it is stored JSON. */
export function variantOf(v: unknown): Variant | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { stem?: unknown; options?: unknown; params?: unknown };
  const stem = typeof o.stem === "string" && o.stem.trim() ? o.stem : null;
  const options = Array.isArray(o.options) ? o.options.map((x) => String(x)) : [];
  const params =
    o.params && typeof o.params === "object"
      ? Object.entries(o.params as Record<string, unknown>).map(([k, val]) => [k, String(val)] as [string, string])
      : [];
  if (!stem && options.length === 0 && params.length === 0) return null;
  return { stem, options, params };
}

/** What the client attached, key by key (PAGE-SPECS.md §4.1: show exactly what is attached). */
export function attached(r: FeedbackReport): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (r.route) out.push(["route", r.route]);
  if (r.appVersion) out.push(["app version", r.appVersion]);
  for (const [k, v] of Object.entries(r.context)) {
    if (v === null || v === undefined || v === "") continue;
    out.push([k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
  }
  return out;
}

export const letter = (i: number) => String.fromCharCode(65 + i);

export function ratingWords(rating: number | null): string | null {
  return rating === null ? null : `Rated ${rating} of 5`;
}

/** The toast after Save: what happened to how many. */
export function triageToast(
  n: number,
  status: FeedbackStatus,
  severity: FeedbackSeverity | null | undefined,
  releasedIn: string | null | undefined,
): { title: string; body?: string } {
  const who = n === 1 ? "Report" : `${n} reports`;
  const title = `${who} moved to ${FEEDBACK_STATUS_LABELS[status].toLowerCase()}`;
  const extras: string[] = [];
  if (severity !== undefined) extras.push(severity ? `Severity ${severity}.` : "Severity cleared.");
  if (releasedIn) extras.push(`Released in ${releasedIn}.`);
  return extras.length ? { title, body: extras.join(" ") } : { title };
}

/** "5 responses", "1 response". */
export const responses = (n: number) => `${n} ${n === 1 ? "response" : "responses"}`;

/** PAGE-SPECS.md §4.3: aim for 20 before trusting an average. */
export const SUS_RELIABLE_N = 20;
export const SUS_BENCHMARK = 68;
