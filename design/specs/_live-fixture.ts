import type { Page, Route } from "@playwright/test";
import type { LiveOptions, LiveSession, LiveSnapshot } from "@octa/contracts";

/**
 * `/live` and `/live/present`, on the REAL seeded room.
 *
 * The demo seed gives the page real stages 01-07, 21 students each, and 0
 * people working. What it cannot hold honestly:
 *
 *  - a question running. A question needs a LIVE item and all 96 act-1 items
 *    are at review (NEXT-SESSION.md §0e.1); and nothing can answer one, because
 *    the student half (`/app/live`) is not built
 *  - a stage with fewer than five students (every seeded stage has 21)
 *  - people working (no paper can be filled while 0 items are live)
 *
 * So the fixture patches those onto the real response, shaped by the
 * `LiveSnapshot` contract; every seeded stage is as the API sent it. The
 * "live items" the Start dialog offers are REAL items from `GET /console/items`
 * (their real slugs, stages and objective wording), offered as if approved:
 * nothing about a question is invented here. **Every write is intercepted**:
 * the spec never starts a session in the shared database (`live.spec.ts`
 * covers the write, against the API).
 */

export const MIN = 5;

export interface LiveFixtureOpts {
  /** Patch a question running, with this many answers (correct withheld below 5). */
  session?: { answered: number; correct: number; section?: string | null };
  /** Patch stage 08 in with this many students (withheld below 5). */
  smallStage?: number;
  /** Patch people working now. */
  cohort?: number;
  /** Offer real review items as live ones, this many at most. */
  liveItems?: number;
  /** Health: reports in the last 20 minutes. */
  reports?: number;
  delayMs?: number;
  /** Answer every snapshot read with this status. */
  status?: number;
  /** Answer the first read, then fail every later one (the stale state). */
  failAfterFirst?: boolean;
  /** Refuse a Start with this status and sentence. */
  startRefusal?: { status: number; message: string };
}

type Item = LiveOptions["items"][number];

export async function useLiveFixture(page: Page, opts: LiveFixtureOpts = {}) {
  const reads: number[] = [];
  const starts: Array<Record<string, unknown>> = [];
  const ends: Array<{ id: string; body: Record<string, unknown> }> = [];
  let offered: Item[] = [];
  let sections: LiveOptions["sections"] = [];
  let running: LiveSession | null = null;
  let seeded = false;

  const swallow = (e: unknown) => {
    if (!/Test ended|closed|disposed/i.test(String(e))) throw e;
  };

  function sessionFrom(item: Item, answered: number, correct: number, section: string | null): LiveSession {
    return {
      id: "5e551010-0000-4000-8000-00000000f001",
      itemSlug: item.slug,
      itemType: item.type,
      stageId: item.stageId,
      stageTitle: item.stageTitle,
      objective: item.objective,
      section,
      startedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
      answered,
      correct: answered < MIN ? null : correct,
    };
  }

  /** Real review items, and stage titles from the real snapshot. */
  async function loadOffered(route: Route) {
    if (offered.length || !opts.liveItems) return;
    const base = new URL(route.request().url()).origin;
    const [itemsRes, snapRes, optsRes] = await Promise.all([
      route.fetch({ url: `${base}/api/v1/console/items`, method: "GET" }),
      route.fetch({ url: `${base}/api/v1/console/live`, method: "GET" }),
      route.fetch({ url: `${base}/api/v1/console/live/options`, method: "GET" }),
    ]);
    const all = ((await itemsRes.json()) as { items: Array<{ id: string; slug: string; type: Item["type"]; stageId: string; objectiveText: string | null; status: string }> }).items;
    const titles = new Map(((await snapRes.json()) as LiveSnapshot).stages.map((s) => [s.stageId, s.title]));
    sections = ((await optsRes.json()) as LiveOptions).sections;
    offered = all
      .filter((i) => i.status === "review" && titles.has(i.stageId))
      .sort((a, b) => a.stageId.localeCompare(b.stageId) || a.slug.localeCompare(b.slug))
      .slice(0, opts.liveItems)
      .map((i) => ({
        id: i.id, slug: i.slug, type: i.type, stageId: i.stageId,
        stageTitle: titles.get(i.stageId)!, objective: i.objectiveText,
      }));
  }

  await page.route(/\/api\/v1\/console\/live\/options/, async (route: Route) => {
    try {
      if (!opts.liveItems) return await route.continue();
      await loadOffered(route);
      return await route.fulfill({ status: 200, json: { items: offered, sections } satisfies LiveOptions });
    } catch (e) {
      swallow(e);
    }
  });

  await page.route(/\/api\/v1\/console\/live\/sessions(\/[^/]+\/end)?$/, async (route: Route) => {
    const req = route.request();
    const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    const endMatch = /sessions\/([^/]+)\/end$/.exec(req.url());
    if (endMatch) {
      ends.push({ id: endMatch[1]!, body });
      running = null;
      return route.fulfill({ status: 200, json: { ok: true, endedAt: new Date().toISOString() } }).catch(swallow);
    }
    starts.push(body);
    if (opts.startRefusal) {
      return route
        .fulfill({ status: opts.startRefusal.status, json: { error: { code: "conflict", message: opts.startRefusal.message } } })
        .catch(swallow);
    }
    const item = offered.find((i) => i.id === body.itemId);
    const code = sections.find((s) => s.id === body.sectionId)?.code ?? null;
    running = item ? sessionFrom(item, 0, 0, code) : null;
    return route.fulfill({ status: 201, json: { session: running } }).catch(swallow);
  });

  await page.route(/\/api\/v1\/console\/live\/health/, async (route: Route) => {
    if (opts.reports === undefined) return route.continue().catch(swallow);
    return route
      .fulfill({ status: 200, json: { inProgress: opts.cohort ?? 0, submittedRecently: 3, reportsRecently: opts.reports } })
      .catch(swallow);
  });

  await page.route(/\/api\/v1\/console\/live(\?|$)/, async (route: Route) => {
    reads.push(Date.now());
    try {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.status || (opts.failAfterFirst && reads.length > 1)) {
        return await route.fulfill({
          status: opts.status ?? 500,
          json: { error: { code: "internal", message: "Something went wrong on our side. Try again." } },
        });
      }
      const res = await route.fetch();
      const snap = (await res.json()) as LiveSnapshot;

      if (opts.session && !seeded) {
        await loadOffered(route);
        const item = offered[0];
        if (item) running = sessionFrom(item, opts.session.answered, opts.session.correct, opts.session.section ?? null);
        seeded = true;
      }
      const stages = [...snap.stages];
      if (opts.smallStage !== undefined) {
        stages.push({ stageId: "08", title: "Operating System Support", students: opts.smallStage, avgMastery: opts.smallStage < MIN ? null : 71 });
      }
      const json: LiveSnapshot = {
        ...snap,
        cohort: opts.cohort ?? snap.cohort,
        stages,
        session: running ?? snap.session,
      };
      return await route.fulfill({ response: res, json });
    } catch (e) {
      swallow(e);
    }
  });

  return { reads, starts, ends, offered: () => offered };
}
