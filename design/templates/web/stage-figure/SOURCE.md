# Source: a course figure in the reader

- **URL:** https://en.wikipedia.org/wiki/Endianness (the first `figure[typeof~='mw:File/Thumb']`)
- **Captured:** 6 Oct 2026, Playwright Chromium, 1440 wide, element screenshot
- **HTTP status:** 200, title "Endianness - Wikipedia"
- **What rendered:** the article's lead diagram (32-bit integer stored little- and big-endian)
  in a hairline frame on the page's surface, its caption under it in smaller muted type,
  separated from the frame. Verified by opening `template.png`.
- **Why this reference:** a server-rendered, long-form reading page that puts a technical
  diagram inline in running text with a caption, which is exactly what a figure block is in
  `/app/stage/:id`. We take the structure (framed drawing, caption below, credit in small type),
  never its colours: our figure draws in the biome's tokens.
