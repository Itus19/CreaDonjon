import { proposalsAfterSpell, type CastSpellInfo } from "@/src/core/rules/afterSpell";
import type { ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";
import { activerRegle } from "@/lib/ui/activationApi";
import { sortieSansDes, type SuiteDeJet } from "@/lib/ui/outilDes";

/**
 * V3.1-184 (solution A) — après « Lancer » un sort, le résultat de l'outil de
 * dés propose l'utilisation que ce sort déclenche (Magie envoûtante : « aussitôt
 * après avoir lancé un sort d'Enchantement ou d'Illusion par un emplacement »).
 * « Utiliser » passe par la route d'activation, comme au clic : le serveur
 * vérifie et dépense ; « Passer » ne fait rien. La première proposition seule :
 * la bande n'a qu'un geste.
 */
export function suiteApresSort(p: {
  features: readonly { key: string; label: string; activation?: ActivationBlockData }[];
  sort: CastSpellInfo;
  entityId: string;
  campaignId: string | null;
  textes: { libelle: (action: string, aptitude: string) => string; passer: string; passe: string; utilisee: string; erreur: string };
  apres: () => void;
}): SuiteDeJet | undefined {
  if (p.campaignId === null) return undefined;
  const proposition = proposalsAfterSpell(p.features, p.sort)[0];
  if (!proposition) return undefined;
  const campaignId = p.campaignId;
  return {
    libelle: p.textes.libelle(proposition.label, proposition.featureLabel),
    lancer: async () => {
      const r = await activerRegle(
        p.entityId,
        { campaignId, ruleKey: proposition.ruleKey, activationId: proposition.activationId, variantId: null, targetParticipantIds: [] },
        p.textes.erreur
      );
      p.apres();
      return sortieSansDes(proposition.featureLabel, r.changes.length > 0 ? r.changes.join(" ; ") : p.textes.utilisee);
    },
    refus: { libelle: p.textes.passer, sortie: sortieSansDes(proposition.featureLabel, p.textes.passe) },
  };
}
