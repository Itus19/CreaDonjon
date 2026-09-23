import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rapport genere par `npm run test:coverage`, jamais suivi par Git.
    "coverage/**",
    // Worktrees Git poses par les sessions d'agent (`.git/info/exclude` les
    // cache deja a Git, mais ESLint parcourt le disque, pas l'index) : ce
    // sont des COPIES du depot, avec leur propre `eslint.config.mjs`. Sans
    // cette ligne, `npm run lint` verifie le projet une fois par worktree
    // ouvert — et une regle de chemin comme le confinement du client
    // service-role (`src/server/services/accountProvisioning.ts`) ne
    // reconnait plus le fichier confine sous son prefixe de worktree, donc
    // echoue sur du code pourtant conforme.
    ".claude/worktrees/**",
  ]),
  // src/core est un noyau pur (CLAUDE.md, regle absolue 14) : aucun import
  // de framework ni de reseau. Verifie mecaniquement, pas seulement par
  // convention.
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message: "src/core est un noyau pur : aucun import de next.",
            },
            {
              group: ["react", "react/*", "react-dom", "react-dom/*"],
              message: "src/core est un noyau pur : aucun import de react.",
            },
            {
              group: ["@supabase/*", "@supabase/**"],
              message: "src/core est un noyau pur : aucun import de @supabase.",
            },
          ],
        },
      ],
    },
  },
  // Le client service-role (lib/supabase/service.ts) contourne TOUTE la
  // RLS : confine a src/server/services/publicShare.ts (CLAUDE.md, regle
  // absolue 4 ter). Verifie mecaniquement (V1 D-01), pas seulement par le
  // commentaire en tete de service.ts.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/server/services/publicShare.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*/lib/supabase/service", "@/lib/supabase/service", "./service", "../service"],
              message:
                "Le client service-role est confine a src/server/services/publicShare.ts (CLAUDE.md regle 4 ter). Passe par les fonctions exportees de ce fichier plutot que de construire ce client ici.",
            },
          ],
        },
      ],
    },
  },
  // Deuxieme trou confine, meme discipline (docs/adr/0015-provisioning-comptes-invites.md) :
  // creation de comptes invites (V2-M4), jamais reutilise le premier trou
  // (portee differente : lecture de partage public seulement).
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/server/services/accountProvisioning.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "*/lib/supabase/serviceAccountProvisioning",
                "@/lib/supabase/serviceAccountProvisioning",
                "./serviceAccountProvisioning",
                "../serviceAccountProvisioning",
              ],
              message:
                "Le client service-role de provisioning est confine a src/server/services/accountProvisioning.ts (docs/adr/0015-provisioning-comptes-invites.md). Passe par les fonctions exportees de ce fichier plutot que de construire ce client ici.",
            },
          ],
        },
      ],
    },
  },
  // V2.1-27 — PLANCHER DE 12 px SUR LES TAILLES DE TEXTE.
  //
  // `docs/CHARTE-UI.md` §4 le dit depuis la V2 : « Rien en dessous de
  // `text-xs` ». La regle y ajoutait la bonne politique — convertir un
  // ecran quand on le rouvre, surtout pas de passe globale — et cette
  // politique ne tient pas toute seule : la charte comptait 209
  // occurrences, il y en avait 227 le 23 septembre. Personne n'en ajoute
  // par defi : on recopie le composant d'a cote.
  //
  // D'ou cette regle, qui n'interdit que les NOUVELLES. Les fichiers
  // existants sont exemptes NOMMEMENT, et cette liste ne peut que
  // raccourcir : y ajouter un nom demande de le dire en revue, ce qui est
  // exactement la conversation qu'on veut avoir.
  //
  // ATTENTION EN MODIFIANT CETTE LISTE : un chemin de route Next porte des
  // `[segments]` et des `(groupes)`, qui sont des caracteres de GLOB. Sans
  // les echapper, l'exemption ne matche pas le fichier qu'elle nomme — et
  // elle ne le dit pas : elle ne fait rien. Constate le 23 septembre, deux
  // fichiers pourtant listes remontaient trois erreurs.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
        "app/WorldCardActions.tsx",
        "app/m/\\[worldSlug\\]/\\(monde\\)/f/\\[entitySlug\\]/EditEntityForm.tsx",
        "app/m/\\[worldSlug\\]/\\(monde\\)/page.tsx",
        "components/blocks/ActionsTab.tsx",
        "components/blocks/CharacterCreatorWizard.tsx",
        "components/blocks/EntityBlocks.tsx",
        "components/blocks/GeneratorBlockEditor.tsx",
        "components/blocks/ImageBlockEditor.tsx",
        "components/blocks/InventoryPanel.tsx",
        "components/blocks/ItemAutocomplete.tsx",
        "components/blocks/MagicTab.tsx",
        "components/blocks/MasteriesTab.tsx",
        "components/blocks/MonsterStatblockSheet.tsx",
        "components/blocks/PlayableCharacterSheet.tsx",
        "components/blocks/SpellcastingBlockEditor.tsx",
        "components/blocks/TraitsTab.tsx",
        "components/blocks/characterCreatorSteps/AbilityScoreStep.tsx",
        "components/blocks/characterCreatorSteps/BackgroundStep.tsx",
        "components/blocks/characterCreatorSteps/LevelClassesStep.tsx",
        "components/blocks/characterCreatorSteps/RemainingChoicesStep.tsx",
        "components/blocks/characterCreatorSteps/SpeciesStep.tsx",
        "components/blocks/characterCreatorSteps/SpellSelectionStep.tsx",
        "components/entities/PortraitUpload.tsx",
        "components/entities/psyche/PersonalityEventTable.tsx",
        "components/entities/psyche/PersonalityPoleSliders.tsx",
        "components/entities/psyche/PersonalityRadar.tsx",
        "components/entities/psyche/RelationshipAxisSliders.tsx",
        "components/entities/psyche/RelationshipEventTable.tsx",
        "components/entities/psyche/RelationshipRadar.tsx",
        "components/entities/psyche/WorldviewEventTable.tsx",
        "components/entities/psyche/WorldviewPoleSliders.tsx",
        "components/entities/psyche/WorldviewRadar.tsx",
        "components/entities/public/PublicBlockView.tsx",
        "components/entities/public/PublicSouvenirsTable.tsx",
        "components/entities/public/RefPreviewLayer.tsx",
        "components/entities/richtext/RefLinkPopover.tsx",
        "components/entities/timeline/TimelineAxis.tsx",
        "components/rules/CreateHomebrewWeaponForm.tsx",
        "components/rules/ModifiedBlockBadge.tsx",
        "components/rules/MonsterRollButton.tsx",
        "components/rules/PlayerRulesSidebar.tsx",
        "components/rules/RuleEntryView.tsx",
        "components/rules/RulesSidebar.tsx",
        "components/rules/RulesetSelector.tsx",
        "components/rules/blockContentRenderer.tsx",
        "components/rules/layouts/ProgressionTable.tsx",
        "components/rules/layouts/Table.tsx",
        "components/shared/GameDateInput.tsx",
        "components/shared/InfoTags.tsx",
        "components/shell/AdminPanel.tsx",
        "components/shell/AvecWindowsLayer.tsx",
        "components/shell/CampaignDetail.tsx",
        "components/shell/ChatPanel.tsx",
        "components/shell/ChatThreadsPanel.tsx",
        "components/shell/DiceRollPanel.tsx",
        "components/shell/DiceStatsPanel.tsx",
        "components/shell/EncounterBuilder.tsx",
        "components/shell/EntityTree.tsx",
        "components/shell/GmJournalPanel.tsx",
        "components/shell/HomeScreen.tsx",
        "components/shell/HomeShell.tsx",
        "components/shell/InitiativeTracker.tsx",
        "components/shell/MjSidebar.tsx",
        "components/shell/PartyProbabilityTable.tsx",
        "components/shell/PlayerShell.tsx",
        "components/shell/ShareLinkPanel.tsx",
        "components/shell/WindowFrame.tsx",
        "components/shell/WorldTimelineView.tsx",
        "components/shell/notebook/NotebookWorkspace.tsx",
        "components/shell/scheduling/AvailabilityCalendar.tsx",
        "components/shell/scheduling/SchedulingMjPanel.tsx",
        "components/shell/sessionJournal/SessionJournalMjPanel.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/text-\\[(?:[0-9]|1[01])px\\]/]",
          message:
            "Plancher de 12 px (CHARTE-UI.md §4) : `text-xs` est la plus petite taille de texte du produit. Un libelle qui n'y tient pas est trop long, pas trop gros. Pour un GLYPHE plutot qu'un texte, sortir la classe en constante et y poser un `eslint-disable-next-line` motive (voir components/shared/Stepper.tsx).",
        },
        {
          selector: "TemplateElement[value.raw=/text-\\[(?:[0-9]|1[01])px\\]/]",
          message:
            "Plancher de 12 px (CHARTE-UI.md §4), meme dans un gabarit de chaine. Voir le message ci-dessus.",
        },
      ],
    },
  },
]);

export default eslintConfig;
