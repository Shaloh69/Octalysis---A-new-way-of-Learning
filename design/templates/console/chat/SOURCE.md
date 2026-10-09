# `/chat` (console) — template source

`template.png` (1440) and `template-380.png` (380): Zulip's web-public view,
**https://chat.zulip.org/#narrow/channel/101-design**, captured 6 Oct 2026,
HTTP 200, signed out. Opened before use. What rendered: the channels rail, one
channel's conversation (author, time, an inline screenshot attachment), the
composer docked under it; at 380 the rail folds away.

The first URL tried (`#narrow/channel/7-test-here`) rendered "This is not a
publicly accessible conversation" and a sign-up modal: rejected.

Taken: the structure (rooms rail, scrolling log, docked composer, an
attachment inline in its message). Not taken: Zulip's colours, type, topics.
The dress is the console's own (the three themes, `packages/tokens`). The same
reference as the student app's `/app/chat`: one conversation, two looks.

---

## Remade, 9 Oct 2026 — Messenger's two screens (the console too)

Instructor, 9 Oct 2026 ("Both": the ? tour and the Messenger-shaped chat for the
console as well as the student app).

**Template: Chatscope's friends demo, https://chatscope.io/demo/chat-friends/**,
the same capture the student app's chat was remade from (`messenger-1440.png`,
`messenger-380.png`, copied here from `design/templates/web/chat/`; HTTP 200,
captured 8 Oct 2026, opened again before this build): a list of conversations,
each row a face, a name and a line; one conversation open to a slim header (back
arrow, face, name, status), the log filling the card, a pill-shaped composer
docked at the bottom with Send beside the field. Its `SOURCE.md` has the
rejected alternatives (shadcn-chat, chat21, demo.chatscope.io).
