import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Starfield } from "../shell/Starfield";

/**
 * The title screen: first contact (WEB-REMAKE.md §8 row 10), Starfield's main
 * menu (`design/templates/web/title/template.png`). `/login`, `/register`,
 * `/maintenance` and the 404 all wear it.
 *
 *   the menu     left: the screen's few destinations, the current one lit
 *   the mark     centre: OCTA across a ring, the course under it
 *   the card     top-right: what this is, or what went wrong
 *   the panel    the screen's one task (a form), under the menu
 *
 * The star realm, and the still CSS star field (no WebGL before sign-in).
 * Everything here is real DOM: a form works from the first paint and nothing
 * waits for an animation.
 */
export interface MenuItem {
  to: string;
  label: string;
  current?: boolean;
}

export function TitleScreen({
  menu,
  panelTitle,
  children,
  card,
  heading = "h1",
}: {
  menu: MenuItem[];
  panelTitle: string;
  children: ReactNode;
  card: { title: string; body: ReactNode };
  /** The panel's title is the page's h1 unless the card carries it. */
  heading?: "h1" | "h2";
}): JSX.Element {
  const PanelH = heading;
  const CardH = heading === "h1" ? "h2" : "h1";
  return (
    <main className="title" id="main" data-title="">
      <Starfield />
      <span className="title-limb" aria-hidden="true" />
      <div className="title-grid">
        <div className="title-left">
          <nav className="title-menu" aria-label="Menu">
            <ul>
              {menu.map((m) => (
                <li key={m.to}>
                  <Link to={m.to} className={m.current ? "is-current" : undefined} aria-current={m.current ? "page" : undefined}>
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <section className="hud-panel title-panel" aria-labelledby="title-panel-h">
            <PanelH id="title-panel-h" className="hud-caption">
              {panelTitle}
            </PanelH>
            <div className="title-panel-body">{children}</div>
          </section>
        </div>

        <div className="title-mark" aria-hidden="true">
          <span className="title-ring" />
          <span className="title-word">OCTA</span>
        </div>

        <section className="title-card" aria-labelledby="title-card-h">
          <CardH id="title-card-h" className="title-card-title">
            {card.title}
          </CardH>
          <div className="title-card-body">{card.body}</div>
        </section>
      </div>
      <p className="title-foot">
        <span className="mono">CPE 412</span> · Computer Architecture and Organization · University of Cebu
      </p>
    </main>
  );
}
