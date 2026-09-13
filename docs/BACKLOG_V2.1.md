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

   **Retour utilisateur (13 septembre), deux ajustements après usage :**
   - **DA du bouton** alignée sur le motif "Assistance IA" existant
     (`TextBlockEditor.tsx`) plutôt qu'une icône seule : encadré
     `rounded-md border border-edge/50 bg-panel-sunken p-2`, disclosure
     `▾`/`▸` au lieu d'une icône SVG ou d'un emoji. La détection se
     déclenche directement dans le gestionnaire `onClick` de l'ouverture du
     panneau, pas dans un `useEffect` — `react-hooks/set-state-in-effect`
     interdit un `setState` synchrone dans un effet (le motif "Assistance
     IA" y échappe car son `setState` suit un `.then()` asynchrone).
   - **Détection insensible au genre grammatical** — "humaine" ne se
     détectait pas contre la règle "Humain" (correspondance exacte
     uniquement, retour utilisateur). Corrigé par une liste fermée de
     formes féminines (`src/core/linker/speciesGender.ts`,
     `SPECIES_FEMININE_FORMS` : Humain/Tieffelin/Halfelin/Nain) ajoutées
     comme alias des règles d'espèce lors de la détection — pas une règle
     grammaticale générale, qui risquerait des faux positifs ("Orc" →
     "orque" écarté : le mot désigne aussi le cétacé). Vérifié en direct
     sur "Mirella" : "humaine" apparaît désormais comme suggestion liée à
     la règle Humain.
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
- "Bloc-notes" est déjà réservé dans la sidebar MJ (`MjSidebar.tsx`,
  `reserved`) mais **désactivé, jamais construit** — l'entrée existe déjà,
  elle attend juste d'être branchée.
- Côté joueur, "notes" (V2-M7b) est un unique textarea privé par monde
  (`components/entities/player/NotesEditor.tsx`, route
  `app/m/[worldSlug]/joueur/notes/page.tsx`) — aucune organisation, pas de
  pages, pas de sections.
- Le système de fenêtres flottantes (`DesktopWindowsProvider.tsx`,
  `useDesktop()`/`openRef` — celui qui ouvre déjà une fiche liée, V2.1-1)
  gère un adressage `WindowRef` à plat (`entity` | `rule` | `mj` |
  `rule-tool`, `windowRefs.ts`) et empile librement toute fenêtre ouverte
  par `openRef` dans `?avec=` — jamais de notion de "fenêtre liée à une
  autre", jamais de limite au nombre de fenêtres secondaires.

Retour utilisateur (13 septembre, après plusieurs esquisses comparées) :
l'auteur veut une organisation à la OneNote (sections/pages, mais en
**arbre**, pas la seule profondeur 1 niveau du modèle de référence), pour
le MJ **et** pour chaque joueuse, capable d'accueillir aussi bien des
pages écrites que des **raccourcis vers des fiches déjà existantes** (ex.
retrouver Brennan Torram dans son propre cahier), le tout dans le système
de fenêtres déjà construit plutôt qu'une route plein écran séparée.

### Disposition retenue — piste "un seul compagnon"

Quatre pistes esquissées et comparées avec l'auteur avant d'écrire ce
ticket (trois colonnes façon OneNote, arbre unifié, fenêtre du bureau,
aperçu à épingler), puis trois pistes mixtes une fois le choix resserré
sur "les trois colonnes de la première, dans le mécanisme de fenêtres de
la troisième". Retenue : **un seul compagnon**.

- Le cahier s'ouvre comme une fenêtre du bureau existant — pas une route
  plein écran neuve. `"notes"` rejoint `MJ_TOOL_KEYS`/`MJ_TOOL_LABELS`
  (`windowRefs.ts`), ce qui active directement l'entrée "Bloc-notes" déjà
  réservée dans `MjSidebar.tsx` ; côté joueur, une entrée équivalente
  remplace la route `joueur/notes` actuelle. Une seule fenêtre "Notes" à
  la fois par cahier (MJ ou joueuse), comme toute fenêtre `mj` aujourd'hui.
- À l'intérieur : les trois colonnes de l'esquisse OneNote (arbre de
  pages à gauche, page ouverte à droite) — détaillé ci-dessous.
- Cliquer un lien **depuis cette fenêtre** (fiche épinglée ou lien vers
  une autre page du cahier, V2.1-1) appelle `openRef` comme partout
  ailleurs, mais avec une règle nouvelle et **scoped à cette seule
  origine** : la fenêtre secondaire ouverte depuis le cahier remplace la
  précédente fenêtre compagne du même cahier au lieu de s'empiler dans
  `?avec=`. Jamais plus de deux fenêtres issues de ce parcours (le cahier
  + son compagnon). Un lien cliqué depuis une fiche normale continue de
  s'empiler exactement comme aujourd'hui — aucune régression sur le
  système existant, l'ajout est localisé à l'origine "notes" dans
  `DesktopWindowsProvider.tsx`.
- Choisie plutôt que "division interne à la fenêtre" (répliquerait un
  moteur de split entier, alors que celui des fenêtres existe déjà) et
  "empilage libre" (encombre le bureau dès le deuxième lien cliqué) :
  le meilleur rapport entre "reprend ce qui existe" et "le résultat que
  l'auteur décrit" (deux sources d'information côte à côte, jamais plus).

