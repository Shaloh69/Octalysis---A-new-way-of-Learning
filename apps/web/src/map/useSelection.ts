import { useLocation, useNavigate } from "react-router-dom";

/**
 * The map's selection lives in the URL, `/app?stage=NN[&moon=NN.N]`, so a
 * bookmark, a shared link, Leave planet (`/app?stage=NN`) and Back to the moon
 * (`/app?stage=NN&moon=NN.N`, WEB-REVAMP 3.3) all open the right body, and the
 * browser's Back steps out one level: moon, then planet, then the system.
 *
 *   open(id)      pushes when nothing was open, replaces when switching planets,
 *                 so Back always means "close the panel", never "the planet
 *                 before this one". Choosing a planet drops any moon
 *   openMoon(id)  pushes when no moon was open, replaces when switching moons;
 *                 only a moon of the chosen planet (3.2: moons are selectable
 *                 only while their planet is in focus)
 *   close()       steps out ONE level: the moon if one is open, else the
 *                 planet. Goes Back if this page opened it, otherwise drops the
 *                 parameter in place (a deep link has no history to go back to)
 */
interface NavState {
  mapOpened?: boolean;
  moonOpened?: boolean;
}

export interface Selection {
  selected: string | null;
  moon: string | null;
  open: (id: string) => void;
  openMoon: (id: string) => void;
  close: () => void;
}

export function useSelection(): Selection {
  const location = useLocation();
  const nav = useNavigate();
  const params = new URLSearchParams(location.search);
  const selected = params.get("stage");
  const rawMoon = params.get("moon");
  // A moon belongs to its planet: `?stage=01&moon=04.2` names no moon.
  const moon = selected && rawMoon && rawMoon.startsWith(`${selected}.`) ? rawMoon : null;
  const st = (location.state ?? {}) as NavState;

  const go = (p: URLSearchParams, replace: boolean, state: NavState) => {
    const q = p.toString();
    nav({ pathname: location.pathname, search: q ? `?${q}` : "" }, { replace, state });
  };

  const open = (id: string): void => {
    if (id === selected && !moon) return;
    const p = new URLSearchParams(location.search);
    p.set("stage", id);
    p.delete("moon");
    go(p, !!selected, { mapOpened: selected ? !!st.mapOpened : true });
  };

  const openMoon = (id: string): void => {
    if (!selected || !id.startsWith(`${selected}.`) || id === moon) return;
    const p = new URLSearchParams(location.search);
    p.set("moon", id);
    go(p, !!moon, { mapOpened: !!st.mapOpened, moonOpened: moon ? !!st.moonOpened : true });
  };

  const close = (): void => {
    if (moon) {
      if (st.moonOpened) {
        nav(-1);
        return;
      }
      const p = new URLSearchParams(location.search);
      p.delete("moon");
      go(p, true, { mapOpened: !!st.mapOpened });
      return;
    }
    if (!selected) return;
    if (st.mapOpened) {
      nav(-1);
      return;
    }
    const p = new URLSearchParams(location.search);
    p.delete("stage");
    p.delete("moon");
    go(p, true, {});
  };

  return { selected, moon, open, openMoon, close };
}

/** Objectives in the syllabus's order: 06.1, 06.2 … 06.10 (the API sorts them as strings). */
export function byObjectiveId(a: { id: string }, b: { id: string }): number {
  const pa = a.id.split(".").map(Number);
  const pb = b.id.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d !== 0 && !Number.isNaN(d)) return d;
  }
  return a.id.localeCompare(b.id);
}
