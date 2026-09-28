import type { Page, Route } from "@playwright/test";
import type { InvariantRun, SystemAudit } from "@octa/contracts";
import { presentInvariant } from "../../services/api/src/audit/invariants.ts";

/**
 * `/system`, on the REAL run of `run_invariants()`.
 *
 * The seeded demo already has four checks with offenders, all real and all
 * warnings: INV-18 (the Prelim and Midterm cannot be filled: 0 live items),
 * INV-25 (5 reports without their variant), INV-27 (9 stages missing their
 * archetype's block) and INV-29 (12 competency cells unreachable, so its
 * sample is cut: "5 of 12"). What the seed cannot show:
 *
 *  - a FAILING check. Nothing in the demo breaks a `fail` rule, and it must
 *    not: `/students`, `/items` and the rest read the same database
 *  - a NOTICE. Under the 28 Sep ruling a notice needs an empty table, and the
 *    demo has items, blocks and objectives
 *  - a NIGHTLY RUN. `audit_runs` is written by pg_cron, which a local database
 *    does not have
 *
 * So `failing`, `notice` and `runs` patch those onto the real response. The
 * notice is built by the API's own `presentInvariant()`, so its wording is the
 * API's, not a copy. Everything else, 24 checks and their samples, is as the
 * API sent it.
 */

export const FAILING = {
  id: "INV-15",
  rows: [
    { item_id: "5c1e0a4e-0000-4000-8000-00000000a015", slug: "01-arch-vs-org-3" },
    { item_id: "5c1e0a4e-0000-4000-8000-00000000b015", slug: "02-cpi-mips-2" },
  ],
};

/** INV-28, as the API presents it when there are no objectives at all. */
export function noticeResult() {
  return presentInvariant(
    { id: "INV-28", name: "inv_28_objectives_tagged", severity: "fail", offending_count: "18",
      sample: [{ stage_id: "01", objective_id: null, problem: "stage has no objectives" }] },
    { items: false, contentBlocks: false, objectives: true },
  );
}

const daysAgo = (d: number, h = 18, m = 30) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(h, m, 0, 0);
  return t.toISOString();
};

/** Fourteen nights: the newest found INV-15 failing; the rest only the warnings. */
export function nightlyRuns(): InvariantRun[] {
  return Array.from({ length: 14 }, (_, i) => ({
    id: String(900 - i),
    startedAt: daysAgo(i + 1),
    finishedAt: daysAgo(i + 1, 18, 30),
    triggeredBy: "cron",
    failing: i === 0 ? ["INV-15"] : [],
    warning: i < 3 ? ["INV-18", "INV-25", "INV-27", "INV-29"] : ["INV-18", "INV-27", "INV-29"],
    checks: 28,
  }));
}

export interface FixtureOpts {
  /** Patch INV-15 into a failing check with two rows. */
  failing?: boolean;
  /** Patch INV-28 into a notice, as the API words one. */
  notice?: boolean;
  /** Patch in fourteen nightly runs. */
  runs?: boolean;
  /** Delay every read. */
  delayMs?: number;
  /** Answer every read with this status. */
  status?: number;
  /** Answer the SECOND and later reads with this status (a failed Run again). */
  rerunStatus?: number;
  /** Delay the second and later reads (Run again in flight). */
  rerunDelayMs?: number;
}

export async function useFixture(page: Page, opts: FixtureOpts = {}) {
  const reads: number[] = [];

  await page.route(/\/api\/v1\/console\/audit\/system(\?|$)/, async (route: Route) => {
    reads.push(Date.now());
    const later = reads.length > 1;
    const wait = later && opts.rerunDelayMs ? opts.rerunDelayMs : opts.delayMs;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const status = later && opts.rerunStatus ? opts.rerunStatus : opts.status;
    if (status) {
      return route
        .fulfill({ status, json: { error: { code: "internal", message: "Something went wrong on our side." } } })
        .catch(() => undefined);
    }
    if (!opts.failing && !opts.notice && !opts.runs) return route.continue().catch(() => undefined);

    let res: Awaited<ReturnType<Route["fetch"]>>;
    try {
      res = await route.fetch();
    } catch (e) {
      if (/Test ended|closed|disposed/i.test(String(e))) return;
      throw e;
    }
    const body = (await res.json()) as SystemAudit;
    const results = body.results.map((r) => {
      if (opts.failing && r.id === FAILING.id) {
        return { ...r, severity: "fail" as const, offendingCount: FAILING.rows.length, sample: FAILING.rows };
      }
      if (opts.notice && r.id === "INV-28") return noticeResult();
      return r;
    });
    const json: SystemAudit = {
      ...body,
      results,
      failing: results.filter((r) => r.severity === "fail" && r.offendingCount > 0).length,
      runs: opts.runs ? nightlyRuns() : body.runs,
    };
    return route.fulfill({ response: res, json }).catch((e: unknown) => {
      if (!/Test ended|closed|disposed/i.test(String(e))) throw e;
    });
  });

  return { reads };
}
