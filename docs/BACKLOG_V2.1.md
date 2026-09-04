# Backlog V2.1 — Correctifs pour la table de jeu

Cinq demandes de l'auteur (4 septembre 2026), au service direct de sa table
(joueuses + MJ) plutôt que du reste du plan V2/V3. Chaque ticket suit la
méthode habituelle : **un ticket à la fois**, plan court avant le code,
contenu authored en direct quand il y en a, `npm run typecheck && npm run
lint && npm run test` avant de clore, commit dédié.

Recherche faite avant d'écrire ce document — chaque ticket ci-dessous
s'appuie sur ce qui existe déjà plutôt que de deviner :

| # | Titre | Taille | Constat |
|---|---|---|---|
| V2.1-1 | Liens automatiques entre les fiches | `L` | Conçu (`specs/wiki-liens-et-personnages.md` §A1/A2) et à moitié construit, jamais branché bout en bout |
| V2.1-2 | Outil de notes et de préparation de séance | `L` | N'existe pas — "Bloc-notes" réservé mais désactivé dans la sidebar MJ ; joueur = un seul textarea |
| V2.1-3 | Livre de séance en première page du wiki | `M` | La donnée existe (`sessions.summary`), rien ne l'affiche ni ne l'édite |
| V2.1-4 | Calendrier réel de planification des séances | `M` | N'existe pas — à ne pas confondre avec le calendrier FICTIF déjà construit (V2-H2) |
| V2.1-5 | Un seul bloc Personnalité/Convictions par fiche | `S` | Aucune contrainte aujourd'hui — même bug de classe déjà vu et corrigé pour les Générateurs de MJ |

---

## V2.1-1 — Liens automatiques entre les fiches · `L`

### Constat

Le mécanisme est **conçu en détail** dans `specs/wiki-liens-et-personnages.md`
§A1 (encodage des liens) et §A2 (mentions et rétroliens), et **à moitié
construit** :

- Le nœud `ref` existe dans le schéma des segments (`src/core/schemas/
  entities/segments.ts`) et se rend dans l'éditeur riche comme un jeton non
  éditable (`RefMention`, `components/entities/richtext/extensions.ts`).
- La détection automatique de mentions dans un texte existe, **pure et
  testée** (`src/core/linker/detect.ts`, `detectEntityReferences`) — mais
  n'est appelée **nulle part** dans le reste du code. Le commentaire du
  code le dit lui-même : *"branchement différé"*.
- La table `entity_mentions` (rétroliens) existe en base depuis Phase 0 —
  mais rien ne l'alimente ni ne la lit. Aucun panneau "mentionné dans"
  n'existe.

Résultat concret pour l'utilisateur : poser un lien entre deux fiches
aujourd'hui n'a pratiquement pas d'interface dédiée, et il n'existe aucun
moyen de voir depuis une fiche ce qui la mentionne ailleurs.

### Étapes

1. **Insertion assistée dans l'éditeur** — taper un déclencheur (ex. `@`)
   dans `RichTextEditor` ouvre une recherche d'entité (autocomplete) qui
   insère un nœud `ref` au bon endroit. C'est le geste manquant le plus
   direct ; sans lui, rien d'autre n'a de valeur immédiate.
2. **Détection automatique à la sauvegarde** — à l'enregistrement d'un bloc
   de texte, passer son contenu par `detectEntityReferences` (déjà écrite)
   contre les entités du monde, et proposer les mentions trouvées comme
   suggestions à confirmer — **jamais une réécriture silencieuse du
   texte** (la spec l'interdit explicitement, §A1 "Renommage").
3. **Extraction et persistance de `entity_mentions`** — nouvelle fonction
   pure `src/core/linker/mentions.ts` (prévue par la spec, jamais écrite) :
   à chaque écriture d'un bloc contenant du texte, recalcule et remplace
   toutes les lignes de mentions issues de cette source (§A2).
4. **Panneau "Mentionné dans"** sur la fiche — lit `entity_mentions` où
   `target_entity_id` = cette fiche, résolu et **filtré par visibilité
   côté serveur** : une mention hérite de la visibilité du segment
   d'origine (le piège explicitement nommé par la spec, §A2 — même classe
   de bug que le filtrage du RAG).
5. **Liens brisés** — supprimer une fiche liée ne doit jamais faire
   disparaître silencieusement le lien : le nœud `ref` reste, se résout
   sur rien, s'affiche comme lien cassé. Une simple liste de maintenance
   suffit pour cette première passe, pas un écran dédié.

