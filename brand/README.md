# Dirasa brand kit

The logo is the lowercase wordmark **dirasa**, set in [Alexandria](https://fonts.google.com/specimen/Alexandria)
ExtraBold (weight 800, letter-spacing −0.05 em). The Arabic name **دراسة** ("study") can sit beneath it as a
lockup. The app icon is the wordmark's own **d**.

Every file here has its text converted to outlines. Nothing depends on the font being installed, so the files
can go straight to a printer, a designer or a merchandise supplier.

## Files

| Need | File |
|---|---|
| Logo on light backgrounds (screen, DTG/DTF prints) | `logo/svg/dirasa-wordmark-gradient.svg`, `logo/png/…-gradient.png` |
| Logo on dark backgrounds (dark shirts, the site footer) | `…-gradient-on-dark` |
| One-colour logo (screen printing, embroidery, stamps) | `…-navy`, `…-white`, `…-black` |
| Logo with the Arabic name | `logo/…/dirasa-lockup-<variant>` |
| App icon (512 px vector, 2048 px PNG) | `icon/dirasa-icon.svg`, `icon/dirasa-icon-2048.png` |
| Colours as data | `colors.json` |

- **SVG** is the master: scalable to any size. Send SVG to printers whenever they accept it.
- **PNG** files are 4800 px wide (16 in at 300 dpi), on a transparent background.

## Colours

| Name | Hex | Use |
|---|---|---|
| Navy | `#0b2a6f` | Start of the logo gradient; the one-colour logo |
| Indigo | `#432dd7` | Middle of the gradient |
| Sky | `#0084d1` | End of the gradient |
| Sky light | `#b8e6fe` | Middle of the gradient on dark backgrounds |
| Indigo light | `#a3b3ff` | End of the gradient on dark backgrounds |

The gradient runs left to right: navy → indigo → sky (on dark: white → sky light → indigo light).

## T-shirts and merchandise

- **Printing method:**
  - Gradients need digital printing (DTG or DTF).
  - For screen printing, embroidery or vinyl, use a one-colour file: navy or black on light garments, white on dark ones.
- **Colour matching:** printers convert to their own colour systems (CMYK, Pantone). Ask them to match the hex values above and to send a proof first.
- **Print size:** a chest print is typically 10–12 in wide; a small left-chest logo is 3–4 in.
- **Clear space:** leave at least the height of the "d" bowl (about a third of the logo's height) clear on every side.
- **Minimum size:** 25 mm wide in print, 80 px on screen. Below that, use the icon.

## Don'ts

- Don't change the letter spacing or the case ("Dirasa" in running text is fine; the logo is always lowercase).
- Don't recolour the gradient, add shadows or outlines, or stretch it.
- Don't set the logo in another font. Use these files.

## App theme

The mobile app uses the same look as the web app ([dirasa-client](https://github.com/tonimnim/dirasa-client)):
`theme.json` holds its colour tokens, converted to hex from the web app's `globals.css`.

- **Colours:** slate neutrals. Primary is sky `#0084d1` in light mode and `#00a6f4` in dark mode. Light, dark and system modes.
- **Font:** Geist for all UI text. Alexandria is only for the logo, and the logo files already have it as outlines.
- **Backdrop:** sign-in and signed-in screens sit on the same soft blue backdrop. Light mode is a 160° gradient
  `#f8fbff → #eef3ff → #e3ecff` with blurred sky, indigo and violet glows. Dark mode is deep navy, `#050914 → #0a1230`.
- **Surfaces:** cards are frosted glass: white at 72% opacity (slate-900 at 60% in dark mode), blurred, with 18 px corners.
  The sign-in card has 22 px corners.
- **Primary button:** 48 px tall with 14 px corners, a sky-500 → indigo-500 gradient (`#00a6f4 → #615fff`) and white semibold text.
  Progress bars use the same gradient.
- **Copy:** tagline "Every child known. Every record protected." British spelling (enrolment, authorised).

## Files from the web app

| File | What it is |
|---|---|
| `icon/app/icon-192.png`, `icon-512.png` | App icons (the web app's install icons) |
| `icon/app/maskable-512.png` | Icon with safe padding, for Android adaptive icons |
| `logo/web/dirasa-logo.png` | Square logo |
| `logo/web/dirasa-wordmark.svg` | The wordmark as used in the web app |

## Regenerating

`generate.mjs` comes from the web client and rebuilds these files there. It shapes the text with HarfBuzz and writes
the outlines; the header of the script has the exact commands. Make brand changes in dirasa-client and copy them here,
so the two apps stay identical. Alexandria is licensed under the SIL Open Font License, which allows logos made from it.
