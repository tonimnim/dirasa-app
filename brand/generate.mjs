#!/usr/bin/env node
/**
 * Generates every Dirasa logo file from the Alexandria typeface: the print kit in brand/, the web icons in
 * src/app/ and public/, and the social preview image. Text is shaped with HarfBuzz (kerning, Arabic joining)
 * at the logo's weight and written as plain vector outlines, so no file depends on the font being installed.
 *
 * Run from the repository root (sharp comes with Next.js; the two helpers are not app dependencies):
 *
 *   npm install --no-save harfbuzzjs wawoff2
 *   node brand/generate.mjs --latin <Alexandria latin .ttf|.woff2> --arabic <Alexandria arabic .ttf|.woff2>
 *
 * Alexandria (SIL Open Font License) is on Google Fonts; the variable font covers both scripts. After a
 * `next build`, next/font's copies are in .next/static/media (see the @font-face rules in the build CSS).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import * as hb from "harfbuzzjs";
import sharp from "sharp";
import wawoff2 from "wawoff2";

const { values: args } = parseArgs({ options: { latin: { type: "string" }, arabic: { type: "string" }, out: { type: "string", default: "." } } });
if (!args.latin || !args.arabic) throw new Error("Pass --latin and --arabic font files (see the header of this script).");
const ROOT = path.resolve(args.out);

/* ---------------------------------------------------------------------------------------------- */
/* Colours: the Tailwind v4 tokens the app uses, converted from OKLCH to sRGB hex                    */
/* ---------------------------------------------------------------------------------------------- */

function oklch(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
  const encode = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  return `#${linear.map((x) => Math.round(Math.min(1, Math.max(0, encode(x))) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export const COLORS = {
  navy: "#0b2a6f",
  indigo700: oklch(0.457, 0.24, 277.023),
  indigo500: oklch(0.585, 0.233, 277.117),
  indigo300: oklch(0.785, 0.115, 274.713),
  sky600: oklch(0.588, 0.158, 241.966),
  sky500: oklch(0.685, 0.169, 237.323),
  sky200: oklch(0.901, 0.058, 230.902),
  slate600: oklch(0.446, 0.043, 257.281),
  slate500: oklch(0.554, 0.046, 257.417),
};
const GRADIENTS = {
  brand: [COLORS.navy, COLORS.indigo700, COLORS.sky600],
  light: ["#ffffff", COLORS.sky200, COLORS.indigo300],
};

/* ---------------------------------------------------------------------------------------------- */
/* Text → outlines                                                                                   */
/* ---------------------------------------------------------------------------------------------- */

async function loadFont(file) {
  let data = await readFile(file);
  if (file.endsWith(".woff2")) data = Buffer.from(await wawoff2.decompress(data));
  const face = new hb.Face(new hb.Blob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
  return { face, font: new hb.Font(face) };
}

const latin = await loadFont(args.latin);
const arabic = await loadFont(args.arabic);

/**
 * Shapes `text` and returns its outline at `size` px (font size), with the pen starting at x = 0 on the
 * baseline y = 0 (SVG coordinates, y down), and the ink bounds.
 */
function shapeText({ face, font }, text, { weight = 800, size = 100, tracking = 0 } = {}) {
  font.setVariations([new hb.Variation("wght", weight)]);
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  const scale = size / face.upem;
  const spacing = tracking * face.upem; // CSS letter-spacing in em
  let pen = 0;
  const commands = [];
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const glyph of buffer.getGlyphInfosAndPositions()) {
    const gx = pen + (glyph.xOffset ?? 0);
    const gy = glyph.yOffset ?? 0;
    for (const { type, values } of font.glyphToJson(glyph.codepoint)) {
      const points = [];
      for (let i = 0; i < values.length; i += 2) points.push((gx + values[i]) * scale, -(gy + values[i + 1]) * scale);
      commands.push({ type, points });
    }
    const ext = font.glyphExtents(glyph.codepoint);
    if (ext && ext.width) {
      box.minX = Math.min(box.minX, (gx + ext.xBearing) * scale);
      box.maxX = Math.max(box.maxX, (gx + ext.xBearing + ext.width) * scale);
      box.minY = Math.min(box.minY, -(gy + ext.yBearing) * scale);
      box.maxY = Math.max(box.maxY, -(gy + ext.yBearing + ext.height) * scale);
    }
    pen += (glyph.xAdvance ?? 0) + spacing;
  }
  buffer.destroy?.();
  return { commands, box, width: box.maxX - box.minX, height: box.maxY - box.minY };
}

/** Path data for an outline, scaled by `k`, with its ink box starting at (x, y). Coordinates are baked in (no
 * transforms), so gradients in user space line up across every glyph of a composition. */
function pathData(shape, x = 0, y = 0, k = 1) {
  const dx = x - shape.box.minX * k;
  const dy = y - shape.box.minY * k;
  return shape.commands
    .map(({ type, points }) => type + points.map((v, i) => (v * k + (i % 2 ? dy : dx)).toFixed(2)).join(" "))
    .join("");
}

/** Places an outline so its ink box starts at (x, y). */
const placed = (shape, x, y) => `<path d="${pathData(shape, x, y)}"/>`;

function gradientDef(id, stops, x1, y1, x2, y2) {
  const offsets = stops.length === 3 ? [0, 0.5, 1] : stops.map((_, i) => i / (stops.length - 1));
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map((color, i) => `<stop offset="${offsets[i]}" stop-color="${color}"/>`)
    .join("")}</linearGradient>`;
}

