import type { Rng } from "../dice/rng";
import type { InfoboxEntry } from "../schemas/blocks/infobox";
import { orderedNeighbors, type GeneratorVariantAxis } from "./variants";
import { renderGeneratorTemplate } from "./render";

/**
 * V3-C1 — Les axes de variante d'un outil de generateur, quand c'est le
 * MOTEUR qui tire et non plus le MJ a l'ecran.
 *
 * La richesse et la zone d'une taverne ne sont pas un choix : elles viennent
 * du **lieu courant** de la scene. Aucune entite `location` n'a de champ
 * type pour ca ; l'auteur a retenu (24 septembre) de les lire dans l'infobox
 * du lieu — entrees « Richesse » et « Zone » (ou leur cle technique) — puis
 * dans celle de ses parents `part_of`, du plus proche au plus lointain. Le
 * premier lieu qui porte l'entree decide ; s'il porte une valeur que l'axe ne
 * connait pas, l'axe est tire plutot que de remonter chercher ailleurs, pour
 * qu'une faute de saisie ne fasse pas silencieusement parler la ville a la
 * place de la taverne. La source de chaque axe est rendue, pour le journal.
 *
 * Les autres axes (type d'echoppe, genre d'un nom, rarete) ne disent rien du
 * lieu : l'appelant — du code, jamais le modele — peut les fixer ; sinon ils
 * sont tires. Tous les tirages passent par `rng`, dans l'ordre de
 * declaration des axes : meme graine, meme resultat.
 */

/** Axes dont la valeur vient toujours du lieu, jamais de l'appelant. */
export const LOCATION_VARIANT_AXES: readonly string[] = ["wealth", "zone"];

export type SceneVariantSource = "location" | "parent" | "caller" | "random";

export interface ResolvedSceneAxis {
  key: string;
  label: string;
  source: SceneVariantSource;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function findOption(axis: GeneratorVariantAxis, raw: string) {
  const wanted = normalize(raw);
  return axis.options.find((o) => o.key === wanted || normalize(o.label) === wanted);
}

/**
 * `places` : les entrees d'infobox du lieu courant d'abord, puis de chacun
 * de ses parents `part_of` dans l'ordre. Un lieu sans infobox est un
 * tableau vide.
 */
export function resolveSceneVariant(
  axes: readonly GeneratorVariantAxis[],
  places: readonly (readonly InfoboxEntry[])[],
  callerChoices: Readonly<Record<string, string>>,
  rng: Rng
): Record<string, ResolvedSceneAxis> {
  const resolved: Record<string, ResolvedSceneAxis> = {};

  for (const axis of axes) {
    const names = new Set([normalize(axis.key), normalize(axis.label)]);
    let found: ResolvedSceneAxis | null = null;

    if (LOCATION_VARIANT_AXES.includes(axis.key)) {
      for (let depth = 0; depth < places.length; depth++) {
        const entry = places[depth].find((e) => names.has(normalize(e.label)));
        if (!entry) continue;
        const option = findOption(axis, entry.value);
        if (option) found = { key: option.key, label: option.label, source: depth === 0 ? "location" : "parent" };
        break;
      }
    } else if (callerChoices[axis.key] !== undefined) {
      const option = axis.options.find((o) => o.key === callerChoices[axis.key]);
      if (option) found = { key: option.key, label: option.label, source: "caller" };
    }

    if (!found && axis.options.length > 0) {
      const option = axis.options[rng.nextInt(axis.options.length)];
      found = { key: option.key, label: option.label, source: "random" };
    }
    if (found) resolved[axis.key] = found;
  }

  return resolved;
}

/**
 * La cle de table REELLEMENT tiree par un emplacement, pour le journal :
 * meme interpolation que le tirage (`{axe}`, `{axe_below}`, `{axe_above}`),
 * reconstruite depuis les axes resolus plutot que remontee du moteur de
 * generateurs, que ce ticket ne modifie pas.
 */
export function sceneTableKey(
  template: string,
  axes: readonly GeneratorVariantAxis[],
  resolved: Readonly<Record<string, ResolvedSceneAxis>>
): string {
  const keys: Record<string, string> = {};
  for (const axis of axes) {
    const value = resolved[axis.key];
    if (!value) continue;
    const { below, above } = orderedNeighbors(axis, value.key);
    keys[axis.key] = value.key;
    keys[`${axis.key}_below`] = below;
    keys[`${axis.key}_above`] = above;
  }
  return renderGeneratorTemplate(template, keys);
}
