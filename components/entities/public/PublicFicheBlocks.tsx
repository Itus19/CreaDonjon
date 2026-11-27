import Link from "next/link";
import { zCharacterBlockData } from "@/src/core/schemas/blocks/character";
import { zInventoryBlockData, type InventoryItem } from "@/src/core/schemas/blocks/inventory";
import { zSpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { PRONOUN_SETS } from "@/src/core/rules/pronouns";
import type { EntityRefPreview, RuleRefPreview } from "@/src/server/services/refPreview";

/**
 * V3.2-72 — Les blocs de fiche d'un personnage en lecture, sur la page du
 * wiki : le build (espèce, classes, historique, genre et pronoms), l'inventaire
 * et les sorts connus. Avant, la page n'en montrait que les titres.
 *
 * Aucune valeur dérivée (CA, PV, modificateurs) : elles se calculent dans la
 * fiche jouable (`characterSheet()`, règle 16). Ici, seulement ce que le bloc
 * déclare, avec les noms résolus côté serveur (`ruleRefs`, `textRefs` posés par
 * `getPlayerEntityDetail`, qui écarte déjà une fiche que ce lecteur ne voit pas).
 * Une clé sans nom résolu s'affiche telle quelle plutôt que de disparaître.
 */

interface Refs {
  ruleRefs?: Record<string, RuleRefPreview>;
  textRefs?: Record<string, EntityRefPreview>;
  hrefBase: string;
  ruleHrefBase?: string;
}

const GENRES: Record<string, string> = { feminine: "féminin", masculine: "masculin", neutral: "neutre" };
const ABILITES: [keyof AbilityScores, string][] = [
  ["str", "FOR"],
  ["dex", "DEX"],
  ["con", "CON"],
  ["int", "INT"],
  ["wis", "SAG"],
  ["cha", "CHA"],
];
type AbilityScores = { str: number; dex: number; con: number; int: number; wis: number; cha: number };

function Reference({ reference, refs }: { reference: BlockReference; refs: Refs }) {
  if (reference.kind === "rule") {
    const nom = refs.ruleRefs?.[reference.key]?.name ?? reference.key;
    if (!refs.ruleHrefBase) return <>{nom}</>;
    return (
      <Link href={`${refs.ruleHrefBase}/${reference.key}`} className="text-link-entity hover:underline">
        {nom}
      </Link>
    );
  }
  const fiche = refs.textRefs?.[reference.id];
  // Une fiche cachée à ce lecteur n'a pas d'entrée : ni nom, ni lien.
  if (!fiche) return <span className="text-ink-muted">objet</span>;
  return (
    <Link href={`${refs.hrefBase}/${fiche.slug}`} className="text-link-entity hover:underline">
      {fiche.name}
    </Link>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-ink-muted">{libelle}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

export function PublicCharacterBlock({ data, ...refs }: { data: unknown } & Refs) {
  const parsed = zCharacterBlockData.safeParse(data);
  if (!parsed.success) return <p className="text-sm text-ink-muted">Fiche illisible.</p>;
  const c = parsed.data;
  const genre = c.gender === undefined || c.gender === "unspecified" ? null : typeof c.gender === "string" ? GENRES[c.gender] : c.gender.custom;
  const pronoms = c.pronouns ? [...c.pronouns.sets.map((k) => PRONOUN_SETS.find((p) => p.key === k)?.label ?? k), ...(c.pronouns.custom ? [c.pronouns.custom] : [])].join(", ") : "";
  return (
    <dl className="flex flex-col gap-1 text-sm">
      {c.species && (
        <Ligne libelle="Espèce">
          <Reference reference={c.species} refs={refs} />
        </Ligne>
      )}
      {c.classes.length > 0 && (
        <Ligne libelle={c.classes.length > 1 ? "Classes" : "Classe"}>
          {c.classes.map((cl, i) => (
            <span key={i}>
              {i > 0 && " / "}
              <Reference reference={cl.class} refs={refs} /> {cl.level}
              {cl.subclass && (
                <>
                  {" ("}
                  <Reference reference={cl.subclass} refs={refs} />
                  {")"}
                </>
              )}
            </span>
          ))}
        </Ligne>
      )}
      {c.background && (
        <Ligne libelle="Historique">
          <Reference reference={c.background} refs={refs} />
        </Ligne>
      )}
      {genre && <Ligne libelle="Genre">{genre}</Ligne>}
      {pronoms && <Ligne libelle="Pronoms">{pronoms}</Ligne>}
      {c.age !== undefined && <Ligne libelle="Âge">{c.age} ans</Ligne>}
      {/* Les valeurs ATTRIBUÉES du build, pas les valeurs finales : bonus d'espèce et d'historique s'ajoutent dans la fiche jouable. */}
      <Ligne libelle="Base">
        <span className="font-mech">{ABILITES.map(([k, l]) => `${l} ${c.abilities.base[k]}`).join(" · ")}</span>
      </Ligne>
    </dl>
  );
}

function libelleObjet(item: InventoryItem, refs: Refs) {
  return "ref" in item ? <Reference reference={item.ref} refs={refs} /> : <>{item.label}</>;
}

const PIECES: [keyof Monnaie, string][] = [
  ["pp", "pp"],
  ["gp", "po"],
  ["ep", "pe"],
  ["sp", "pa"],
  ["cp", "pc"],
];
type Monnaie = { pp: number; gp: number; ep: number; sp: number; cp: number };

export function PublicInventoryBlock({ data, ...refs }: { data: unknown } & Refs) {
  const parsed = zInventoryBlockData.safeParse(data);
  if (!parsed.success) return <p className="text-sm text-ink-muted">Inventaire illisible.</p>;
  const { items, containers, currency } = parsed.data;
  const contenus = new Set(containers.flatMap((c) => c.contains));
  const libres = items.filter((i) => !contenus.has(i.id));
  const parId = new Map(items.map((i) => [i.id, i]));
  const bourse = PIECES.filter(([k]) => currency[k] > 0).map(([k, l]) => `${currency[k]} ${l}`);

  const liste = (lot: InventoryItem[]) => (
    <ul className="flex flex-col gap-0.5">
      {lot.map((item) => (
        <li key={item.id}>
          {item.qty !== 1 && <span className="font-mech text-ink-muted">{item.qty} × </span>}
          {libelleObjet(item, refs)}
          {item.equipped && <span className="text-xs text-ink-muted"> · équipé</span>}
          {item.attuned && <span className="text-xs text-ink-muted"> · harmonisé</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-2 text-sm text-ink">
      {items.length === 0 && <p className="text-ink-muted">Rien.</p>}
      {libres.length > 0 && liste(libres)}
      {containers.map((c) => {
        const dedans = c.contains.map((id) => parId.get(id)).filter((i): i is InventoryItem => i !== undefined);
        return (
          <div key={c.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{c.label}</p>
            {dedans.length > 0 ? liste(dedans) : <p className="text-ink-muted">Vide.</p>}
          </div>
        );
      })}
      {bourse.length > 0 && <p className="font-mech text-ink-soft">Bourse : {bourse.join(", ")}</p>}
    </div>
  );
}

export function PublicSpellcastingBlock({ data, ...refs }: { data: unknown } & Refs) {
  const parsed = zSpellcastingBlockData.safeParse(data);
  if (!parsed.success) return <p className="text-sm text-ink-muted">Sorts illisibles.</p>;
  const { known, prepared } = parsed.data;
  if (known.length === 0) return <p className="text-sm text-ink-muted">Aucun sort connu.</p>;
  const prepares = new Set(prepared);
  return (
    <ul className="flex flex-col gap-0.5 text-sm text-ink">
      {known.map((s, i) => (
        <li key={i}>
          <Reference reference={s.ref} refs={refs} />
          {s.ref.kind === "rule" && prepares.has(s.ref.key) && <span className="text-xs text-ink-muted"> · préparé</span>}
        </li>
      ))}
    </ul>
  );
}
