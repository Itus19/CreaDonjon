import type { CampaignSummaryView } from "./CampaignsPanel";
import type { PartyMemberProbabilities } from "@/src/server/services/partyProbabilities";
import type { EncounterBudgetRow } from "@/src/core/rules/encounter";
import type { EncounterMonsterSummary } from "@/src/server/services/encounters";
import type { CampaignEncounterRow } from "@/src/server/repos/encounters";
import type { CombatDetail } from "@/src/server/services/combats";
import type { CombatRow } from "@/src/server/repos/combats";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { ShareLinkSummary } from "@/src/server/services/shareLinks";
import type { GeneratorToolWindowData } from "@/src/server/services/generators";

/**
 * Forme JSON d'une fenetre d'outil MJ (retour utilisateur, V2-M7 suite) —
 * meme profil que `EntityWindowData`/`RuleEntryDetail` : recuperee par
 * `GET /api/worlds/[worldSlug]/mj/[tool]/window` (`DesktopWindowsProvider`),
 * rendue par `MjToolWindowContent.tsx`. Un seul champ `tool` discrimine
 * l'union plutot qu'une route/un composant par outil — les neuf outils
 * partagent la meme plomberie de fenetre.
 *
 * "Un monde = une campagne" (V2-G1, `CampaignsPanel.tsx`) : au plus une
 * campagne par monde desormais — les outils qui en dependent (probabilites/
 * rencontres/initiative) ne portent donc jamais de selecteur de campagne
 * ici, contrairement aux anciennes pages qui geraient encore un `?campagne=`
 * pour d'anciens mondes multi-campagnes (cas hors perimetre de ce ticket,
 * jamais cree par l'application depuis V2-G1).
 */
export type MjToolWindowData =
  | { tool: "chat"; campaignId: string | null }
  | {
      tool: "gestion-campagne";
      defaultRulesetId: string | null;
      campaigns: CampaignSummaryView[];
      worldEntities: { id: string; name: string }[];
      grantableEntities: { id: string; name: string }[];
      canUseSoloMode: boolean;
      canManage: boolean;
    }
  | { tool: "journal-historique"; isGm: boolean }
  | { tool: "probabilites"; hasCampaign: boolean; party: PartyMemberProbabilities[] }
  | {
      tool: "rencontres";
      hasCampaign: boolean;
      campaignId: string | null;
      budgetTable: EncounterBudgetRow[] | null;
      budgetIsFallback: boolean;
      monsters: EncounterMonsterSummary[];
      savedEncounters: CampaignEncounterRow[];
    }
  | {
      tool: "initiative";
      hasCampaign: boolean;
      campaignId: string | null;
      initialCombat: CombatDetail | null;
      savedCombats: CombatRow[];
      pcOptions: { id: string; name: string }[];
      monsters: EncounterMonsterSummary[];
      conditions: string[];
    }
  | { tool: "creation-personnage"; worldId: string }
  | { tool: "calendrier"; calendar: CalendarConfigInput }
  | { tool: "personnalisation"; mode: string; contrast: string; backgroundRef: string; backgroundAvailableModes: string[]; bgBlur: number }
  | { tool: "regles-actives" }
  | { tool: "publication"; worldId: string; links: ShareLinkSummary[]; wikiWelcomeMessage: string }
  | { tool: "generateurs"; entityId: string; tools: GeneratorToolWindowData[] };

export function isMjToolWindowData(data: unknown): data is MjToolWindowData {
  return !!data && typeof data === "object" && "tool" in data;
}
