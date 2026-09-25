# Source of template.png

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/sign-in-2 |
| Captured | 2026-09-25, Playwright (Chromium), `waitUntil: networkidle` + 1.5s |
| HTTP | 200, final URL unchanged (no redirect) |
| Viewport | 1440x900 → `template.png`; 380x900 → `template-380.png` |
| Rendered | A real form, not an empty SPA shell: `h1` brand, `h2` "Sign in", Email, Password with a show-password button, "Forgot password?", Sign in, GitHub, Facebook, Terms, Privacy. Left half the form; right half a product screenshot. At 380 the right half is gone and the form is one column |
| Why this one | `CONSOLE-REVAMP.md` §3 names "shadcn-admin auth block" for `/signin`. shadcn-admin ships two: this split layout and a centred card |

A second capture sits beside it for comparison, **not adopted**:

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/sign-in |
| Captured | 2026-09-25, same method, HTTP 200 |
| File | `template-centred.png` (1440) |
| Rendered | The same form in a centred card on a blank page |
| Why rejected | It is what `/signin` already was: one card in the middle of an animated backdrop. At 1440 it leaves 1,050px of the screen with nothing to say. The split layout gives the POST readout (`DESIGN-REFERENCES.md` §7) a half of its own and keeps the form clear of it |

Both links answered 200 on 25 Sep before capture as well, which proved nothing
about a single-page app. The PNGs were opened and looked at after capture; both
show the form, not a blank shell or a loading state.

**Colours and fonts here are NOT adopted.** `TEMPLATE-LINKS.md`: colours and
fonts are always replaced with `packages/tokens`. What is taken is structure;
see `SPEC.md`.
