import type { ActivationBlockData, SpellCastTrigger } from "../schemas/rule-blocks/playable";

/**
 * V3.1-184 — les utilisations qu'une fiche propose juste après un sort lancé
 * (Magie envoûtante : « aussitôt après avoir lancé un sort d'Enchantement ou
 * d'Illusion par un emplacement de sort »). Pur. Ce n'est qu'une proposition :
 * l'utilisation passe ensuite par la route d'activation, comme au clic, qui
 * vérifie coût et ressources (règle 8 : rien ne se décide ici).
 */
export interface CastSpellInfo {
  /** L'école du sort (`spell_casting.school`, « Enchantment ») ; `null` si inconnue. */
  school: string | null;
  /** Le niveau de l'emplacement dépensé ; 0 : sort mineur, aucun emplacement. */
  slotLevel: number;
}

export function spellCastMatches(trigger: SpellCastTrigger, cast: CastSpellInfo): boolean {
  if (trigger.with_slot && cast.slotLevel <= 0) return false;
  if (!trigger.schools) return true;
  const ecole = cast.school?.toLowerCase();
  return ecole !== undefined && trigger.schools.some((s) => s.toLowerCase() === ecole);
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
