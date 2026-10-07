# Source of `/claim`' template (the console, a teacher claiming their employee ID)

Plan: `docs/TEACHERS-AND-SUBJECTS-PLAN.md` §2 (approved 7 Oct 2026, night):
a teacher creates their account by claiming the employee ID the admin put on
the teacher roster. Not the student app's `/claim`.

| | |
|---|---|
| URL | https://shadcn-admin.netlify.app/sign-up (the same app `/signin` took its reference from) |
| Captured | 7 Oct 2026 (night), Playwright (Chromium), `networkidle` + 1.5 s |
| HTTP | 200, title "Shadcn Admin" |
| `template.png` (1440) | Opened and looked at. A centred card under the product's name: "Create an account", a line with a **Sign In** link, Email, Password and Confirm Password (each password with a show toggle), **Create Account**, "or continue with" GitHub / Facebook, terms below |
| `template-380.png` | Opened. The same card at full width; nothing cut off |

**Taken:** the centred card, its order (what this is, the link back to sign
in, the fields, one primary action), show-password toggles. Ours adds the
**employee ID first** and the name check, as the roster names the teacher.
**Not taken:** the social sign-in buttons (accounts come only from the
roster), the terms line, colours and type (ours, as `/signin`).
