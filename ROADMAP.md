# ROADMAP — Suivi des fonctionnalités

Ce document liste les fonctionnalités du projet, organisées par module, avec leur état d'avancement. Il complète `Project_Design_Document_v0.1.md` (la vision et les principes) et `Phase0_Schema_Technique_v0_1.md` (le schéma de données) : ceux-là expliquent *pourquoi* et *comment*, celui-ci répond juste à *où on en est*.

**À maintenir à jour** à chaque fonctionnalité ajoutée, commencée ou terminée — comme le PDD, ce n'est pas figé.

Statuts : `[x]` fait · `[~]` en cours / partiel · `[ ]` pas commencé

---

## Général / Infrastructure

- [x] Dépôt GitHub connecté et utilisé (push direct sur `master`)
- [x] Projet Supabase créé et lié en local (CLI)
- [x] Schéma de données de base : `worlds`, `entities`, `blocks`, `relations`, `rulesets`, `ruleset_entries`, `entity_mechanical_revisions`, `campaigns`, `campaign_members`, `campaign_entity_snapshots`
- [x] RLS (sécurité au niveau des lignes) sur toutes les tables liées aux mondes/campagnes : lecture par accès au monde, écriture réservée au propriétaire pour l'instant
- [x] Import du contenu des SRD D&D 2014 et 2024 dans `rulesets`/`ruleset_entries`
- [x] App Next.js initialisée (TypeScript, App Router, Tailwind)
- [x] Authentification par email/mot de passe (inscription, confirmation email, connexion, déconnexion)
- [ ] Résolution de visibilité côté serveur pour `narrative_content`/blocs (public/joueurs/MJ/privé) — la donnée existe dans le schéma mais rien ne la lit/filtre encore à l'affichage
- [ ] Stockage de fichiers/images (Supabase Storage)
- [ ] Recherche globale (noms, alias, tags, contenu)
- [ ] Détection automatique de liens entre fiches (alias)
- [ ] Lien de partage du wiki sans compte, en lecture seule (PDD 4.2) — nécessite un mécanisme à jeton, distinct de l'auth actuelle

## Wiki (fiches et base de connaissances)

- [x] Page de création d'un monde
- [x] Liste des mondes d'un utilisateur (sur la page d'accueil)
- [ ] Page de fiche d'entité (affichage)
- [ ] Édition d'une fiche d'entité
- [ ] Blocs modulaires configurables dans l'UI (personnage, inventaire, biologie, etc.)
- [ ] Éditeur de `narrative_content` avec segments de visibilité
- [ ] Liens automatiques / bidirectionnels entre fiches
- [ ] Historique des modifications d'une fiche
- [ ] Graphe de connaissances (visualisation des `relations`)
- [ ] Import/export de contenu

## Maître du Jeu (MJ)

- [x] Compte de test créé manuellement dans Supabase (temporaire, à remplacer par le flux normal)
- [x] Créer un monde (UI), avec choix du système de règles par défaut (2014 / 2024)
- [ ] Modifier le système de règles d'un monde après sa création
- [ ] Modifier/dériver un système de règles (variante liée par `parent_ruleset_id`)
- [ ] Créer une campagne, inviter des joueurs
- [ ] Créer des personnages et PNJ
- [ ] Gérer les secrets et la visibilité par bloc
- [ ] Générateurs (noms, rencontres, PNJ) — IA
- [ ] Préparer des rencontres, gérer l'initiative
- [ ] Partager un lien de wiki en lecture seule

## Joueur

- [ ] Rejoindre une campagne via invitation/lien (avec compte)
- [ ] Créer son personnage dans une campagne
- [ ] Consulter les règles et le wiki autorisés (filtrés par visibilité)
- [ ] Consulter les cartes autorisées (dépend du module Cartographie, non commencé)

## Jeu solo

- [ ] Choisir/configurer un système de règles
- [ ] Créer son personnage
- [ ] Définir des préférences d'aventure
- [ ] Boucle de jeu textuelle avec l'IA comme MJ
- [ ] Wiki progressif (le joueur découvre le monde au fil du jeu)

## Moteur de règles

- [x] Import brut des SRD 2014/2024 (`rulesets` + `ruleset_entries`, vue structurée = enregistrement source complet)
- [ ] Mini-langage de formules : parser fermé (grammaire section 12 du schéma technique), jamais d'`eval()`
- [ ] Éditeur de règles : langage naturel → structure via IA
- [ ] Versionnage/héritage utilisé en pratique dans l'UI (`parent_ruleset_id` existe en base, pas encore exploité)
- [ ] Révisions mécaniques d'entité utilisées en pratique (`entity_mechanical_revisions` existe en base, pas encore exploité)

## Assistant IA

- [ ] Génération contextuelle de texte (continuer un champ en cours d'écriture)
- [ ] Recherche de contexte minimal (n'envoyer que les données pertinentes au modèle)
- [ ] IA comme MJ (mode solo)
- [ ] Aide à la structuration de règles (langage naturel → JSON)
- [ ] Génération de contenu (PNJ, lieux, objets, rencontres...)

## Plus tard (V2+, hors scope court terme)

Pas commencé, volontairement reporté — voir le PDD section 22 pour le détail :

- [ ] Simulation procédurale du monde
- [ ] Cartographie
- [ ] Immersion audiovisuelle (musique adaptative)
- [ ] Collaboration multi-MJ