const svg = (width, height, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}" width="${width.toFixed(0)}" height="${height.toFixed(0)}" role="img"><title>${title}</title>${body}</svg>\n`;

/* ---------------------------------------------------------------------------------------------- */
/* Logo artwork                                                                                      */
/* ---------------------------------------------------------------------------------------------- */

const WORDMARK_SIZE = 200;
// The app sets the wordmark at weight 800 with tracking-tighter (letter-spacing -0.05em).
const wordmark = shapeText(latin, "dirasa", { weight: 800, size: WORDMARK_SIZE, tracking: -0.05 });
const arabicName = shapeText(arabic, "دراسة", { weight: 700, size: WORDMARK_SIZE * 0.42 });

/** The wordmark alone, tight to its ink. `fill` is a colour or a gradient name. */
function wordmarkSvg(fill) {
  const { width, height } = wordmark;
  const paint = GRADIENTS[fill] ? "url(#g)" : fill;
  const defs = GRADIENTS[fill] ? `<defs>${gradientDef("g", GRADIENTS[fill], 0, 0, width.toFixed(2), 0)}</defs>` : "";
  return svg(width, height, `${defs}<g fill="${paint}">${placed(wordmark, 0, 0)}</g>`, "Dirasa");
}

/** Wordmark with the Arabic name (دراسة) beneath it, aligned to the end, as on the sign-in screen. */
function lockupSvg(fill) {
  const gap = WORDMARK_SIZE * 0.1;
  const width = Math.max(wordmark.width, arabicName.width);
  const height = wordmark.height + gap + arabicName.height;
  const paint = GRADIENTS[fill] ? "url(#g)" : fill;
  const defs = GRADIENTS[fill] ? `<defs>${gradientDef("g", GRADIENTS[fill], 0, 0, width.toFixed(2), 0)}</defs>` : "";
  const body = `${defs}<g fill="${paint}">${placed(wordmark, 0, 0)}${placed(arabicName, width - arabicName.width, wordmark.height + gap)}</g>`;
  return svg(width, height, body, "Dirasa — دراسة");
}

/**
 * The app icon: the wordmark's "d" in white on the logo gradient. `shape` "rounded" is the standalone tile;
 * "square" is full-bleed for platforms that apply their own mask (iOS, Android maskable icons).
 */
function iconSvg({ shape = "rounded", glyphScale = 0.6 } = {}) {
  const size = 512;
  const d = shapeText(latin, "d", { weight: 800, size: 100 });
  const factor = (size * glyphScale) / d.height;
  const x = (size - d.width * factor) / 2;
  const y = (size - d.height * factor) / 2;
  const radius = shape === "rounded" ? 112 : 0;
  const body = `<defs>${gradientDef("g", GRADIENTS.brand, 0, 0, size, size)}</defs><rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/><path fill="#ffffff" d="${pathData(d, x, y, factor)}"/>`;
  return svg(size, size, body, "Dirasa");
}

