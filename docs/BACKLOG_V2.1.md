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
| V2.1-1 | Liens automatiques entre les fiches | `L` | **Fait** (13 septembre) — les 7 étapes, vérifiées en direct sur la prod |
| V2.1-2 | Outil de notes et de préparation de séance | `L` | N'existe pas — "Bloc-notes" réservé mais désactivé dans la sidebar MJ ; joueur = un seul textarea |
| V2.1-3 | Livre de séance en première page du wiki | `M` | La donnée existe (`sessions.summary`), rien ne l'affiche ni ne l'édite |
| V2.1-4 | Calendrier réel de planification des séances | `M` | N'existe pas — à ne pas confondre avec le calendrier FICTIF déjà construit (V2-H2) |
| V2.1-5 | Un seul bloc Personnalité/Convictions par fiche | `S` | Aucune contrainte aujourd'hui — même bug de classe déjà vu et corrigé pour les Générateurs de MJ |

---

## V2.1-1 — Liens automatiques entre les fiches · `L` — fait

### Constat

Le mécanisme est **conçu en détail** dans `specs/wiki-liens-et-personnages.md`
§A1 (encodage des liens) et §A2 (mentions et rétroliens), et **à moitié
construit** — recherche approfondie faite avant d'écrire les étapes
ci-dessous, plutôt que de deviner :

- Le nœud `ref` existe dans le schéma des segments (`zRefNode`,
  `src/core/schemas/entities/segments.ts`) avec exactement la forme dont ce
  ticket a besoin : `{ kind: "entity"|"rule"|"asset", id?, key?, label }`.
  `kind:"rule"` cible par **clé** (survit à la surcharge d'une variante) ;
  `entity`/`asset` ciblent par **identifiant**.
- Il se rend déjà dans l'éditeur (`RefMention`,
  `components/entities/richtext/extensions.ts`) et **round-trip
  intégralement** avec `tiptapSync.ts` (`docToSegments`/`segmentsToDoc`) —
  la couche données est prête, rien à changer là.
- Mais **aucune UI n'insère ce nœud** : ni bouton, ni raccourci. Et son
  rendu (`PublicBlockView.tsx`) est un `<span>` **mort** — aucun `href`,
  aucun clic, dans aucun des trois contextes (éditeur MJ, wiki joueur, wiki
  public).
- `detectEntityReferences` (`src/core/linker/detect.ts`) — détection
  automatique par nom/alias, pure et testée — n'est appelée **nulle part**.
  Le code le dit lui-même : *"branchement différé"*.
- La table `entity_mentions` (rétroliens) existe en base depuis Phase 0,
  jamais alimentée ni lue.
- **Le système de fenêtres sait déjà adresser une fiche ET une entrée de
  règle de façon uniforme** (`components/shell/windowRefs.ts`,
  `WindowRef = {kind:"entity"|"rule", key}`) — `useDesktop().openRef(ref)`
  ouvre la bonne fenêtre par-dessus l'actuelle. C'est la pièce qui manquait
  pour rendre un lien réellement cliquable côté MJ : elle existe déjà,
  construite pour un usage voisin (ouvrir une fiche liée depuis une
  relation).
