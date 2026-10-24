"use client";

import { useTranslations } from "next-intl";
import type { MjToolWindowData } from "./mjToolWindows";
import CampaignsPanel from "./CampaignsPanel";
import ChatThreadsPanel from "./ChatThreadsPanel";
import JournalEtCorbeille from "./journal/JournalEtCorbeille";
import PartyProbabilityTable from "./PartyProbabilityTable";
import EncounterBuilder from "./EncounterBuilder";
import InitiativeTracker from "./InitiativeTracker";
import OutilTable from "./OutilTable";
import CalendarSettingsPanel from "./CalendarSettingsPanel";
import PersonnalisationPanel from "./PersonnalisationPanel";
import PublicationPanel from "./PublicationPanel";
import GeneratorToolPanel from "./GeneratorToolPanel";
import NotebookWorkspace from "./notebook/NotebookWorkspace";
import SchedulingMjPanel from "./scheduling/SchedulingMjPanel";
import SessionJournalMjPanel from "./sessionJournal/SessionJournalMjPanel";
import ReglesActivesPanel from "@/components/rules/ReglesActivesPanel";
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
  const tInitiative = useTranslations("initiative");
  switch (data.tool) {
    case "chat":
      return (
        <div className="flex h-full flex-col gap-4">
          <h1 className="block-title text-base">Chat</h1>
          <ChatThreadsPanel worldSlug={worldSlug} campaignId={data.campaignId} />
        </div>
      );

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
      return data.isGm ? <JournalEtCorbeille worldSlug={worldSlug} /> : <p className="text-sm text-ink-muted">Réservé au MJ de ce monde.</p>;

    case "probabilites":
      return <PartyProbabilityTable party={data.party} hasCampaign={data.hasCampaign} />;

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
              party={data.party}
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
            <h1 className="block-title text-base">{tInitiative("titre")}</h1>
            <p className="text-xs text-ink-muted">{tInitiative("description")}</p>
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
            <p className="text-sm italic text-ink-muted">{tInitiative("aucuneCampagne")}</p>
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
      return <ReglesActivesPanel worldSlug={worldSlug} data={data} />;

    case "publication":
      return <PublicationPanel worldSlug={worldSlug} publication={data} />;

    case "generateurs":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="block-title text-base">Générateurs</h1>
            <p className="text-xs text-ink-muted">
              Composez taverne, échoppe ou PNJ section par section — chaque emplacement se relance individuellement.
            </p>
          </div>
          <GeneratorToolPanel worldSlug={worldSlug} tools={data.tools} />
        </div>
      );

    case "notes":
      return (
        <div className="flex h-full flex-col gap-4">
          <h1 className="block-title text-base">Bloc-notes</h1>
          <div className="min-h-0 flex-1">
            <NotebookWorkspace worldSlug={worldSlug} initial={data} isGm sessionPrepTemplate />
          </div>
        </div>
      );

    case "calendrier-reel":
      return (
        <div className="flex flex-col gap-4">
          <h1 className="block-title text-base">Calendrier réel</h1>
          {data.campaignId ? <SchedulingMjPanel campaignId={data.campaignId} /> : <p className="text-sm italic text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>}
        </div>
      );

    case "table":
      return <OutilTable worldSlug={worldSlug} campaignId={data.campaignId} party={data.party} conditions={data.conditions} />;

    case "livre-de-sessions":
      return (
        <div className="flex flex-col gap-4">
          <h1 className="block-title text-base">Livre de sessions</h1>
          {data.campaignId ? (
            <SessionJournalMjPanel campaignId={data.campaignId} worldSlug={worldSlug} currentUserId={data.currentUserId} initialCalendar={data.calendar} />
          ) : (
            <p className="text-sm italic text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>
          )}
        </div>
      );
  }
}
