# Source of template.png

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/forgot-password |
| Captured | 2026-09-25, Playwright (Chromium), `waitUntil: networkidle` + 1.5s |
| HTTP | 200, final URL unchanged (no redirect) |
| Viewport | 1440x900 → `template.png`; 380x900 → `template-380.png` |
| Rendered | A real form, not an empty shell: brand, "Forgot Password", one line of description, Email, **Continue**, "Don't have an account? Sign up." A centred card |
| Why this one | It is the same template family as `/signin`'s (`CONSOLE-REVAMP.md` §3: "shadcn-admin auth block"), and it is exactly this page's shape: one field, one action. Opened and looked at after capture |

Colours and fonts are not adopted. The structure is taken and set inside the
gate's split frame (`GateFrame`), so this page and `/signin` read as one gate;
see `SPEC.md`.
