# ROADMAP — Où en est le projet

**Dernier audit :** 8 septembre 2026 — état vérifié contre le dépôt, module par module, pas recopié des backlogs.

Ce document répond à une seule question : **qu'est-ce qui existe déjà ?** Il complète `docs/PDD.md` (le pourquoi) et `docs/SCHEMA.md` (la forme des données).

**Ce qu'il n'est pas :** une liste de tickets. Les tickets, avec leurs critères d'acceptation et le récit de ce qui a été trouvé en les faisant, vivent dans `docs/BACKLOG.md` (Phase 0 et V0), `docs/BACKLOG_V1.md` et `docs/BACKLOG_V2.md`. En cas de désaccord, **le backlog fait foi sur un ticket précis, ce document fait foi sur la vue d'ensemble.**

**À maintenir à jour** à la fin d'un lot, pas à chaque commit. Un tableau de bord faux coûte plus cher que pas de tableau de bord : il fait rouvrir du travail déjà fait.

**Statuts :** `[x]` fait · `[~]` partiel, avec ce qui manque · `[ ]` pas commencé

---

## En un coup d'œil

| Version | État | Où |
|---|---|---|
| Phase 0 et V0 | **terminée** | `docs/BACKLOG.md` |
| V1 | **terminée** | `docs/BACKLOG_V1.md` |
| V2 | **en cours, presque close** — voir ci-dessous | `docs/BACKLOG_V2.md` |
| V3 | **ouverte, aucun ticket commencé.** Spike S1 fait, verdict rendu : repli sur le MJ assisté (`docs/adr/0009-viabilite-solo.md`) | `docs/BACKLOG_V3.md` |

### Ce qui reste avant de fermer la V2

Tous les lots (G, H, I, J, K, L, M) sont livrés. Ne restent que trois choses, dont deux ne dépendent pas du code :

1. **Le critère de fin lui-même** — mener une séance complète avec sa table sans ouvrir aucun autre outil. Se vérifie en jouant, pas en cochant.
2. **V2-M8** — trois critères multi-comptes qui attendent qu'un ami rejoigne réellement une copie de monde. Le mécanisme est en place et lu ; rien à écrire.
3. **Les quatre critères finaux de V2-I1** (cartes) — jamais formellement repassés après les phases A→F₂, qui sont toutes livrées et vérifiées en direct une à une.

---

## Général et infrastructure

- [x] Schéma complet, RLS sur toutes les tables, refus par défaut — Phase 0
- [x] Authentification, profils, membres de monde et de campagne, rôle superadmin — V0, V1-C2, V2-M2
- [x] Résolution de visibilité **côté serveur** : blocs, segments, relations, punaises, zones, couches, assets — V0-04, V1, V2-I1
- [x] Recherche globale ⌘K (`search_fr`, insensible aux accents, filtrée par visibilité) — V0-06
- [x] Stockage de fichiers hors base, derrière une interface (`src/server/services/storage.ts`) — V2-L1, V2-I1 phase A
- [x] Lien de partage public sans compte, avec alias court — V1, V2-M10
- [x] Export, import et duplication d'un monde en JSON (lore seul, ruleset personnel jamais exporté) — V2-G1
- [x] Provisioning de comptes invités, journal MJ, octroi d'édition par fiche, « voir comme » — V2-M
- [x] Hébergement Vercel + Supabase — ADR 0012
- [~] **Détection de liens par alias.** Le noyau est fait et testé (`src/core/linker/detect.ts`, V0-05 : correspondance la plus longue, frontières de mots, ambiguïtés signalées, jamais résolues au hasard). **Ce qui manque est le branchement** : rien n'appelle `detectEntityReferences` dans l'éditeur, aucune proposition de lien pendant la saisie, et `entity_mentions` n'est écrite nulle part. C'est le chantier ouvert le plus avancé.
- [ ] **Révisions mécaniques.** `entity_mechanical_revisions` n'est touchée que par l'export/import de monde. Rien n'en crée en usage normal, rien ne les consulte — alors que `campaign_entity_snapshots` est bâtie dessus.

## Wiki

- [x] Fiches, types d'entité libres, arborescence par catégorie, fenêtres flottantes avec URL — V0
- [x] Blocs typés : 21 types au registre (`src/core/schemas/blocks/registry.ts`), enveloppe commune, visibilité par bloc
- [x] Texte enrichi, bulle de mise en forme, segments à visibilité propre. La marque `spoiler` est de la mise en forme, jamais de la sécurité
- [x] Réorganisation des blocs par glisser-déposer, au clavier et au tactile — V2-G1
- [x] Portraits téléversés, servis par URL signée après vérification de visibilité — V2-I1 phase F₂
- [x] Historique des révisions et comparateur — V1-C3
- [x] Généalogie, graphe de relations, chronologie et calendrier de monde — V2-H2, V2-H3
- [x] Psyché : personnalité, convictions, relations dirigées, attitudes journalisées en ajout seul — V2-H1
- [x] Quêtes et journal de séance — V2-H4
- [x] Cartes : fiche `carte`, punaises, zones, couches, mode référence, brouillard par campagne — V2-I1, V2-I2
- [x] Musique — V2-G3
- [ ] Proposition de lien pendant la saisie — voir la détection de liens ci-dessus
- [ ] **Wiki progressif.** `entity_discoveries` existe depuis la Phase 0 et n'est écrite nulle part : rien ne suit ce qu'un joueur a découvert. C'est un préalable du mode solo, pas un manque de la V2