- La recherche d'entité (`otherEntities`, `components/entities/
  RelationsChips.tsx` — `{id, name, slug, entity_kind}`) et la recherche de
  règle (`useWorldRuleEntries`/`RuleEntryAutocomplete` — toutes les
  `ruleset_entries` du monde, tous types confondus) existent déjà et sont
  **déjà déroulées jusqu'à `TextBlockEditor`** via `EntityBlocks.tsx`
  (`otherEntities`, `worldSlug`, `worldId` tous présents à cet endroit) —
  juste pas encore transmises à `RichTextEditor`.
- Créer une fiche à la volée sans quitter la page existe déjà aussi :
  `POST /api/entities` (`{worldId, name, entityKind}` → `{id, slug, ...}`),
  déjà utilisé par le bloc généalogie pour "créer la fiche «X»" — le geste
  "Créer comme Fiche" est le même bouton, un contexte différent.

Précisions de l'auteur (retour utilisateur, 4 septembre) prises en compte
dans les étapes :

- Les liens ciblent aussi bien des **fiches** que des **entrées de règle**
  (ex. "Tieffeline" détecté dans le texte doit lier la fiche de race
  correspondante).
- Ajout/retrait manuel via des boutons dans la barre de mise en forme :
  **"Créer comme Fiche"**, **"Lier à la Fiche"**, **"Délier"** — la
  sélection de texte devient le `label` du lien, jamais remplacée par un
  texte différent (cohérent avec la spec, §A1 "Renommage" : le label est
  ce que l'auteur a écrit).
- **"Créer comme Fiche" crée directement en type "Autre"**, pas de
  dialogue de choix de type — cohérent avec le reste de l'appli (aucun
  autre tunnel de création de ce genre) ; le type se change ensuite depuis
  la fiche.
- La détection automatique reste fondée sur les vrais noms/alias des
  fiches et des règles (ce que `detectEntityReferences` fait déjà) — pas
  une IA qui devine, un matching exact comme aujourd'hui.
- Les liens doivent être visibles et **cliquables** dans les fiches MJ,
  dans les blocs, et sur le wiki public.
- **"Précédent"/"Suivant"** = navigation façon navigateur web (retour sur
  le chemin parcouru, ex. sorts → Boule de feu → une autre fiche de règle
  → retour), **pas** un classement thématique/alphabétique — un simple
  historique de consultation dans le wiki.

### Étapes

1. **Fait** — **Boutons manuels dans la barre de mise en forme** (`RichTextEditor.tsx`,
   `BubbleMenu` existante) — *première étape, celle qui débloque tout le
   reste* :
   - Fait suivre `otherEntities`/`worldSlug` jusqu'à `RichTextEditor`
     (`TextBlockEditor` → `RichTextEditor`), même chemin que pour les
     autres blocs déjà connectés (généalogie, relation...).
   - **"Lier à la Fiche"** (sélection non vide) : popover de recherche
     combinant `otherEntities` (fiches) et `useWorldRuleEntries` (règles,
     tous types) — choisir un résultat remplace la sélection par un nœud
     `ref` dont le `label` reste le texte sélectionné.
   - **"Créer comme Fiche"** (sélection non vide) : `POST /api/entities`
     avec `entityKind:"other"` et le texte sélectionné comme nom, puis lie
     immédiatement.
   - **"Délier"** (curseur/sélection sur un `ref` existant, remplace les
     deux boutons précédents) : reconvertit le nœud en texte brut à partir
     de son `label`.

   Vérifié en direct (fiche "Mirella des Cent Étoiles") : "humaine" lié à
   la fiche de règle Humain (Espèce, SRD 5.2.1), persistant après
   rechargement ; "Créer comme Fiche" crée et lie une vraie entité ;
   "Délier" restaure le texte brut. **Bug réel trouvé et corrigé en cours
   de route** : `docToSegments` (`src/core/richtext/tiptapSync.ts`)
   laissait passer `id`/`key` à `null` pour un `refMention` (l'attribut
   Tiptap est toujours présent, même non utilisé) alors que `zRefNode` les
   veut `optional()` (undefined), jamais `nullable()` — la sauvegarde d'un
   lien échouait silencieusement en 400 à chaque pose. Testé
   (`tiptapSync.test.ts`).
2. **Fait — Liens cliquables, partout** :
   - Éditeur MJ : bouton "Ouvrir" quand la sélection est un `ref` existant
     → `useDesktop()?.openRef(...)` (le système de fenêtres, déjà
     construit, adresse une entité ET une règle de façon uniforme —
     résout l'id d'entité en slug via `otherEntities` déjà en main,
     `kind:"rule"` utilise directement sa `key`), repli en navigation
     normale si `useDesktop()` est `null`. Vérifié en direct : "Ouvrir"
     sur "humaine" affiche bien la fenêtre de la règle Humain.
   - Wiki public/joueur (`PublicBlockView.tsx`) : le `<span>` mort
     remplacé par un vrai `<Link>`. Une cible "entity" se résout via
     `textRefs` (nouveau, même motif que `questRefs`/`timelineRefs` —
     filtré `is_public` sur le partage anonyme, pas sur le wiki joueur).
     Une cible "rule" construit son lien directement depuis sa clé (aucune
     résolution serveur nécessaire) **seulement si `ruleHrefBase` est
     fourni** — décision de périmètre assumée : uniquement le wiki joueur
     (`/joueur/regles` existe), jamais le partage anonyme (`/partage`,
     `/apercu`), qui n'a aucune page de règle pour un visiteur non
     authentifié — construire cette page publique serait un chantier
     séparé, pas fait ici sans demande explicite. Nouvelle fonction pure
     `collectRefTargetIds` (`src/core/linker/refTargets.ts`, testée).
     Vérifié en direct sur `/apercu` : un lien de règle reste un span non
     cliquable (cohérent, pas de page publique), un lien d'entité devient
     un vrai `<a href>` qui navigue correctement.
3. **Fait — Détection automatique** : bouton "Détecter des liens" (icône
   SVG minimaliste, même convention que `EyeIcon`/`DieIcon` — pas
   d'emoji, retour utilisateur) sous chaque bloc de texte — passe chaque segment par `detectEntityReferences`
   (déjà écrite/testée) contre les fiches ET les entrées de règle du
   monde (candidats combinés, kind encodé dans un préfixe d'id), exclut
   les mentions déjà liées (chevauchement avec un nœud `ref` existant), et
   propose chaque trouvaille comme suggestion à confirmer (Lier/Ignorer)
   — jamais une réécriture silencieuse (spec §A1). Déclenché par un bouton
   plutôt qu'automatiquement à chaque frappe/sauvegarde — plus prévisible,
   moins coûteux. Nouvelle fonction `segmentOffsetToPos` (dans
   `RichTextEditor.tsx`, dépend de l'instance Tiptap réelle donc hors de
   `src/core`) convertit un décalage de caractères en position ProseMirror
   réelle. `otherEntities` gagne un champ `aliases` optionnel
   (`entityWindow.ts`) — seule donnée qui manquait pour détecter par alias
   en plus du nom. Vérifié en direct : "Divination" détecté et lié au
   milieu d'un texte dense ("Magicienne (Divination)Niveau : 5..."),
   texte environnant intact après sauvegarde.
4. **Fait — Extraction et persistance de `entity_mentions`** — fonction
   pure `extractMentionsFromSegments` (`src/core/linker/mentions.ts`,
   testée) : hérite la visibilité du SEGMENT d'origine, jamais une valeur
   par défaut (le piège nommé par la spec, §A2). `updateBlockContent`
   recalcule et **remplace** toutes les mentions du bloc à chaque
   sauvegarde (jamais un ajout incrémental) ; `deleteBlock` les retire
   sans ligne fantôme.
5. **Fait — Panneau "Mentionné dans"** — `listMentionedInEntities`
   s'appuie sur la RLS déjà en place sur `entity_mentions`
   (`entity_mentions_select`, filtre déjà par visibilité pour l'appelant)
   plutôt que de dupliquer ce filtrage côté service. Nouveau composant
   `MentionedIn`, branché sur la fiche MJ ET le wiki public/joueur.
   Vérifié en direct sur la prod : lier "Mirella" → "Brennan Torram" fait
   apparaître "Mentionné dans : Mirella Des Cent Étoiles" sur la fiche de
   Brennan, lien cliquable, y compris côté joueur.
6. **Fait — Liens brisés** — une cible entité introuvable/masquée reste
   affichée (`.rich-ref-broken`, pointillé rouge) plutôt que retirée
   silencieusement ; dans l'éditeur MJ, le bouton "Ouvrir" devient
   "Lien brisé" quand la fiche liée n'existe plus.
7. **Fait — Précédent/Suivant façon navigateur** — `ReaderHistoryNav`
   (pile de navigation propre au composant : l'API History native
   n'expose ni position ni longueur exploitables pour désactiver un
   bouton en bout de pile), branché une seule fois dans
   `TwoPaneReaderLayout` (déjà partagé par les onglets Wiki/Règles/
   Édition côté joueur). Vérifié en direct : Mirella → Brennan (clic sur
   un lien) → Précédent revient à Mirella → Suivant revient à Brennan.
### Critères

- [x] Sélectionner du texte et cliquer "Lier à la Fiche" propose des
      fiches ET des règles, et pose un lien qui garde le texte
      sélectionné tel quel.
- [x] "Tieffeline" dans un paragraphe se détecte automatiquement et peut
      se lier à la fiche de race correspondante (bouton "Détecter des
      liens", suggestion à confirmer — vérifié en direct avec "Divination").
- [x] Un lien est cliquable et navigue vers la bonne fiche/règle, dans
      l'éditeur MJ ET sur le wiki public (entité partout ; règle sur le
      wiki joueur — pas sur le partage anonyme, aucune page de règle n'y
      existe, décision de périmètre assumée).
- [x] Une fiche affiche ce qui la mentionne ailleurs, correctement filtré
      par visibilité (RLS `entity_mentions_select`, un joueur ne voit
      jamais une mention issue d'un passage `gm`).
- [x] Supprimer une fiche liée laisse un lien cassé visible (pointillé
      rouge), jamais un texte qui redevient silencieusement du texte brut.
- [x] Précédent/Suivant fonctionnent dans le wiki comme les boutons d'un
      navigateur — vérifié en direct (Mirella → Brennan → Précédent →
      Suivant).

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

## V2.1-5 — Un seul bloc Personnalité/Convictions par fiche · `S` — fait

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

- [x] Impossible d'ajouter un second bloc Personnalité (ou Convictions) à
      une fiche qui en a déjà un — en base comme à l'écran.

**Fait.** Index unique partiel `blocks_personality_worldview_uniq` sur
`(entity_id, block_type)` (migration `20260904220000`) — deux vrais
doublons trouvés en base avant la migration (même entité "Candide
Fausset" dans deux copies de monde, même course qu'un bug déjà vu sur les
blocs générateurs : un bloc vierge en plus du bloc réel), le bloc vierge
supprimé à la main dans chaque cas avant de poser la contrainte.
`InsertBlockError` (nouveau, `src/server/repos/blocks.ts`) conserve le
code Postgres pour que `createBlock` distingue cette violation précise
(`reason: "duplicate_block_type"`, HTTP 409) d'une vraie erreur. Menu
"Ajouter un bloc" (`EntityBlocks.tsx`) masque Personnalité/Convictions dès
que la fiche en porte déjà un. Vérifié en direct sur "Candide Fausset"
(fiche portant déjà les deux blocs) : absents du menu, et une tentative
directe contre l'API renvoie bien 409 "Cette fiche a deja un bloc de ce
type."

---

## Ordre suggéré

Aucune dépendance technique dure entre ces cinq tickets. Suggestion, pas
une contrainte : **V2.1-5** d'abord (le plus petit, corrige un vrai bug
latent), puis **V2.1-1** (les liens conditionnent la qualité de tout le
reste du wiki), puis **V2.1-2/V2.1-3** (peuvent se faire dans l'ordre qui
motive le plus), et **V2.1-4** en dernier (le plus indépendant du reste).
