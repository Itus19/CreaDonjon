# ROADMAP — Suivi des fonctionnalités

Ce document liste les fonctionnalités du projet, organisées par module, avec leur état d'avancement. Il complète `Project_Design_Document_v0.1.md` (la vision et les principes) et `Phase0_Schema_Technique_v0_1.md` (le schéma de données) : ceux-là expliquent *pourquoi* et *comment*, celui-ci répond juste à *où on en est*.

**À maintenir à jour** à chaque fonctionnalité ajoutée, commencée ou terminée — comme le PDD, ce n'est pas figé.

Statuts : `[x]` fait · `[~]` en cours / partiel · `[ ]` pas commencé

---

## Écarts avec le prototype antigravity, par priorité

Audit du code de `C:\Users\Gabriel\.gemini\antigravity\scratch\dnd-companion` (2026-07-28) : ce qui existe là-bas et pas encore chez nous, avec une priorité d'implémentation. Rappel : on ne recopie pas ce code (voir [[antigravity_prototype]] / mémoire — architecture 100% client/localStorage incompatible avec notre modèle serveur+RLS), seulement l'idée, adaptée à notre schéma.

**Priorité haute :**
- **Blocs structurés par type** (`BlockRenderer.tsx`) — chez eux, un bloc `personnage` a de vrais champs (STR/DEX/CON/INT/SAG/CHA, PV, CA, bonus de maîtrise, jets de dés). Chez nous, un bloc a un titre + du texte enrichi (fait le 2026-07-28, voir Wiki ci-dessous), mais pas encore de champs structurés par type. C'est le plus gros écart restant sur "comment est construite une fiche" et le plus utile pour jouer réellement.
- ~~**Résolution de visibilité côté serveur**~~ — fait le 2026-07-28 pour les blocs et relations (voir Général/Infrastructure ci-dessous) ; chez eux ce filtrage restait réimplémenté à la main côté client (`isSecret`), jamais appliqué côté serveur — nous l'avons désormais en RLS, jamais confié au client.
- ~~**Éditer/supprimer une entité ou un bloc**~~ — fait le 2026-07-28 (voir Wiki ci-dessous).
- ~~**Compendium de consultation du SRD**~~ — Phase 1 faite le 2026-07-28 (voir Moteur de règles ci-dessous) : onglet dans la barre latérale, pas de page à part.

