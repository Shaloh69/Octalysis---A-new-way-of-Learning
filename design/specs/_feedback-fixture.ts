import type { Page, Route } from "@playwright/test";
import type { FeedbackGroup, FeedbackQueue } from "@octa/contracts";

/**
 * `/feedback`, on the REAL seeded queue.
 *
 * `db/demo-seed.sql` seeds 11 reports: one question report five times (all
 * without an item or a variant: INV-25's offenders), one flag four times,
 * one CSAT twice. The API groups them (5, 4, 2). What the seed cannot hold
 * honestly:
 *
 *  - a question report WITH the variant its student saw. A variant is rebuilt
 *    from an attempt, and no paper can be filled while 0 items are live
 *    (NEXT-SESSION.md §0e.1), so no seeded attempt exists to rebuild from
 *  - SUS responses (the survey needs three sessions and a finished attempt)
 *  - a second page, for Load older (4 groups fit in one)
 *
 * So `variant`, `sus` and `older` patch those onto the real response, shaped
 * by the `FeedbackQueue` contract; every seeded group is as the API sent it.
 * **Every triage write is intercepted**: the spec never changes the shared
 * database (the API's own tests cover the write, `feedback.spec.ts`).
 */

export const FIX = {
  variantBody: "The answer key says 8 ns but my numbers give 6 ns: the hit time looks wrong.",
  stem: "A cache has a hit time of 2 ns, a miss penalty of 50 ns and a hit rate of 0.92. Find the average access time.",
  options: ["6 ns", "8 ns", "4 ns", "52 ns"],
  params: { hitTime: 2, missPenalty: 50, hitRate: 0.92 },
  slug: "04-amat-compute-2",
  reporter: "Mariel D. Abad",
  olderBody: "The stage 02 diagram of the von Neumann machine is cut off on my phone.",
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function variantGroup(): FeedbackGroup {
  return {
    key: "g:fixture-variant",
    status: "new",
    kind: "content_report",
    category: "broken",
    body: FIX.variantBody,
    severity: null,
    releasedIn: null,
    item: { id: "5c1e0a4e-0000-4000-8000-00000000f001", slug: FIX.slug },
    route: "/app/stage/04/check",
    count: 1,
    firstAt: hoursAgo(0.5),
    lastAt: hoursAgo(0.5),
    triagedBy: null,
    triagedAt: null,
    reports: [
      {
        id: "fb000000-0000-4000-8000-00000000f001",
        reporterName: FIX.reporter,
        role: "student",
        createdAt: hoursAgo(0.5),
        route: "/app/stage/04/check",
        appVersion: "0.9.3",
        category: "broken",
        rating: null,
        context: { viewport: "1440×900", userAgent: "Chrome 128 on Windows", lastApiError: null },
        resolvedVariant: { ordinal: 3, stem: FIX.stem, options: FIX.options, params: FIX.params },
      },
    ],
  };
}

function olderGroups(): FeedbackGroup[] {
  return [0, 1].map((i) => ({
    key: `g:fixture-older-${i}`,
    status: "new",
    kind: "flag",
    category: "broken",
    body: i === 0 ? FIX.olderBody : "The glossary link on stage 01 opens a blank page.",
    severity: null,
    releasedIn: null,
    item: null,
    route: i === 0 ? "/app/stage/02" : "/app/stage/01",
    count: 1,
    firstAt: hoursAgo(24 * 20 + i),
    lastAt: hoursAgo(24 * 20 + i),
    triagedBy: null,
    triagedAt: null,
    reports: [{
      id: `fb000000-0000-4000-8000-00000000e00${i}`,
      reporterName: "Jomar P. Villaflor",
      role: "student",
      createdAt: hoursAgo(24 * 20 + i),
      route: i === 0 ? "/app/stage/02" : "/app/stage/01",
      appVersion: "0.9.1",
      category: "broken",
      rating: null,
      context: {},
      resolvedVariant: null,
    }],
  }));
}

export const OLDER_CURSOR = "1.fixture-older";

export interface FixtureOpts {
  /** Patch in a question report with its variant, item and attached context. */
  variant?: boolean;
  /** Patch SUS: 6 student responses (below 20), none from staff. */
  sus?: boolean;
  /** Patch a second page behind Load older. */
  older?: boolean;
  delayMs?: number;
  /** Answer every read with this status. */
  status?: number;
  /** Refuse every triage with this status. */
  triageStatus?: number;
  /** Refuse the CSV with this status. */
  exportStatus?: number;
}

export async function useFixture(page: Page, opts: FixtureOpts = {}) {
  const reads: URL[] = [];
  const triages: Array<Record<string, unknown>> = [];
  const exports: URL[] = [];

  await page.route(/\/api\/v1\/console\/feedback\.csv/, async (route: Route) => {
    exports.push(new URL(route.request().url()));
    if (opts.exportStatus) {
      return route.fulfill({ status: opts.exportStatus, json: { error: { code: "bad_request", message: "More than 50,000 reports match, and an export holds that many at most. Filter by status or kind and export again." } } });
    }
    return route.continue();
  });

  await page.route(/\/api\/v1\/console\/feedback(\?|$)/, async (route: Route) => {
    const req = route.request();
    if (req.method() === "PATCH") {
      triages.push(req.postDataJSON() as Record<string, unknown>);
      if (opts.triageStatus) {
        return route.fulfill({ status: opts.triageStatus, json: { error: { code: "not_found", message: "One of those reports no longer exists. Nothing was changed; reload and try again." } } });
      }
      const ids = (req.postDataJSON() as { ids: string[] }).ids;
      return route.fulfill({ status: 200, json: { updated: ids.length } });
    }

    const url = new URL(req.url());
    reads.push(url);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.status) {
      return route.fulfill({ status: opts.status, json: { error: { code: "internal", message: "Something went wrong on our side." } } }).catch(() => undefined);
    }
    const older = url.searchParams.get("before") === OLDER_CURSOR;
    if (!older && !opts.variant && !opts.sus && !opts.older) return route.continue().catch(() => undefined);

    let res: Awaited<ReturnType<Route["fetch"]>>;
    try {
      // Load older's answer is built on the FIRST page's real totals, so both pages agree.
      const u = new URL(url);
      u.searchParams.delete("before");
      res = await route.fetch({ url: u.toString() });
    } catch (e) {
      if (/Test ended|closed|disposed/i.test(String(e))) return;
      throw e;
    }
    const json = patch((await res.json()) as FeedbackQueue, url, opts);
    const body = older ? { ...json, groups: olderGroups(), next: null } : json;
    return route.fulfill({ response: res, json: body }).catch((e: unknown) => {
      if (!/Test ended|closed|disposed/i.test(String(e))) throw e;
    });
  });

  return { reads, triages, exports };
}

/** The real first page, with the states the seed lacks, and every total recomputed to match. */
function patch(q: FeedbackQueue, url: URL, opts: FixtureOpts): FeedbackQueue {
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status");
  const variantFits = !!opts.variant && (!kind || kind === "content_report") && (!status || status === "new");
  const olderFits = !!opts.older && (!kind || kind === "flag") && (!status || status === "new");
  return {
    ...q,
    // Never slice a patched page back to its limit (§0k): the dropped real groups are ones Load older would never fetch.
    groups: variantFits ? [variantGroup(), ...q.groups] : q.groups,
    next: olderFits ? OLDER_CURSOR : q.next,
    total: {
      groups: q.total.groups + (variantFits ? 1 : 0) + (olderFits ? 2 : 0),
      reports: q.total.reports + (variantFits ? 1 : 0) + (olderFits ? 2 : 0),
    },
    counts: {
      ...q.counts,
      new: q.counts.new
        + (opts.variant && (!kind || kind === "content_report") ? 1 : 0)
        + (opts.older && (!kind || kind === "flag") ? 2 : 0),
    },
    sus: opts.sus ? { student: { n: 6, mean: 72.5 }, staff: { n: 0, mean: null } } : q.sus,
  };
}
