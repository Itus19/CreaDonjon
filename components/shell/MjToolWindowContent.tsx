"use client";

import type { MjToolWindowData } from "./mjToolWindows";
import CampaignsPanel from "./CampaignsPanel";
import GmJournalPanel from "./GmJournalPanel";
import PartyProbabilityTable from "./PartyProbabilityTable";
import EncounterBuilder from "./EncounterBuilder";
import InitiativeTracker from "./InitiativeTracker";
import CalendarSettingsPanel from "./CalendarSettingsPanel";
import PersonnalisationPanel from "./PersonnalisationPanel";
import PublicationPanel from "./PublicationPanel";
import RulesetSelector from "@/components/rules/RulesetSelector";
import CharacterCreatorWizard from "@/components/blocks/CharacterCreatorWizard";

const NO_CAMPAIGN_MESSAGE = "Aucune campagne dans ce monde — créez-en une dans l'onglet Campagnes.";

/**
 * Contenu d'une fenetre d'outil MJ secondaire (`avec=outil:...`, retour
 * utilisateur V2-M7 suite) — meme role que le `isEntityWindowData` ternaire
 * de `WindowsDesktop.tsx` pour entite/regle, mais neuf branches plutot que
 * deux : un seul point de dispatch pour tous les outils MJ, base sur
 * `data.tool` (recupere via `GET /api/worlds/[worldSlug]/mj/[tool]/window`).
 * Chaque branche reutilise EXACTEMENT le meme composant client que la page
 * routee correspondante (`app/m/[worldSlug]/mj/[tool]/page.tsx`) — jamais
 * une deuxieme implementation.
 */
export default function MjToolWindowContent({ worldSlug, data }: { worldSlug: string; data: MjToolWindowData }) {
  switch (data.tool) {
    case "gestion-campagne":
      return (
        <CampaignsPanel
          worldSlug={worldSlug}
          defaultRulesetId={data.defaultRulesetId}
          initialCampaigns={data.campaigns}
          worldEntities={data.worldEntities}
          grantableEntities={data.grantableEntities}
          canUseSoloMode={data.canUseSoloMode}
          canManage={data.canManage}
        />
      );

    case "journal-historique":
      return data.isGm ? <GmJournalPanel worldSlug={worldSlug} /> : <p className="text-sm text-ink-muted">Réservé au MJ de ce monde.</p>;

    case "probabilites":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="block-title text-base">Probabilités de réussite</h1>
            <p className="text-xs text-ink-muted">
              Probabilité de réussir un jet de compétence à DD 10, 15 et 20, pour chaque personnage joueur de la
              campagne.
            </p>
          </div>
          {data.hasCampaign ? (
            <PartyProbabilityTable party={data.party} />
          ) : (
            <p className="text-sm italic text-ink-muted">{NO_CAMPAIGN_MESSAGE}</p>
          )}
        </div>
      );

    case "rencontres":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="block-title text-base">Générateur de rencontres</h1>
            <p className="text-xs text-ink-muted">
              Composez une rencontre depuis le catalogue de monstres du ruleset, ou laissez le solveur en proposer
              une pour le budget choisi.
            </p>
          </div>
          {data.hasCampaign && data.campaignId ? (
            <EncounterBuilder
              worldSlug={worldSlug}
              campaignId={data.campaignId}
              budgetTable={data.budgetTable}
              budgetIsFallback={data.budgetIsFallback}
              monsters={data.monsters}
              initialSavedEncounters={data.savedEncounters}
            />
          ) : (
            <p className="text-sm italic text-ink-muted">{NO_CAMPAIGN_MESSAGE}</p>
          )}
        </div>
      );

    case "initiative":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="block-title text-base">Initiative</h1>
            <p className="text-xs text-ink-muted">
              Suivez l&apos;ordre du tour, les points de vie et les conditions d&apos;un combat.
            </p>
          </div>
          {data.hasCampaign && data.campaignId ? (
            <InitiativeTracker
              worldSlug={worldSlug}
              campaignId={data.campaignId}
              initialCombat={data.initialCombat}
              savedCombats={data.savedCombats}
              pcOptions={data.pcOptions}
              monsters={data.monsters}
              conditions={data.conditions}
            />
          ) : (
            <p className="text-sm italic text-ink-muted">{NO_CAMPAIGN_MESSAGE}</p>
          )}
        </div>
      );

    case "creation-personnage":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="block-title text-base">Création de personnage</h1>
            <p className="text-xs text-ink-muted">
              Composez un personnage étape par étape en suivant les règles du monde, puis créez sa fiche.
            </p>
          </div>
          <CharacterCreatorWizard worldSlug={worldSlug} worldId={data.worldId} />
        </div>
      );

    case "calendrier":
      return <CalendarSettingsPanel worldSlug={worldSlug} initialCalendar={data.calendar} />;

    case "personnalisation":
      return (
        <PersonnalisationPanel
          currentMode={data.mode}
          currentContrast={data.contrast}
          currentBackgroundRef={data.backgroundRef}
          currentBackgroundAvailableModes={data.backgroundAvailableModes}
          currentBgBlur={data.bgBlur}
        />
      );

    case "regles-actives":
      return (
        <div className="flex flex-col gap-4">
          <h1 className="block-title text-lg">Règles actives</h1>
          <RulesetSelector worldSlug={worldSlug} />
        </div>
      );

    case "publication":
      return (
        <PublicationPanel
          worldId={data.worldId}
          worldSlug={worldSlug}
          initialLinks={data.links}
          initialWikiWelcomeMessage={data.wikiWelcomeMessage}
        />
      );
  }
}
