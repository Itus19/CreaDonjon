// Calcule UNE FOIS la teinte/chroma/miniature des images de fond fournies
// avec l'application (public/backgrounds/) — jamais recalcule au chargement
// (V2-G4 reformule). Sortie a coller a la main dans
// src/core/theme/builtinBackgrounds.ts. Jamais execute en production, meme
// principe que scripts/seed-dev.ts.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { processBackgroundImage } from "../src/server/backgroundImageProcessing";
import { slugify } from "../src/core/slug/slug";

async function main() {
  const dir = path.join(process.cwd(), "public", "backgrounds");
  const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

  const entries = [];
  for (const file of files.sort()) {
    const buffer = await readFile(path.join(dir, file));
    const processed = await processBackgroundImage(buffer);
    const rawLabel = path.parse(file).name.replace(/[_-]+/g, " ").trim();
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
    const slug = slugify(path.parse(file).name);
    const backdropUrl = `/backgrounds/${encodeURIComponent(file)}`;
    entries.push({ slug, label, file, backdropUrl, ...processed });
    console.log(`${file} -> slug=${slug} hue=${processed.hue} chroma=${processed.chroma} modes=${processed.availableModes.join(",")}`);
  }

  console.log("\n--- src/core/theme/builtinBackgrounds.ts ---\n");
  console.log("import type { ThemeMode } from \"./oklch\";\n");
  console.log("export interface BuiltinBackground {");
  console.log("  slug: string;");
  console.log("  label: string;");
  console.log("  thumbDataUrl: string;");
  console.log("  /** Fond servi directement depuis public/backgrounds/ — jamais retraite, pleine qualite. */");
  console.log("  backdropUrl: string;");
  console.log("  hue: number;");
  console.log("  chroma: number;");
  console.log("  availableModes: ThemeMode[];");
  console.log("}\n");
  console.log("export const BUILTIN_BACKGROUNDS: BuiltinBackground[] = [");
  for (const e of entries) {
    console.log(`  { slug: ${JSON.stringify(e.slug)}, label: ${JSON.stringify(e.label)}, thumbDataUrl: ${JSON.stringify(e.thumbDataUrl)}, backdropUrl: ${JSON.stringify(e.backdropUrl)}, hue: ${e.hue}, chroma: ${e.chroma}, availableModes: ${JSON.stringify(e.availableModes)} as ThemeMode[] },`);
  }
  console.log("];");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
