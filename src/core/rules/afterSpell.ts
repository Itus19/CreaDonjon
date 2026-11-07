import type { ActivationBlockData, SpellCastTrigger } from "../schemas/rule-blocks/playable";
import { SPELL_SCHOOLS, type SpellSchool } from "./homebrewSpell";

/**
 * V3.1-184 — les utilisations qu'une fiche propose juste après un sort lancé
 * (Magie envoûtante : « aussitôt après avoir lancé un sort d'Enchantement ou
 * d'Illusion par un emplacement de sort »). Pur. Ce n'est qu'une proposition :
 * l'utilisation passe ensuite par la route d'activation, comme au clic, qui
 * vérifie coût et ressources (règle 8 : rien ne se décide ici).
 */
export interface CastSpellInfo {
  /** L'école du sort (`spell_casting.school`, « Enchantment » ou sa traduction « Enchantement ») ; `null` si inconnue. */
  school: string | null;
  /** Le niveau de l'emplacement dépensé ; 0 : sort mineur, aucun emplacement. */
  slotLevel: number;
}

/** Les écoles telles que les traductions françaises les écrivent (`ruleset_entry_translations`), vers leur nom anglais. */
const ECOLES_TRADUITES: Readonly<Record<string, SpellSchool>> = {
  abjuration: "Abjuration",
  invocation: "Conjuration",
  divination: "Divination",
  enchantement: "Enchantment",
  evocation: "Evocation",
  illusion: "Illusion",
  necromancie: "Necromancy",
  transmutation: "Transmutation",
};

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** L'école canonique d'un sort, qu'elle soit lue en anglais (« Enchantment ») ou en français (« Enchantement ») ; `null` sinon. */
export function canonicalSchool(school: string | null): SpellSchool | null {
  if (!school) return null;
  const s = sansAccents(school.trim());
  return SPELL_SCHOOLS.find((e) => e.toLowerCase() === s) ?? ECOLES_TRADUITES[s] ?? null;
}

export function spellCastMatches(trigger: SpellCastTrigger, cast: CastSpellInfo): boolean {
  if (trigger.with_slot && cast.slotLevel <= 0) return false;
  if (!trigger.schools) return true;
  const ecole = canonicalSchool(cast.school);
  return ecole !== null && trigger.schools.includes(ecole);
}

export interface SpellCastProposal {
  ruleKey: string;
  activationId: string;
  label: string;
  featureLabel: string;
}

export function proposalsAfterSpell(
  features: readonly { key: string; label: string; activation?: ActivationBlockData }[],
  cast: CastSpellInfo
): SpellCastProposal[] {
  const out: SpellCastProposal[] = [];
  for (const f of features) {
    for (const a of f.activation?.activations ?? []) {
      if (a.trigger?.on !== "spell_cast" || !spellCastMatches(a.trigger, cast)) continue;
      out.push({ ruleKey: f.key, activationId: a.id, label: a.label.fr ?? a.label.en ?? a.id, featureLabel: f.label });
    }
  }
  return out;
}
