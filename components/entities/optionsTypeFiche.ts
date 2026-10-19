import { ENTITY_KINDS } from "@/lib/entities/schemas";
import { ENTITY_KIND_LABELS, SYSTEM_KIND_LABELS } from "@/components/shared/entityKindLabels";

/** Sentinelle jamais persistee (V2-G7) : selectionner cette option ouvre un champ, ne sauvegarde rien tant qu'un nom n'est pas confirme. */
export const CUSTOM_KIND_OPTION = "__custom__";

/**
 * PJ/PNJ (V2-G10, specs/arbitrage-modifications.md §3.1) : jamais un
 * `entity_kind` distinct — ces deux valeurs de selecteur persistent toutes
 * les deux `entityKind: "character"`, seul `campaign_characters.is_pc`
 * change. Sentinelles composees pour rester distinctes de "character" tout
 * en restant reconnaissables dans `kindOptions`.
 */
export const PJ_VALUE = "character:pj";
export const PNJ_VALUE = "character:pnj";

/**
 * Les categories proposees par le selecteur de type d'une fiche (V2-G7) :
 * fixes (avec PJ/PNJ a la place de « Personnage »), personnelles du monde,
 * la valeur courante si elle n'y figure pas (libellée en français si c'est un
 * type système), puis — en dernier choix — l'option
 * qui ouvre le champ de creation. Partagee entre l'en-tete de la fiche et
 * l'editeur plein ecran (V3.1-31) : une seule liste, deux ecrans.
 */
export function optionsTypeFiche(worldCustomKinds: string[], entityKind: string): { value: string; label: string }[] {
  const knownKinds = new Set<string>([...ENTITY_KINDS, ...worldCustomKinds]);
  const fixedOptions = ENTITY_KINDS.map((kind) => ({ value: kind as string, label: ENTITY_KIND_LABELS[kind] })).flatMap(
    (opt) => (opt.value === "character" ? [{ value: PJ_VALUE, label: "PJ" }, { value: PNJ_VALUE, label: "PNJ" }] : [opt]),
  );
  return [
    ...fixedOptions,
    ...worldCustomKinds.map((kind) => ({ value: kind, label: kind })),
    ...(knownKinds.has(entityKind) ? [] : [{ value: entityKind, label: Object.hasOwn(SYSTEM_KIND_LABELS, entityKind) ? SYSTEM_KIND_LABELS[entityKind] : entityKind }]),
    { value: CUSTOM_KIND_OPTION, label: "+ Créer une catégorie…" },
  ];
}