## Moteur de règles

- [x] SRD 5.1 et 5.2.1 importés, traductions françaises, attribution CC-BY conservée — `NOTICE.md`
- [x] Mini-langage de formules : AST, parser fermé, aucun `eval`, RNG injecté côté serveur — V1-A1
- [x] Fiche dérivée à sept couches de modificateurs, jamais stockée — V1-B
- [x] Surcharge et héritage de rulesets, variantes, protection des bases officielles, ruleset actif dans les Réglages — V1-A4, V1-D4, V2-K6
- [x] Blocs de règles typés, éditeur assisté, import JSON de règles — V1-D, V2-J4
- [x] Compendium : catégories, recherche, fiche de détail
- [x] Fiche jouable : actions, repos, inventaire, magie, traits, dés de vie, bourse — V1-C
- [x] Assistant de création de personnage et montée de niveau accompagnée (ASI, jets de dé de vie, maîtrise d'armes) — V2-G1
- [ ] **Déclencheurs** « quand X, alors Y » — conception arrêtée (`specs/moteur-de-jeu.md` §4), six tickets V3-A1 à V3-A6 déjà dimensionnés
- [ ] Économie d'action et état de scène — V3-A3, V3-A4

## Maître du jeu

- [x] Campagnes, invitations nominatives ou ouvertes, coquille joueur allégée — V1-C2, V2-M4
- [x] Générateurs composés : Taverne, PNJ, Noms, Échoppe, Butin, avec tirage filtré par palier — lot J
- [x] Tables aléatoires comme blocs, tirages imbriqués bornés, attribution d'auteur — V2-J
- [x] Générateur de rencontres, budget de difficulté lu dans le ruleset, suivi d'initiative, application de dégâts — V1-E3, V2-G1
- [x] Volet de lancer de dés, en temps réel — V2-M11
- [x] Assistant de préparation de séance — V2-J3
- [~] Collaboration entre MJ amis : le mécanisme est en place, aucun ami n'a encore rejoint — V2-M8

## Joueur

- [x] Rejoindre une campagne par lien, avec compte
- [x] Créer son personnage, tenir sa fiche jouable
- [x] Consulter le wiki et les cartes filtrés par visibilité
- [ ] Compagnon en direct pendant la partie (suivi des fiches, combat partagé) — V3, `specs/module-joueur-et-solo.md` partie A

## Assistant IA

Le blocage de 2026-07 est levé : `AiProvider` existe, un fournisseur local est branché, et rien ne s'appelle hors de `src/server/ai/`.

- [x] `AiProvider` et ses adaptateurs, limite de débit, `ai_usage_log` écrit à chaque appel, y compris en échec
- [x] `ai_proposals` : l'IA n'écrit jamais en base, toute mutation passe par une proposition validée puis appliquée ou rejetée
- [x] Assistance à l'écriture, éditeur de règles assisté, prose des générateurs
- [x] Encadrement du contenu de wiki comme donnée, jamais comme instruction (`fenceUntrustedData`)
- [x] Spike solo S1 : mesures dans le budget, cohérence narrative insuffisante → **repli sur le MJ assisté**, ADR 0009
- [ ] Contexte déterministe d'un tour (`listActiveQuestsForWorld` est écrite et n'a aucun appelant) — V3
- [ ] RAG et mémoire longue : `chunks` et `embedding_queue` existent, aucune indexation faite. La dimension d'embedding doit être figée avant la première — V3
- [ ] Réglages de récit (ton, rythme, influences) — voir `docs/analyse-prompt-origine.md` §4

## Design et présentation

- [x] Jetons OKLCH, quatre thèmes, esthétique verre, fond immersif
- [x] Fond personnalisable par téléversement et thème dérivé de l'image — V2-G4
- [x] Bureau à fenêtres, sidebar unifiée, réduction en onglets, réglages à onglets — lot K
- [x] Écran d'accueil en trois colonnes, mondes et rôle dans chacun — V2-M5, V2-M7c
- [x] Menus déroulants et combobox propres, rendus par portail

## Pas commencé

Volontairement, et dans cet ordre de vraisemblance :

- [ ] Mode solo ou MJ assisté, sous la forme retenue par l'ADR 0009 — V3
- [ ] Monde autonome : factions qui évoluent hors champ, quêtes qui expirent — `docs/analyse-prompt-origine.md` §7
- [ ] Passage à l'application locale — `specs/cible-locale-et-ia.md` §6, « local seul » ou « local d'abord » reste ouvert
- [ ] Génération procédurale de cartes
- [ ] Simulation procédurale du monde

---

## Note sur cet audit

La version précédente de ce document datait du 29 juillet 2026 et était restée figée avant la V1. Elle annonçait comme « pas commencé » le stockage de fichiers, le lien de partage sans compte, les blocs structurés, la généalogie, l'historique des fiches, les générateurs, l'initiative, la cartographie et l'assistant IA — tous livrés depuis. Elle portait aussi un audit d'écart avec un prototype antérieur, référençant des chemins d'une autre machine ; cette section est retirée, elle reste consultable dans l'historique Git.

Deux constats de cet audit ne venaient d'aucun backlog et méritent un ticket à eux seuls : la détection de liens jamais branchée, et les révisions mécaniques qu'aucun code n'écrit.
