/**
 * CSS du catalogue d'interface (docs/catalogue/, ADR 0033).
 *
 * Compile la vraie feuille de l'application (`app/globals.css`, donc
 * tokens.css + Tailwind) en ajoutant les planches comme source, pour que
 * chaque classe qu'elles emploient existe. Puis dérive des états FIGÉS :
 * chaque règle `:hover`, `:focus-visible`/`:focus`, `:active` reçoit une
 * jumelle `.st-hover`, `.st-focus`, `.st-active`. Une planche peut ainsi
 * montrer « Survol » côte à côte avec « Repos » sans recopier un seul style :
 * c'est le CSS du code, pas une imitation.
 *
 * Le mode contraste élevé (`:root[data-contrast="high"]`) reçoit aussi une
 * jumelle `.cat-scope[data-contrast="high"]` : le sélecteur de mode des
 * planches bascule une portée, pas la racine du document.
 *
 * Usage : node scripts/catalogue/build-css.mjs [sortie]   (défaut : catalogue.css)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const globalsPath = resolve(root, "app/globals.css");
const out = resolve(process.argv[2] ?? "catalogue.css");

// `globals.css` exclut `docs/` du scan de l'application (`@source not`) :
// ici on veut l'inverse, d'où le retrait de cette ligne avant d'ajouter les planches.
const globals = readFileSync(globalsPath, "utf8").replace('@source not "../docs";', "");
const source = `${globals}\n@source "${resolve(root, "docs/catalogue")}";\n`;
const compiled = await postcss([tailwind({ base: root })]).process(source, { from: globalsPath });

const sheet = postcss.parse(compiled.css);
let added = 0;
sheet.walkRules((rule) => {
  const extra = [];
  for (const selector of rule.selectors) {
    if (selector.includes(':root[data-contrast="high"]')) {
      extra.push(selector.replace(':root[data-contrast="high"]', '.cat-scope[data-contrast="high"]'));
    }
    let frozen = selector;
    if (/:hover/.test(frozen)) frozen = frozen.replace(/:hover/g, ".st-hover");
    if (/:focus-visible/.test(frozen)) frozen = frozen.replace(/:focus-visible/g, ".st-focus");
    else if (/:focus(?![-\w])/.test(frozen)) frozen = frozen.replace(/:focus(?![-\w])/g, ".st-focus");
    if (/:active/.test(frozen)) frozen = frozen.replace(/:active/g, ".st-active");
    if (frozen !== selector) extra.push(frozen.startsWith(".st-") ? `*${frozen}` : frozen);
  }
  if (extra.length > 0) {
    rule.selectors = [...rule.selectors, ...extra];
    added += extra.length;
  }
});

writeFileSync(out, sheet.toString());
console.log(`${out} écrit — ${added} variantes d'état ajoutées.`);
