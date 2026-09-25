# Source of template.png

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/sign-up |
| Captured | 2026-09-25, Playwright (Chromium), `waitUntil: networkidle` + 1.5s |
| HTTP | 200, final URL unchanged (no redirect) |
| Viewport | 1440x900 → `template.png`; 380x900 → `template-380.png` |
| Rendered | A real form: brand, "Create an account", Email, Password with show-password, **Confirm Password** with show-password, Create Account, GitHub, Facebook, Terms, Privacy. A centred card |
| Why this one | shadcn-admin has no reset-password page; its auth block stops at `/forgot-password`. `/sign-up` is the closest stock page with **a password and its confirmation**, which is this page's whole shape. Opened and looked at after capture |

Only that part is taken: two password fields, their order, one action under
them. Everything about creating an account is not adopted; see `SPEC.md`.
Colours and fonts are ours.