### Modèle de l'arbre — pages et fiches épinglées

Une seule structure d'arbre par cahier, deux natures de ligne :

- **Page** — contenu propre au cahier (`zNarrativeContent`, réutilise
  `RichTextEditor` tel quel, aucun nouvel éditeur). Titre **renommable**.
- **Fiche épinglée** — pas de contenu propre, une simple référence
  (`{kind:"entity"|"rule", key}`, même forme que `WindowRef`) vers une
  entité ou une entrée de règle déjà existante. Le nom affiché est celui
  de la cible, **jamais éditable ici** — une copie du nom dériverait du
  réel (cohérent avec la règle absolue n°16, même si ce n'est pas une
  donnée mécanique : une seule source de vérité pour un nom de fiche).
  L'ouvrir appelle `openRef` sur cette référence : c'est la même fenêtre
  fiche que partout ailleurs dans l'app, filtrée par la même visibilité
  côté serveur — une joueuse qui épingle Brennan et l'ouvre depuis son
  cahier ne voit jamais plus que ce que cette fiche lui montre déjà dans
  le wiki. Rien de neuf à sécuriser, une pure réutilisation.

Chaque ligne porte un `parent_id` (imbrication libre, profondeur
illimitée — contrairement au modèle OneNote de référence) et une
`position` parmi ses frères (ordre manuel, glisser-déposer).

### Étapes

1. **Retirer `session_log` des blocs attachables** à une fiche
   (`src/core/schemas/blocks/registry.ts`) — vérifier d'abord si des fiches
   du monde de test en portent déjà un, les nettoyer à la main. La donnée
   `sessions.summary` sous-jacente n'est **pas** supprimée : elle sert au
   Livre de séance (V2.1-3).
2. **Modèle de données** — nouvelle table (ex. `note_items`) : `id`,
   `notebook_owner` (le monde pour le MJ, `(world_id, player_id)` pour une
   joueuse — RLS refuse tout accès hors propriétaire), `parent_id`
   (nullable), `position`, `kind` (`page` | `pinned_entity` | `pinned_rule`),
   `title` (page uniquement), `content` (page uniquement,
   `zNarrativeContent`), `target_key` (fiches épinglées uniquement).
   Repo dédié (`src/server/repos/notes.ts`), jamais de requête Supabase
   ailleurs (règle absolue n°20).
3. **Fenêtre "Notes"** — `"notes"` ajouté à `MJ_TOOL_KEYS`/`MJ_TOOL_LABELS`
   (active l'entrée réservée de `MjSidebar.tsx`) ; entrée équivalente côté
   sidebar joueur. Contenu : arbre à gauche (`note_items` du cahier),
   `RichTextEditor` à droite pour la page sélectionnée.
4. **Organiser l'arbre** — renommer une page en ligne (double-clic),
   glisser une ligne pour réordonner ou changer de parent, "+" propose
   "Nouvelle page" ou "Épingler une fiche existante" (réutilise le
   popover combiné entité/règle de "Lier à la Fiche", V2.1-1).
5. **Compagnon unique** — petit ajout à `DesktopWindowsProvider.tsx` :
   retenir, par fenêtre `mj:"notes"` ouverte, la référence de son dernier
   compagnon ouvert depuis elle ; un nouvel `openRef` **originaire du
   cahier** remplace ce compagnon dans `?avec=` au lieu de s'y ajouter.
6. **Gabarit "Préparation de séance"** côté MJ — une page pré-remplie
   (accroche, PNJ prévus, rencontre, complications) plutôt qu'un nouveau
   type de bloc : réutilise l'idée de modèle de fiche (`entity_templates`,
   §A3 de la même spec que le ticket 1, jamais construite non plus).
7. **Débrancher l'ancien chemin** — route `session-log/attach` si plus
   aucun consommateur ne l'appelle ; route `joueur/notes/page.tsx` et
   `NotesEditor.tsx` une fois la fenêtre "Notes" en place côté joueur.

### Critères

- [ ] Le bloc "Journal de séance" n'apparaît plus dans le menu "+ Bloc"
      d'une fiche.
- [ ] Le MJ ouvre son cahier depuis la sidebar MJ ("Bloc-notes" devient
      actif), organise ses pages en arbre (renommer, glisser pour
      réordonner ou imbriquer), profondeur illimitée.
- [ ] Chaque joueuse a son propre cahier, même mécanisme, toujours privé
      (aucune autre joueuse ni le MJ n'y accède, sauf ce qu'elle choisit
      d'épingler et qui reste soumis à la visibilité normale).
- [ ] Épingler une fiche existante (ex. Brennan Torram) dans l'arbre puis
      l'ouvrir affiche la vraie fiche, jamais une copie — filtrée par la
      même visibilité que partout ailleurs.
- [ ] Cliquer un lien depuis le cahier (fiche épinglée ou autre page)
      ouvre une fenêtre compagne à côté ; cliquer un second lien depuis le
      cahier remplace cette compagne — jamais plus de deux fenêtres issues
      de ce parcours. Un lien cliqué depuis une fiche normale continue de
      s'empiler comme aujourd'hui (non régression).

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