/** 1200×630 link preview: the sign-in backdrop with the wordmark and a one-line description. */
function socialCardSvg() {
  const W = 1200;
  const H = 630;
  const logo = shapeText(latin, "dirasa", { weight: 800, size: 220, tracking: -0.05 });
  const tagline = shapeText(latin, "The school operating system", { weight: 500, size: 44 });
  const detail = shapeText(latin, "Admissions · Classes · Attendance · Grades · Fees", { weight: 400, size: 26 });
  const gapA = 34;
  const gapB = 22;
  const total = logo.height + gapA + tagline.height + gapB + detail.height;
  let top = (H - total) / 2 - 18;
  const logoX = (W - logo.width) / 2;
  const items = [];
  items.push(`<g fill="url(#word)">${placed(logo, logoX, top)}</g>`);
  top += logo.height + gapA;
  items.push(`<g fill="${COLORS.slate600}">${placed(tagline, (W - tagline.width) / 2, top)}</g>`);
  top += tagline.height + gapB;
  items.push(`<g fill="${COLORS.slate500}">${placed(detail, (W - detail.width) / 2, top)}</g>`);
  const blob = (id, color, opacity) =>
    `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  const defs = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#f8fbff"/><stop offset="0.45" stop-color="#eef3ff"/><stop offset="1" stop-color="#e3ecff"/></linearGradient>
    ${blob("b1", COLORS.sky200, 0.9)}${blob("b2", COLORS.indigo300, 0.55)}
    ${gradientDef("word", GRADIENTS.brand, logoX.toFixed(2), 0, (logoX + logo.width).toFixed(2), 0)}
    <filter id="soft" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>`;
  const waves = `<svg x="0" y="0" width="${W}" height="${H}" viewBox="0 0 1440 900" preserveAspectRatio="none">
    <path d="M0 610 C 300 480, 540 720, 840 600 S 1260 420, 1440 520 L1440 900 L0 900 Z" fill="#ffffff" fill-opacity="0.55"/>
    <path d="M0 700 C 360 570, 660 800, 1000 670 S 1320 570, 1440 610 L1440 900 L0 900 Z" fill="${COLORS.indigo300}" fill-opacity="0.25"/>
    <path d="M0 790 C 420 700, 760 860, 1100 760 S 1360 700, 1440 720 L1440 900 L0 900 Z" fill="${COLORS.sky200}" fill-opacity="0.5"/>
    <path d="M-20 600 C 300 470, 540 710, 840 590 S 1260 410, 1460 505" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="10" filter="url(#soft)"/>
    <path d="M-20 600 C 300 470, 540 710, 840 590 S 1260 410, 1460 505" fill="none" stroke="#ffffff" stroke-width="1.5"/>
  </svg>`;
  const body = `${defs}<rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="1050" cy="40" r="420" fill="url(#b1)"/><circle cx="90" cy="640" r="440" fill="url(#b2)"/>${waves}${items.join("")}`;
  return svg(W, H, body, "Dirasa — the school operating system");
}

/* ---------------------------------------------------------------------------------------------- */
/* Rendering                                                                                         */
/* ---------------------------------------------------------------------------------------------- */

async function write(file, data) {
  const target = path.join(ROOT, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  console.log("wrote", file);
}

/** Rasterises an SVG to a PNG `width` pixels wide (height follows the aspect ratio). */
async function png(svgText, width, { background, dpi } = {}) {
  const viewBoxWidth = Number(/viewBox="0 0 ([\d.]+)/.exec(svgText)[1]);
  let image = sharp(Buffer.from(svgText), { density: Math.min(72 * (width / viewBoxWidth), 100000) }).resize({ width });
  if (background) image = image.flatten({ background });
  if (dpi) image = image.withMetadata({ density: dpi });
  return image.png({ compressionLevel: 9 }).toBuffer();
}

/** A .ico holding PNG images (supported by every current browser), each rendered at its own size. */
async function ico(svgText, sizes) {
  const images = await Promise.all(sizes.map((size) => png(svgText, size)));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

/* Print kit ------------------------------------------------------------------------------------- */
const PRINT_WIDTH = 4800; // 16 in at 300 dpi
const variants = {
  gradient: "brand",
  "gradient-on-dark": "light",
  navy: COLORS.navy,
  white: "#ffffff",
  black: "#000000",
};
for (const [name, fill] of Object.entries(variants)) {
  const word = wordmarkSvg(fill);
  const lock = lockupSvg(fill);
  await write(`brand/logo/svg/dirasa-wordmark-${name}.svg`, word);
  await write(`brand/logo/svg/dirasa-lockup-${name}.svg`, lock);
  await write(`brand/logo/png/dirasa-wordmark-${name}.png`, await png(word, PRINT_WIDTH, { dpi: 300 }));
  await write(`brand/logo/png/dirasa-lockup-${name}.png`, await png(lock, PRINT_WIDTH, { dpi: 300 }));
}
const tile = iconSvg();
await write("brand/icon/dirasa-icon.svg", tile);
await write("brand/icon/dirasa-icon-2048.png", await png(tile, 2048, { dpi: 300 }));

/* Website icons --------------------------------------------------------------------------------- */
await write("src/app/icon.svg", tile);
await write("src/app/favicon.ico", await ico(tile, [16, 32, 48]));
await write("src/app/apple-icon.png", await png(iconSvg({ shape: "square" }), 180, { background: COLORS.navy }));
await write("public/icons/icon-192.png", await png(tile, 192));
await write("public/icons/icon-512.png", await png(tile, 512));
await write("public/icons/maskable-512.png", await png(iconSvg({ shape: "square", glyphScale: 0.42 }), 512, { background: COLORS.navy }));
// Square logo for search engines (Organization structured data): at least 112×112, readable on white.
await write("public/brand/dirasa-logo.png", await png(tile, 512));
await write("public/brand/dirasa-wordmark.svg", wordmarkSvg("brand"));

/* Link preview ---------------------------------------------------------------------------------- */
await write("src/app/opengraph-image.png", await png(socialCardSvg(), 1200));
await write("src/app/opengraph-image.alt.txt", "Dirasa, the school operating system: admissions, classes, attendance, grades and fees.\n");

await write("brand/colors.json", `${JSON.stringify(COLORS, null, 2)}\n`);