### Critères

- [ ] Insérer un lien vers une fiche existante se fait en tapant dans le
      texte, pas seulement via un sélecteur externe.
- [ ] Une fiche affiche ce qui la mentionne ailleurs, correctement filtré
      par visibilité (un joueur ne voit jamais une mention issue d'un
      passage `gm`).
- [ ] Supprimer une fiche liée laisse un lien cassé visible, jamais un
      texte qui redevient silencieusement du texte brut.

---

## V2.1-2 — Outil de notes et de préparation de séance · `L`

### Constat

- Le bloc `session_log` (V2-H4) épinglé sur une fiche n'est **pas voulu ici**
  — décision produit de l'auteur, pas un bug.
- "Bloc-notes" est déjà réservé dans la sidebar MJ (`MjSidebar.tsx`) mais
  **désactivé, jamais construit**.
- Côté joueur, "notes" (V2-M7b) est un unique textarea privé par monde
  (`NotesEditor.tsx`) — aucune organisation, pas de pages, pas de
  sections.

L'auteur demande une organisation à la OneNote : des cahiers/sections
contenant des pages, pour le MJ (préparation de séance) **et** pour
chaque joueuse (ses propres notes), pas un outil MJ-only.

### Étapes

1. **Retirer `session_log` des blocs attachables** à une fiche
   (`src/core/schemas/blocks/registry.ts`) — vérifier d'abord si des fiches
   du monde de test en portent déjà un, les nettoyer à la main. La donnée
   `sessions.summary` sous-jacente n'est **pas** supprimée : elle sert au
   Livre de séance (V2.1-3).
2. **Modèle de données "sections + pages"** — réutilise l'éditeur de texte
   riche déjà existant (`RichTextEditor`/`zNarrativeContent`) pour le
   contenu d'une page, pas un nouvel éditeur. Nouvelle table légère (ex.
   `note_sections`, `note_pages`) plutôt qu'un bloc par page : les notes ne
   sont pas attachées à une fiche d'entité, elles vivent à côté (un cahier
   par monde pour le MJ, un cahier privé par joueuse et par monde).
3. **Interface à deux colonnes** (sections à gauche, page ouverte à
   droite) — remplace `NotesEditor.tsx`. MJ et joueuses partagent le même
   composant, seule la source de données change.
4. **Gabarit "Préparation de séance"** côté MJ — une page pré-remplie
   (accroche, PNJ prévus, rencontre, complications) plutôt qu'un nouveau
   type de bloc : réutilise l'idée de modèle de fiche (`entity_templates`,
   §A3 de la même spec que le ticket 1, jamais construite non plus).
5. **Débrancher la route `session-log/attach`** une fois le bloc retiré du
   catalogue, si plus aucun consommateur ne l'appelle.

### Critères

- [ ] Le bloc "Journal de séance" n'apparaît plus dans le menu "+ Bloc"
      d'une fiche.
- [ ] Le MJ organise ses notes en plusieurs sections/pages, pas un seul
      champ.
- [ ] Chaque joueuse a son propre espace de notes multi-pages, toujours
      privé (aucun autre joueur ni le MJ ne les voit, sauf mention
      contraire explicite plus tard).

---

## V2.1-3 — Livre de séance en première page du wiki · `M`

### Constat

