# `/app/chat` — template source

`template.png` (1440) and `template-380.png` (380): Zulip's web-public view,
**https://chat.zulip.org/#narrow/channel/101-design**, captured 6 Oct 2026,
HTTP 200, signed out, title "#design > ... - Zulip Community - Zulip".
Opened before use. What rendered: the channels rail (left), one channel's
conversation with an inline screenshot attachment, author and time per message,
and the composer docked at the bottom; at 380 the rail folds away and the
composer stays docked.

The first attempt (`#narrow/channel/7-test-here`) rendered "This is not a
publicly accessible conversation" with a sign-up modal: rejected, recorded here.

What is taken: the STRUCTURE (rooms rail, a scrolling log, the composer under
it, an attachment inline in its message). What is not: Zulip's colours, type and
topics. The dress is the star HUD's panels
(`design/templates/web/_direction/star/starfield-hud.png`, as `/app/settings`).
Same template as the console's `/chat` (one conversation, two looks).

---

## Remade, 8 Oct 2026 — Messenger's two screens

Instructor: "Change how chat looks in overall. When in the phone, Rooms and
mission status is the only thing we saw in screen. When clicking the Room the
View will be Bigger Without Too much headers, like in Messenger. Find suitable
templates online."

**Template: Chatscope's friends demo, https://chatscope.io/demo/chat-friends/**,
captured 8 Oct 2026, HTTP 200, title "Demo | chatscope" (`messenger-1440.png`,
`messenger-380.png`, one card each, opened). What rendered: a list of
conversations, each row a **face, a name and a line**; one conversation open to a
**slim header (back arrow, face, name, status)**, the log filling the card, and a
**pill-shaped composer docked at the bottom**; at 380 the card is the one
conversation with the back arrow.

Rejected while looking, and why (recorded so the next session does not repeat
them): `shadcn-chat.vercel.app` (200, but a docs page for a component, not a chat
app); `web.chat21.org` (200, a sign-in screen); `demo.chatscope.io` (the full app
demo; the page never finished loading in two attempts, 45 s and 60 s).

What is taken: the two-screen structure, the slim header, the face beside every
name, the docked composer. What is not: Chatscope's colours and type. The dress
stays the star HUD's; bubbles are rounded, as Messenger's are, and that is the
one place the HUD's square edges give way.
