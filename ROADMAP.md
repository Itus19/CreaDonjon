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
- [x] Créer une entité dans un monde, page de fiche d'entité (affichage)
- [x] Ajouter un bloc à une entité (type libre, contenu, visibilité)
- [x] Alias en étiquettes (ajout/suppression)
- [x] Relations entre entités : étiquettes cliquables (dans les deux sens), formulaire de création — première UI pour la table `relations`
- [ ] Éditer/supprimer une entité ou un bloc existant (seule la création marche pour l'instant)
- [~] Blocs modulaires : système générique en place (`data.content` texte libre) ; pas encore d'éditeurs dédiés par type (personnage, inventaire, biologie...)
- [ ] Éditeur de `narrative_content` avec segments de visibilité (distinct des blocs, pas commencé)
- [ ] Liens automatiques dans le texte (détection de mentions/alias) — question ouverte non résolue dans le PDD (faux positifs)
- [ ] Graphe de connaissances (visualisation des `relations`, au-delà des étiquettes)
- [ ] Historique des modifications d'une fiche
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
- [ ] Compendium : page de consultation des `ruleset_entries` (sorts/classes/monstres...) — inspiré du `CompendiumPortal` du prototype antigravity, rien construit encore pour parcourir les 3653 entrées SRD déjà importées

## Assistant IA

- [ ] Génération contextuelle de texte (continuer un champ en cours d'écriture)
- [ ] Recherche de contexte minimal (n'envoyer que les données pertinentes au modèle)
- [ ] IA comme MJ (mode solo)
- [ ] Aide à la structuration de règles (langage naturel → JSON)
- [ ] Génération de contenu (PNJ, lieux, objets, rencontres...)

## Design / Présentation

- [x] Direction artistique définie (références fournies : vvd.world, Alchemy RPG, Daggerheart — dark/chaleureux, accent doré)
- [x] Palette de couleurs (fond/surface/accent/danger) centralisée en CSS, typographie par défaut (Geist)
- [x] Classes utilitaires réutilisables (`.card`, `.form-card`, `.chip`, `.btn-accent`, `.btn-outline`, `.input-field`) — début de design system
- [~] Présentation de fiche d'entité alignée sur les références (alias/relations en étiquettes, portrait réservé) ; pas encore : texte enrichi, liens automatiques, mise en page façon vvd.world (barre latérale par catégories)
- [x] 4 thèmes sélectionnables (sombre/demi-sombre/demi-clair/clair), mémorisés par cookie — global à l'app pour l'instant, pas encore par monde comme chez vvd.world
- [x] Bureau à fenêtres pour les fiches d'entité (glisser/redimensionner/agrandir/fermer, plusieurs fenêtres simultanées, aimantation gauche/droite façon Aero Snap) — inspiré du prototype antigravity, réimplémenté contre notre schéma
- [x] Esthétique verre (glassmorphism) sur les fenêtres/cartes, fond immersif flouté en CSS pur, police d'affichage "Outfit", étiquettes de relation colorées différemment entrant/sortant — d'après l'examen détaillé du CSS du prototype antigravity
- [ ] Barre latérale de navigation par catégories (comme vvd.world)
- [ ] Tableau de bord d'accueil (récents, création rapide, aperçu du graphe)

## Plus tard (V2+, hors scope court terme)

Pas commencé, volontairement reporté — voir le PDD section 22 pour le détail :

- [ ] Simulation procédurale du monde
- [ ] Cartographie
- [ ] Immersion audiovisuelle (musique adaptative)
- [ ] Collaboration multi-MJ