`sessions.summary` existe déjà (un résumé texte par séance, "réinjecté
dans le contexte IA" selon `docs/SCHEMA.md` §12) — mais rien ne l'affiche
ni ne permet de l'éditer aujourd'hui. La page d'accueil du wiki joueur
(`app/m/[worldSlug]/joueur/wiki/page.tsx`) n'est qu'une invite ("Choisissez
une entité dans le sommaire"). Le "Journal d'historique" existant (V2-H2)
trace des **événements structurés** (`session_events`) — pas des résumés
narratifs rédigés à la main : les deux ne se remplacent pas.

### Étapes

1. **Écran "Livre de séance"** — liste chronologique des séances d'une
   campagne, chacune avec un titre et son résumé (texte riche). Devient le
   contenu par défaut de la page d'accueil du wiki joueur (remplace
   l'invite actuelle) et de l'aperçu public équivalent.
2. **Assignation d'autrice** — nouveau champ (ex.
   `sessions.summary_author_id`) : le MJ désigne, par séance, quelle
   joueuse est chargée de rédiger le résumé.
3. **Flux d'écriture côté joueuse** — la joueuse désignée voit un bouton
   "Rédiger le résumé de cette séance" dans son propre espace ; les
   autres lisent seulement. Une fois soumis, visible à toute la table
   (`visibility: players`).
4. **Coexistence avec le Journal d'historique** — le résumé rédigé reste
   un texte libre, sans obligation de citer les `session_events` : l'un
   est mécanique/dérivé, l'autre narratif/choisi — même distinction déjà
   actée entre `relations` et `entity_mentions` (V2.1-1, §A2).

### Critères

- [ ] La première page du wiki liste les séances passées avec leur résumé.
- [ ] Le MJ désigne une autrice par séance.
- [ ] Seule l'autrice désignée (ou le MJ) peut modifier ce résumé précis —
      jamais les résumés des autres séances.

---

## V2.1-4 — Calendrier réel de planification des séances · `M`

### Constat

Rien n'existe pour planifier une **date réelle** de séance. À ne pas
confondre avec le "Calendrier" déjà présent dans les outils MJ (V2-H2),
qui gère exclusivement les dates **fictives** du monde (calendrier de
jeu) — un second mécanisme, sans rapport avec le premier.

### Étapes

1. **Donnée** — une date/heure réelle, un titre optionnel, un statut
   (prévue/confirmée/annulée), par campagne (nouvelle table légère ou
   extension de `sessions`).
2. **Écran calendrier côté MJ** — poser/modifier/annuler la prochaine
   séance. Une simple liste des prochaines dates suffit pour cette
   première version ; un vrai calendrier mensuel visuel seulement si le
   besoin s'en fait sentir après usage réel.
3. **Encart "Prochaine séance"** réutilisable (date + décompte), posé aux
   endroits demandés — accueil MJ, accueil joueur, et le Livre de séance
   (V2.1-3) une fois construit.
4. **Hors périmètre pour cette première passe** : notifications/rappels
   (email, push) — le projet n'a aucune infrastructure de ce type
   aujourd'hui, à ne pas construire sans besoin confirmé.

### Critères

- [ ] Le MJ pose une date de prochaine séance.
- [ ] Elle s'affiche correctement côté joueur.
- [ ] La modifier ou l'annuler se répercute partout où elle est affichée.

---

## V2.1-5 — Un seul bloc Personnalité/Convictions par fiche · `S`

### Constat

Rien n'empêche aujourd'hui d'ajouter plusieurs blocs `personality` ou
`worldview` à la même fiche via "+ Bloc" — `createBlock`
(`src/server/services/blocks.ts`) ne vérifie aucune unicité par type. Même
classe de bug qu'une race déjà rencontrée et corrigée pour les blocs
générateurs de l'entité "Générateurs de MJ" : la solution la plus fiable
est une contrainte en base, pas seulement une vérification applicative
(qui rate les doubles-clics ou onglets multiples).

### Étapes

1. **Contrainte en base** — index unique partiel sur `(entity_id,
   block_type)` où `block_type in ('personality', 'worldview')`. Nouvelle
   migration, jamais une modification d'une migration existante (règle
   absolue n°14).
2. **Refus explicite côté service** — `createBlock` vérifie en amont (ou
   capture l'erreur de contrainte) et renvoie un message clair plutôt
   qu'un 500 générique.
3. **UI** — masquer "Personnalité"/"Convictions" du menu "+ Bloc" dès que
   la fiche en porte déjà un, plutôt que de laisser l'utilisateur
   découvrir le refus après coup.
4. **Nettoyage préalable** — vérifier si des fiches existantes (monde de
   test) portent déjà plusieurs blocs de l'un de ces deux types ; fusionner
   ou supprimer les doublons à la main avant de poser la contrainte (sinon
   la migration échoue).

### Critères

- [ ] Impossible d'ajouter un second bloc Personnalité (ou Convictions) à
      une fiche qui en a déjà un — en base comme à l'écran.

---

## Ordre suggéré

Aucune dépendance technique dure entre ces cinq tickets. Suggestion, pas
une contrainte : **V2.1-5** d'abord (le plus petit, corrige un vrai bug
latent), puis **V2.1-1** (les liens conditionnent la qualité de tout le
reste du wiki), puis **V2.1-2/V2.1-3** (peuvent se faire dans l'ordre qui
motive le plus), et **V2.1-4** en dernier (le plus indépendant du reste).