**Priorité moyenne :**
- **Dossiers de la barre latérale + glisser-déposer** (`Sidebar.tsx`) — chez eux : 15 dossiers par défaut (rattachement par préfixe d'id), dossiers personnalisés, réordonnancement en drag-and-drop, onglets Monde/Règles séparés, recherche. Notre barre latérale actuelle (groupement plat par `entity_kind`) couvre le besoin de base ; ceci n'est utile que si un monde grossit beaucoup.
- **Historique des révisions / annulation** (déjà listée) — chez eux : jusqu'à 15 versions par page en localStorage, restauration. Chez nous, la table `entity_mechanical_revisions` existe déjà en base mais rien ne l'utilise.
- **Blocs structurés additionnels** (arme, sort, monstre/statblock, classe, espèce...) — logique à faire après le bloc personnage, une fois le principe validé.
- **Export/import d'un monde en JSON** — simple et utile, faisable rapidement quand on voudra.
- **Génération de contenu par IA avec repli procédural** (`loreGenerator.ts`) — déjà listée (Assistant IA). Dépend d'abord de choisir un modèle/fournisseur (question ouverte du PDD).

**Priorité basse / plus tard :**
- **Texte enrichi avec liens automatiques** (déjà listée) — complexe, risque de faux positifs, non résolu même dans leur PDD à eux.
- **Portail joueur en lecture seule sans compte** (déjà listée) — la leur n'a aucune sécurité serveur (juste un filtre client) ; la nôtre devra être conçue différemment (jeton + résolution serveur). Attend un vrai wiki à partager.
- **Gestionnaire de catégories personnalisées, personnalisation de thème plus poussée** — petits conforts, faisables plus tard.
- **Mécanique de jets de dés reliée à un journal/toast** — amusant mais pas central.
- **Substrat "moteur de règles programmatique"** (`general_rule`/`rule_logic` avec `programmaticVariables`) — à regarder comme inspiration quand on construira le mini-langage de formules (déjà listé, Moteur de règles), pas avant.

---

## Général / Infrastructure

- [x] Dépôt GitHub connecté et utilisé (push direct sur `master`)
- [x] Projet Supabase créé et lié en local (CLI)
- [x] Schéma de données de base : `worlds`, `entities`, `blocks`, `relations`, `rulesets`, `ruleset_entries`, `entity_mechanical_revisions`, `campaigns`, `campaign_members`, `campaign_entity_snapshots`
- [x] RLS (sécurité au niveau des lignes) sur toutes les tables liées aux mondes/campagnes : lecture par accès au monde, écriture réservée au propriétaire pour l'instant
- [x] Import du contenu des SRD D&D 2014 et 2024 dans `rulesets`/`ruleset_entries`
- [x] App Next.js initialisée (TypeScript, App Router, Tailwind)
- [x] Authentification par email/mot de passe (inscription, confirmation email, connexion, déconnexion)
- [x] Résolution de visibilité côté serveur pour les blocs et les relations (public/joueurs/MJ/privé), au niveau RLS (`can_view_visibility`, `is_campaign_mj`) — vérifié par simulation d'un joueur et d'un co-MJ ; un bouton "Aperçu joueur" sur la fiche permet de voir l'effet sans compte de test. Reste à faire : la même résolution pour `narrative_content` une fois cet éditeur construit (voir Wiki)
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
- [x] Éditer/supprimer une entité ou un bloc existant — blocs toujours éditables en place (titre libre + Tiptap : gras/italique/titre/liste, sauvegarde au blur), suppression de bloc et de fiche
- [x] Bulle de mise en forme flottante (apparaît à la sélection) : type de texte (paragraphe/titre 1/2/3), gras, italique, souligné, barré, lien externe, couleur du texte, spoiler, masquer aux joueurs (ces deux derniers : marques visuelles pour l'auteur seulement, pas encore de filtrage réel côté joueur — dépend de la résolution de visibilité serveur)
- [x] Blocs "texte" (générique) et "image" (URL + aperçu, pas d'upload réel) ajoutés aux types disponibles, avec légende sous l'image
- [x] Hiérarchie de tailles cohérente : titre de fiche 30px > titre de bloc 24px > H1/H2/H3 (20.8/18/16px) > paragraphe 14px (≥ 12px demandé)
- [x] Création instantanée d'une fiche vierge (plus de page séparée) : titre toujours éditable en place, ouverte immédiatement dans la barre latérale et le bureau
- [x] Type de fiche (`entity_kind`) éditable directement dans la fiche, avec types personnalisés (le champ était déjà du texte libre en base ; aucune liste fermée à maintenir)
- [x] Blocs repliables (chevron) et discrets (pas d'encadré visible, séparateur fin uniquement)
- [~] Blocs modulaires : titre + texte enrichi en place pour tous les types ; pas encore de champs structurés dédiés par type (personnage, inventaire, biologie...) — voir audit antigravity en tête de document, et la spécification détaillée du bloc personnage ci-dessous
- [ ] "Créer comme carte" / "Lien vers une carte" depuis la sélection de texte (créer une nouvelle entité ou lier une entité existante) — mis de côté volontairement lors de l'ajout de la bulle de mise en forme, nécessite une recherche d'entités + création, brique à part
- [ ] Portrait d'entité : vrai téléversement d'image (actuellement un simple cadre "Portrait" sans upload) — bloqué par le stockage de fichiers (Supabase Storage, voir Général/Infrastructure) ; la zone doit garder un ratio fixe (3/4) quelle que soit la taille de la fenêtre, déjà en place côté CSS
- [ ] Bloc généalogie / arbre familial — à terme, pas urgent : entité liée par des relations typées avec un vocabulaire dédié (soeur, frère, adelphe, parent, cousin, oncle...) et une visualisation en arbre plutôt qu'en étiquettes plates. Implique : une liste de types de relation "famille" distincte de la liste libre actuelle, et un rendu graphique (au-delà du graphe de connaissances déjà listé plus bas)
- [x] Réorganiser les blocs par glisser-déposer (drag-and-drop HTML5 natif, poignée `⋮⋮`, persiste `display_order` via `reorderBlocks`)
- [ ] Éditeur de `narrative_content` avec segments de visibilité (distinct des blocs, pas commencé)
- [ ] Liens automatiques dans le texte (détection de mentions/alias) — question ouverte non résolue dans le PDD (faux positifs)
- [ ] Graphe de connaissances (visualisation des `relations`, au-delà des étiquettes)
- [ ] Historique des modifications d'une fiche
- [ ] Import/export de contenu

### Bloc "personnage" — spécification détaillée (V2, gros chantier)

Basé sur des captures d'écran d'une fiche de référence (feuille de perso "Fine Lââm") montrant le résultat visé à long terme, à adapter à notre esthétique (verre/glassmorphism, doré, thèmes). Rien de ceci n'est commencé : c'est une expansion du point "[~] Blocs modulaires" ci-dessus, listée à part parce qu'elle est bien plus grosse que les autres types de bloc. Chaque élément est noté avec ce qu'il implique techniquement.

- [ ] **En-tête de fiche** : portrait rond, nom, sous-titre (espèce · classe, ex. "Tieffelin · Roublard"), badge de niveau, favori (étoile), CA (bouclier), PV avec boutons +/-, pastilles initiative/vitesse/perception/maîtrise/épuisement, barre d'XP avec boutons "+XP"/"Ajouter", barre d'outils (repos court, repos long, Éditer, Partager, Export)
  - Implique : des champs structurés (pas juste titre+texte) — donc un `data` jsonb avec un schéma dédié par bloc "personnage" plutôt que `{title, content}` ; une logique de repos (court/long) qui réinitialise PV/emplacements de sorts/ressources à usage limité ; export = sérialisation JSON ou PDF, à définir
- [ ] **Six caractéristiques** (FOR/DEX/CON/INT/SAG/CHA) : modificateur affiché, score brut, pastille de bonus de sauvegarde
  - Implique : calcul modificateur = `floor((score - 10) / 2)`, et bonus de sauvegarde = modificateur + bonus de maîtrise si la caractéristique est "maîtrisée" — relève du mini-langage de formules déjà prévu (section Moteur de règles), pas un calcul à coder en dur par caractéristique
- [ ] **Liste de compétences** (Compétences) : pastilles de maîtrise (aucune/demi/maîtrisée/expertise) et caractéristique associée affichée
  - Implique : les 18 compétences et leur caractéristique de rattachement existent déjà comme données SRD dans `ruleset_entries` — à relier plutôt qu'à recopier en dur ; le niveau de maîtrise est propre au personnage (à stocker dans le bloc, pas dans le ruleset)
- [ ] **Onglets Actions / Inventaire / Traits** — navigation à onglets à l'intérieur du bloc
  - Implique : un sous-composant de bloc avec état d'onglet actif (probablement pas persisté serveur, juste UI)
- [ ] **Tableau d'attaques** (onglet Actions) : nom, type de dégâts/propriétés, liste déroulante de bonus d'attaque, pastille de dé de dégâts
  - Implique : jets de dés réels (tirage + affichage du résultat) — dépend du "mécanisme de jets de dés relié à un journal" déjà listé en priorité basse plus haut ; les propriétés d'armes (portée, deux mains, légère...) existent déjà comme données SRD à référencer
- [ ] **Ressources** (onglet Actions) : capacités à usage limité (ex. Sorts, Ki, Rage) avec compteur d'utilisations restantes
  - Implique : reset au repos court ou long selon la ressource — champ de configuration par ressource, pas juste un compteur
- [ ] **Compteurs personnalisés** (onglet Actions) : compteurs libres définis par le joueur/MJ
  - Implique : structure clé/valeur/max flexible dans le `data` jsonb, sans schéma fermé (contrairement aux ressources standard)
- [ ] **Maîtrise d'armes** (onglet Actions, règles 2024) : cartes avec bascule active/inactive + description de l'effet
  - Implique : donnée SRD 2024 uniquement (le mastery n'existe pas en 2014) — doit être conditionnel au ruleset du monde
- [ ] **Armure & Défense** (onglet Inventaire) : détail du calcul de CA, sélecteur d'armure équipée
  - Implique : formule de CA dépendante du type d'armure équipée (légère/intermédiaire/lourde + bouclier), encore le mini-langage de formules
- [ ] **Inventaire catégorisé** (onglet Inventaire) : objets personnalisés / armes / équipement, avec quantités, et barre de poids avec seuil "Encombré"
  - Implique : table ou structure jsonb pour les objets possédés (référence à un `ruleset_entry` pour les objets SRD + objets libres), calcul de poids total vs. seuil de force
- [ ] **Dés de vie** et **Bourse** (PP/PO/PE/PA/PC) (onglet Inventaire)
  - Implique : arithmétique de monnaie (conversion entre pièces), dés de vie liés au niveau et à la classe
- [ ] **Traits d'espèce** (vision, résistances), **Traits passifs**, **Capacités de classe** (cartes dépliables), **Dons** (onglet Traits)
  - Implique : toutes ces données existent déjà comme `ruleset_entries` SRD à référencer/lier plutôt qu'à ressaisir ; les cartes dépliables réutilisent le principe des blocs repliables déjà en place

Constat général : ce bloc a besoin d'un `data` jsonb structuré et documenté par sous-section (pas un simple titre+texte comme les blocs actuels), d'une UI à onglets dédiée, et s'appuie fortement sur le mini-langage de formules et sur les `ruleset_entries` déjà importées — trois chantiers qui doivent avancer ensemble plutôt que ce bloc en isolation. Recommandation : traiter comme un type de bloc à part entière (`block_type = "personnage_complet"` ou similaire) plutôt que d'étendre le bloc "personnage" actuel, pour ne pas casser les fiches personnage déjà créées en texte libre.

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
- [x] Compendium (Phase 1) : onglet "Règles" dans la barre latérale (bascule avec "Fiches"), catégories regroupant les `entry_type` bruts (Sorts/Classes/Espèces/Origines/Monstres/Armes/Armures/Outils/Objets/Dons/Traits/Compétences/Référence — "features"/"levels"/"equipment-categories" volontairement exclus, ce sont des tables de progression ou des pages d'index, pas des entrées consultables), sélecteur de ruleset 2014/2024, recherche par nom, fenêtre de détail en lecture seule avec rendu générique clé/valeur. Découverte au passage : `human_readable.desc` est de forme incohérente selon les entrées (array, string ou null) — normalisé côté client, mais bon signal que `structured_data` mériterait des rendus dédiés par type plutôt que le fallback générique (Phase 2, voir plus haut)
  - [x] Répartition des objets par type (Armes/Armures/Outils/Objets) — classification côté client sur `equipment_category`/`equipment_categories` (les deux rulesets ne rangent pas ce champ au même endroit)
  - [x] Traduction française (partielle) : libellés des ~150 champs techniques de `structured_data` et valeurs d'énumération courantes (écoles de magie, alignements, types de dégâts, tailles, raretés, classes...) — dictionnaires dans `lib/srdTranslations.ts`. Les noms d'entrées et les descriptions longues restent en anglais (texte libre du SRD, pas une énumération finie)
  - [ ] Traduction complète des noms et descriptions — nécessite soit une source SRD déjà traduite en français (à vérifier : existe-t-il un jeu de données communautaire réutilisable ?), soit un vrai pipeline de traduction (script + API Claude, stockage des traductions en base) ; pas quelque chose à improviser entrée par entrée
  - [ ] Constat : le SRD 2024 importé (`srd-2024.json`) ne contient aucun sort (`Spells` absent du fichier source lui-même, pas un bug d'import) — à surveiller si une source plus complète devient disponible
  - [ ] Phase 2 : rendu détaillé sur-mesure (sorts, monstres, objets), liens croisés entre entrées, lien depuis un bloc personnage
  - [ ] Phase 3 : favoris par monde, recherche plein texte sur la description

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
- [x] Présentation de fiche d'entité alignée sur le modèle antigravity (relations en rangées verticales avec pastille de catégorie, badge de catégorie, en-tête en grille avec portrait agrandi, barre "Ajouter un bloc" compacte par pastilles, tiroir JSON brut repliable) ; reste non fait : texte enrichi, liens automatiques
- [x] 4 thèmes sélectionnables (sombre/demi-sombre/demi-clair/clair), mémorisés par cookie — global à l'app pour l'instant, pas encore par monde comme chez vvd.world
- [x] Bureau à fenêtres pour les fiches d'entité (glisser/redimensionner/agrandir/fermer, plusieurs fenêtres simultanées, aimantation gauche/droite façon Aero Snap) — inspiré du prototype antigravity, réimplémenté contre notre schéma
- [x] Esthétique verre (glassmorphism) sur les fenêtres/cartes, fond immersif flouté, police d'affichage "Outfit", étiquettes de relation colorées différemment entrant/sortant — d'après l'examen détaillé du CSS du prototype antigravity
- [x] Fond immersif = vrais visuels Midjourney de l'utilisateur (un par thème), optimisés en WebP
- [x] Barre latérale de navigation avec liste des entités groupée par catégorie (pastille de couleur) — la liste ne se cache plus derrière les fenêtres ouvertes
- [x] Remplacer les `<select>`/`<datalist>` natifs par des menus déroulants personnalisés (`Dropdown.tsx`, `Combobox.tsx`, rendus via portail React dans `document.body` pour échapper au `overflow:hidden`/`transform` de la fenêtre) — couvre type de fiche, type de relation, entité cible et visibilité (bloc + relation)
- [ ] Fond personnalisable par téléversement + palette de couleurs extraite automatiquement de l'image (pour que l'UI s'adapte). Nécessite : (1) le stockage de fichiers (Supabase Storage, pas encore construit), (2) un algorithme d'extraction de couleurs dominantes, (3) une garantie de contraste texte/fond suffisant — pas trivial, à faire proprement plutôt qu'en vitesse
- [ ] Tableau de bord d'accueil (récents, création rapide, aperçu du graphe)

## Plus tard (V2+, hors scope court terme)

Pas commencé, volontairement reporté — voir le PDD section 22 pour le détail :

- [ ] Simulation procédurale du monde
- [ ] Cartographie
- [ ] Immersion audiovisuelle (musique adaptative)
- [ ] Collaboration multi-MJ
