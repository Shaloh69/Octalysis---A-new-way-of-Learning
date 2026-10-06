# The reader — template sources

Copied 30 Sep 2026 from `design/templates/web/_direction/biome/` (captured the
same day from interfaceingame.com; each page and image answered 200; see
`_direction/SOURCE.md`). Both were opened before use.

| File | From | What it gives the reader |
|---|---|---|
| `template.png` | `_direction/biome/stardew-valley-letter.png` | The reading as a letter: a wide paper surface over the world, the world around it |
| `template-journal.png` | `_direction/biome/stardew-valley-journal.png` | The side bar: a titled frame, list rows each their own framed button |

`first-pass/` holds the 29 Sep reader's reference (MDN's article page) and
captures, kept as history.

## Listen's following (6 Oct 2026)

| File | From | What it gives the reader |
|---|---|---|
| `template-listen.png` | https://miniwebtool.com/text-to-speech-reader/ — captured 6 Oct 2026, HTTP 200, title "Text to Speech Reader - Free Online TTS with Voices", 1440 wide, mid-playback | The word being said lit solid inside the text, and a progress bar ("10 / 42 words") under the controls |

Headless Chromium has no voices, so the capture replaced `speechSynthesis`
with one that fires word boundaries as a real voice does; the page's own
highlight and bar then rendered (`scripts/.tts-ref3.tmp.mjs`, not kept). The
image was opened before use.

Rejected, with the reason: **Lumotext** (lumotext.com/text-to-speech), the
closest in kind (paragraph, sentence and word highlighting), would not open
its reader headless: a voice-picker gate and an empty voice list stopped it
before any text was shown. **Microsoft's Immersive Reader** article had no
image of read-aloud in use.

What OCTA takes from it: the lit word and a progress bar. What it adds, at the
instructor's ask: the sentence tint, the line filling under the sentence, and
the strip pinned along the bottom.
