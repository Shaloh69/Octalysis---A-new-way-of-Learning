import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { Biome } from "@octa/contracts";
import {
  realmFor,
  applyRealm,
  FALLBACK_BIOME,
  PLANET_BIOMES_KEY,
  type Realm,
} from "../src/lib/realm";

/**
 * WEB-REMAKE.md §1: the realm is decided once, from the route, and a deep link
 * into a planet paints its biome on the first frame. These hold the pure
 * function to the route table, and hold index.html's pre-paint script (which
 * must run before any bundle, so it cannot import this module) to the SAME
 * table, so the two can never disagree about which realm a path is in.
 */

const BIOMES = { "00": "jungle", "04": "desert", "06": "cave" } as const;

const TABLE: Array<[string, Realm]> = [
  ["/app", { realm: "star" }],
  ["/app/", { realm: "star" }],
  ["/app/map", { realm: "star" }],
  ["/app/map?stage=04", { realm: "star" }],
  ["/app/stages", { realm: "star" }],
  ["/app/progress", { realm: "star" }],
  ["/app/work", { realm: "star" }],
  ["/app/settings", { realm: "star" }],
  ["/login", { realm: "star" }],
  ["/register", { realm: "star" }],
  ["/maintenance", { realm: "star" }],
  ["/", { realm: "star" }],
  ["/no-such-page", { realm: "star" }],
  ["/app/stagesX", { realm: "star" }],
  ["/app/stage/00", { realm: "biome", planet: "00", biome: "jungle" }],
  ["/app/stage/04", { realm: "biome", planet: "04", biome: "desert" }],
  ["/app/stage/04/check", { realm: "biome", planet: "04", biome: "desert" }],
  ["/app/stage/06/labs/cache", { realm: "biome", planet: "06", biome: "cave" }],
  // A moon wears its planet's biome.
  ["/app/stage/06.3", { realm: "biome", planet: "06", biome: "cave" }],
  // A planet whose biome is not known yet: the realm is still right.
  ["/app/stage/11", { realm: "biome", planet: "11", biome: FALLBACK_BIOME }],
];

describe("realmFor — the route decides the realm", () => {
  for (const [path, want] of TABLE) {
    it(`${path} -> ${want.realm}${want.realm === "biome" ? ` (${want.biome})` : ""}`, () => {
      expect(realmFor(path.split("?")[0]!, BIOMES)).toEqual(want);
    });
  }

  it("a star route never carries a biome, whatever the cosmetics say", () => {
    for (const path of ["/app", "/app/map", "/app/stages", "/login"]) {
      expect(realmFor(path, BIOMES)).toEqual({ realm: "star" });
    }
  });

  it("ignores a biome name the contract does not know", () => {
    expect(realmFor("/app/stage/00", { "00": "volcanic" })).toEqual({
      realm: "biome",
      planet: "00",
      biome: FALLBACK_BIOME,
    });
  });

  it("is pure: the same inputs give the same realm", () => {
    expect(realmFor("/app/stage/04/check", BIOMES)).toEqual(realmFor("/app/stage/04/check", BIOMES));
  });
});

/** A tiny stand-in for <html>, enough for setAttribute/removeAttribute. */
function fakeHtml(): { attrs: Map<string, string>; el: HTMLElement } {
  const attrs = new Map<string, string>();
  const el = {
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    removeAttribute: (k: string) => attrs.delete(k),
    getAttribute: (k: string) => attrs.get(k) ?? null,
  } as unknown as HTMLElement;
  return { attrs, el };
}

describe("applyRealm — what lands on <html>", () => {
  it("writes data-realm and data-biome inside a planet", () => {
    const { attrs, el } = fakeHtml();
    applyRealm(el, realmFor("/app/stage/04", BIOMES));
    expect(Object.fromEntries(attrs)).toEqual({ "data-realm": "biome", "data-biome": "desert" });
  });

  it("removes data-biome on the way back to the star system", () => {
    const { attrs, el } = fakeHtml();
    applyRealm(el, realmFor("/app/stage/04", BIOMES));
    applyRealm(el, realmFor("/app/map", BIOMES));
    expect(Object.fromEntries(attrs)).toEqual({ "data-realm": "star" });
  });
});

describe("index.html's pre-paint script agrees with realmFor", () => {
  const html = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "..", "index.html"),
    "utf8",
  );
  const script = html.match(/<script data-realm-prepaint>([\s\S]*?)<\/script>/)?.[1];

  it("exists, inline, in <head>, before the module bundle", () => {
    expect(script, "no <script data-realm-prepaint> in index.html").toBeTruthy();
    expect(html.indexOf("data-realm-prepaint")).toBeLessThan(html.indexOf("</head>"));
    expect(html.indexOf("data-realm-prepaint")).toBeLessThan(html.indexOf('type="module"'));
  });

  function runPrepaint(pathname: string, cached: string | null): Map<string, string> {
    const { attrs, el } = fakeHtml();
    runInNewContext(script!, {
      document: { documentElement: el },
      location: { pathname },
      localStorage: { getItem: (k: string) => (k === PLANET_BIOMES_KEY ? cached : null) },
      JSON,
    });
    return attrs;
  }

  for (const [path, want] of TABLE) {
    it(`${path}: the first frame matches realmFor`, () => {
      const attrs = runPrepaint(path.split("?")[0]!, JSON.stringify(BIOMES));
      expect(attrs.get("data-realm")).toBe(want.realm);
      expect(attrs.get("data-biome") ?? null).toBe(want.realm === "biome" ? want.biome : null);
    });
  }

  it("knows the same seven biomes as the contract", () => {
    const list = script!.match(/var biomes = (\[[^\]]*\])/)?.[1];
    expect(list, "the pre-paint script's biome list").toBeTruthy();
    expect(JSON.parse(list!)).toEqual(Biome.options);
  });

  it("with no cache and no storage, the realm is still right", () => {
    expect(Object.fromEntries(runPrepaint("/app/stage/04", null))).toEqual({
      "data-realm": "biome",
      "data-biome": FALLBACK_BIOME,
    });
    const { attrs, el } = fakeHtml();
    runInNewContext(script!, {
      document: { documentElement: el },
      location: { pathname: "/app/stage/04" },
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError: storage is disabled");
        },
      },
      JSON,
    });
    expect(attrs.get("data-realm")).toBe("biome");
  });
});
