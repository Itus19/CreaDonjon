# Backlog V2.1 — Correctifs pour la table de jeu

Cinq demandes de l'auteur (4 septembre 2026), au service direct de sa table
(joueuses + MJ) plutôt que du reste du plan V2/V3 — plus une sixième arrivée
le 13 septembre, une fois les cinq premières closes. Chaque ticket suit la
méthode habituelle : **un ticket à la fois**, plan court avant le code,
contenu authored en direct quand il y en a, `npm run typecheck && npm run
lint && npm run test` avant de clore, commit dédié.

Recherche faite avant d'écrire ce document — chaque ticket ci-dessous
s'appuie sur ce qui existe déjà plutôt que de deviner :

| # | Titre | Taille | Constat |
|---|---|---|---|
| V2.1-1 | Liens automatiques entre les fiches | `L` | **Fait** (13 septembre) — les 7 étapes, vérifiées en direct sur la prod |
| V2.1-2 | Outil de notes et de préparation de séance | `L` | **Fait** (13 septembre) — piste "un seul compagnon" (mixte A×C) |
| V2.1-3 | Livre de sessions | `M` → `L` | **Fait** (13 septembre) — pivoté vers une vraie fiche par entrée plutôt que `sessions.summary`, sur retour utilisateur explicite |
| V2.1-4 | Calendrier réel de planification des séances | `L` | **Fait** (13 septembre) — piste D (disponibilités libres), variante F (classement) |
| V2.1-5 | Un seul bloc Personnalité/Convictions par fiche | `S` | Aucune contrainte aujourd'hui — même bug de classe déjà vu et corrigé pour les Générateurs de MJ |
| V2.1-6 | Bloc musique : ambiance sonore sur le wiki public | `L` | **En cours** (14 septembre) — le bloc `music` n'existe que dans l'éditeur, il n'affiche qu'un cadre vide sur les pages de lecture. Deux lots : bloc invisible + bouton discret + lecture à la visite, puis lecteur YouTube piloté (fondu, enchaînement, bornes) |

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

### Disposition retenue — deux panneaux indépendants, partagés

Quatre pistes esquissées et comparées avec l'auteur avant d'écrire ce
ticket (trois colonnes façon OneNote, arbre unifié, fenêtre du bureau,
aperçu à épingler), puis trois pistes mixtes une fois le choix resserré
sur "les trois colonnes de la première, dans le mécanisme de fenêtres de
la troisième". Retenue au départ : **un seul compagnon**, ouvert dans une
vraie fenêtre du bureau côté MJ (`openRef`/`companionOf`) et dans un
panneau fixe côté joueuse. **Revue deux fois le jour même, sur retour
utilisateur après usage réel** — voir l'étape 5 pour l'implémentation
initiale, remplacée par la disposition finale ci-dessous :

- **Même disposition pour le MJ et pour une joueuse** : "le visuel du MJ
  n'était pas aussi satisfaisant que celui du joueur" — la fenêtre
  flottante séparée pour le compagnon MJ est abandonnée au profit de la
  disposition déjà construite côté joueur, copiée telle quelle. L'outil
  "Bloc-notes" reste une fenêtre du bureau (comme les onze autres outils
  MJ), mais son compagnon vit désormais À L'INTÉRIEUR de cette fenêtre,
  jamais dans une seconde. Le mécanisme `companionOf`/`openRef` ajouté à
  `DesktopWindowsProvider.tsx` pour la version initiale est retiré,
  redevenu mort une fois cette unification faite.
- **Deux panneaux, pas "page + compagnon" figé** : le second panneau
  accepte soit une fiche/règle épinglée, soit une AUTRE page du même
  cahier ("pouvoir ouvrir deux pages de ses propres notes") — un bouton
  "⇒ Ouvrir dans le second panneau" apparaît sur chaque ligne de page.
  Chaque panneau se ferme indépendamment par son propre bouton ; le
  survivant reprend alors toute la largeur ("fermer la fenêtre centrale
  et garder celle de droite qui prendrait toute la page").
- **Partage réellement à parts égales** ("la division doit être vraiment
  à la moitié") : les deux panneaux sont `flex-1`/`flex-1`, jamais une
  largeur fixe/plafonnée comme dans la toute première version (`min(40%,
  420px)`).
- **Fenêtre MJ maximisée par défaut** : cause réelle du premier retour
  "visuel moins satisfaisant" — chaque outil MJ s'ouvre dans une fenêtre
  flottante fixe de 860×760px (`DesktopWindowsProvider.ts`,
  `defaultGeometry`), largement suffisante pour les onze autres outils
  mais trop étroite pour deux panneaux côte à côte. Cas isolé sur
  `"notes"` (`isMaximized: true` à l'ouverture) plutôt qu'un changement du
  défaut global, qui aurait été une régression non sollicitée pour les
  autres outils.

### Modèle de l'arbre — pages et fiches épinglées (revu en cours de route)

Le plan initial prévoyait une nouvelle table `note_items`. **Écarté en
écrivant le code** au profit d'une réutilisation plus stricte de
l'existant : chaque compte a déjà, depuis V2-M7b, sa propre entité privée
`entity_kind: "notes"` par monde (`findEntityByCreatorAndKind`), déjà
couverte par `permissions.ts` §`isOwnPrivateNotes` — générique à ce type
d'entité, pas à un `block_type` précis. Le cahier entier tient donc dans
**un seul nouveau bloc**, `note_tree`, posé sur cette même entité :

- **Page** — contenu propre au cahier, mêmes segments qu'un bloc `text`
  (`zNarrativeContent`, `RichTextEditor` réutilisé tel quel). Titre
  **renommable**.
- **Fiche épinglée** (`pinned_entity`/`pinned_rule`) — pas de contenu
  propre, une simple référence (`targetId`/`targetKey`) vers une entité ou
  une entrée de règle déjà existante. Le nom affiché se résout **côté
  client** contre `otherEntities`/`useWorldRuleEntries`, jamais dupliqué
  dans l'arbre (règle absolue n°16 par analogie) — une cible disparue ou
  devenue invisible s'affiche comme lien brisé (`.rich-ref-broken`, V2.1-1).

Chaque ligne porte un `parentId` (imbrication libre, profondeur illimitée)
et une `position` parmi ses frères (même convention numérique que
`display_order`). Toute la logique d'arbre est pure et testée
(`src/core/notebook/tree.ts`/`tree.test.ts` : détection de cycle,
déplacement, suppression en cascade). La mutation entière repasse par le
PATCH générique déjà existant, `/api/blocks/[blockId]` (concurrence
optimiste par `version`) — **aucune nouvelle table, aucun nouveau repo,
aucune nouvelle route d'écriture.**

### Étapes

1. **Fait — Retiré `session_log`** du registre de blocs, du menu "+ Bloc"
   et de son rendu (`EntityBlocks.tsx`), de la fonction de service dédiée
   (`attachSessionLogBlock`) et de sa route (`session-log/attach`).
   `sessions.summary`/`session_events` restent intacts (Livre de séance,
   V2.1-3 ; Journal d'historique, V2-H2) — seul le bloc épinglé disparaît.
   Garde-fou de sécurité mis à jour (`publicShare.blockCoverage.test.ts`).
2. **Fait — Modèle de données**, voir ci-dessus : bloc `note_tree` sur
   l'entité `notes` déjà existante, plutôt qu'une nouvelle table. Reprise
   non destructive : si un ancien bloc `text` (l'ex-textarea) porte déjà du
   texte, il devient la première page du nouvel arbre au lieu d'être perdu
   (`src/server/services/notebook.ts`).
3. **Fait — Fenêtre "Notes"** — `"notes"` ajouté à
   `MJ_TOOL_KEYS`/`MJ_TOOL_LABELS`, ce qui active directement l'entrée
   "Bloc-notes" jusque-là réservée dans `MjSidebar.tsx` (nouvelle page
   `app/m/[worldSlug]/mj/notes/page.tsx`, même mécanisme que les onze
   autres outils MJ). Côté joueur : la route `joueur/notes` existante est
   réécrite pour appeler le même composant d'arbre, en mode `split` (voir
   étape 5) plutôt que fenêtré — la coquille joueur (`PlayerShell.tsx`) n'a
   pas de fenêtres flottantes, jamais eu besoin d'en avoir jusqu'ici.
4. **Fait — Organiser l'arbre**, avec une simplification assumée :
   renommer en ligne (le champ titre de la page), "+" propose "Nouvelle
   page" et "Épingler une fiche existante" (réutilise tel quel le popover
   combiné entité/règle de "Lier à la Fiche", V2.1-1). **Réordonner/
   imbriquer se fait par quatre boutons (▲▼←→) plutôt que par
   glisser-déposer** — `@dnd-kit` est déjà une dépendance du projet
   (utilisé ailleurs pour les punaises de carte) mais l'intégrer ici pour
   un arbre aurait été le plus gros morceau du ticket pour un gain
   surtout esthétique ; la version à boutons couvre exactement le même
   besoin (tout réordonner/imbriquer, profondeur illimitée), vérifiable
   dans `tree.test.ts`. Un vrai glisser-déposer reste un fast-follow si
   l'usage réel le réclame.
5. **Fait, puis remplacé le jour même — Compagnon unique** :
   - **Version initiale** (écart de conception MJ/joueuse) : côté MJ,
     `DesktopWindowsProvider.openRef` acceptait une option `companionOf` —
     un lien ouvert depuis le cahier remplaçait le précédent compagnon de
     CE cahier dans `?avec=` au lieu de s'y ajouter. Côté joueuse,
     `openRef`/`?avec=` supposent une fenêtre PRIMAIRE déjà enregistrée
     pour flotter un compagnon — jamais le cas côté joueur
     (`PlayerShell.tsx` n'a pas de fenêtres) — le compagnon y était donc
     déjà un panneau fixe (état React local), pas une fenêtre.
   - **Retour utilisateur, même jour** : voir "Disposition retenue"
     ci-dessus — le panneau fixe côté joueuse devient la disposition
     UNIQUE (MJ compris), `companionOf`/`openRef` est retiré. La route
     `joueur/fiche-compagnon/[entitySlug]` (renommée
     `fiche-compagnon/[entitySlug]`, plus de segment `joueur`) reprend
     EXACTEMENT le branchement lecture/édition de
     `joueur/wiki/[entitySlug]/page.tsx` (fiche éditable si
     `canUserEditEntity`, sinon lecture seule `PublicEntityBody`) ; une
     règle épinglée réutilise directement la route de fenêtre
     `regles/[cle]/window` déjà publique. `playerRestricted` (assistance
     IA, bouton "Demande de modif au MJ"...) devient une simple
     préférence d'affichage tranchée par la page appelante (`isGm`),
     jamais une question de sécurité — déjà entièrement tranchée côté
     serveur par `canUserEditEntity`.
6. **Fait — Gabarit "Préparation de séance"**, version minimale : un
   bouton "+ Modèle : Préparation de séance" (MJ seulement) crée une page
   pré-remplie de quatre intitulés en gras (Accroche, PNJ prévus,
   Rencontre, Complications) à compléter — pas un système de modèles
   généralisé (`entity_templates` n'existe toujours pas, non demandé ici).
7. **Fait — Ancien chemin débranché** : `NotesEditor.tsx` et l'ancien
   service `playerNotes.ts` supprimés, `session-log/attach` supprimée.

### Critères

- [x] Le bloc "Journal de séance" n'apparaît plus dans le menu "+ Bloc"
      d'une fiche.
- [x] Le MJ ouvre son cahier depuis la sidebar MJ ("Bloc-notes" devient
      actif), organise ses pages en arbre (renommer, réordonner/imbriquer
      via ▲▼←→), profondeur illimitée.
- [x] Chaque joueuse a son propre cahier, même arbre, toujours privé
      (aucune autre joueuse ni le MJ n'y accède, sauf ce qu'elle choisit
      d'épingler et qui reste soumis à la visibilité normale).
- [x] Épingler une fiche existante (ex. Brennan Torram) dans l'arbre puis
      l'ouvrir affiche la vraie fiche, jamais une copie — filtrée par la
      même visibilité que partout ailleurs.
- [x] Cliquer un lien depuis le cahier (fiche épinglée ou autre page du
      cahier) ouvre un second panneau à côté, à parts égales avec le
      premier ; en cliquer un autre remplace ce second panneau — jamais
      plus de deux sources à la fois. Même disposition MJ et joueuse.
- [x] Chaque panneau se ferme indépendamment (bouton dédié) ; le panneau
      restant reprend alors toute la largeur.
- [x] Ouvrir deux pages de son propre cahier côte à côte, pas seulement
      une page et une fiche épinglée.
- [x] La fenêtre "Bloc-notes" côté MJ s'ouvre maximisée par défaut — les
      onze autres outils MJ gardent leur taille de fenêtre habituelle.

`npm run typecheck && npm run lint` passent ; `npm run test:core` passe
(785 tests, dont les 12 nouveaux de `tree.test.ts`). Les suites
d'intégration (`*.integration.test.ts`, base réelle) n'ont pas pu tourner
dans cet environnement — aucun Docker/Supabase local disponible ici,
limitation de l'environnement, pas une régression de ce ticket.

Vérifié en direct sur la prod (monde "Faerûn (copie)"), en plusieurs
passes le même jour au fil des retours utilisateur : "Bloc-notes" premier
de la sidebar MJ (ordre alphabétique), "Tables aléatoires" disparue ;
création/renommage/sauvegarde de page ; épingler puis ouvrir une fiche
remplace bien le compagnon précédent (d'abord vérifié via `?avec=` en
fenêtre séparée, puis via le panneau unifié après le retour utilisateur) ;
côté joueuse, même arbre isolé par compte, même épinglage ; panneaux à
parts égales, fermeture indépendante de chacun (le survivant reprend
toute la largeur), ouverture de deux pages du même cahier côte à côte, et
fenêtre MJ maximisée à l'ouverture. Fiches de test nettoyées des cahiers
après chaque vérification.

**Retour utilisateur (13 septembre), régression trouvée après coup :**
tout compte ouvrant "Notes" pour la toute première fois (aucun bloc
`note_tree` encore créé) tombait sur l'écran d'erreur générique de
production, quel que soit son rôle (MJ, joueuse, "voir comme") — jamais
reproductible en test puisque les comptes de test avaient déjà un cahier
créé avant coup. Cause réelle, retrouvée via les logs runtime Vercel
(`npx vercel logs`, la seule façon de voir le message non redacté d'une
erreur de rendu Server Component en production) : une migration du 2
septembre (`20260902150001`/`150002`, correctif d'un tout autre bug de
suppression douce) avait réécrit `app.can_edit_entity` sur une base
tronquée et fait disparaître par mégarde son 5e cas ("c'est ma propre
fiche de notes", ajouté trois jours plus tôt) — la policy RLS
`blocks_insert` refusait donc la création du tout premier bloc du
cahier. Restauré par une nouvelle migration
(`20260913150000_restore_can_edit_entity_own_notes.sql`), confirmé par
le test d'intégration existant qui couvrait déjà ce cas
(`canEditEntityRls.integration.test.ts`).

---

## V2.1-3 — Livre de sessions · `M` → `L` — fait

### Constat initial, et pivot

`sessions.summary` existe (un résumé texte par séance) mais rien ne
l'affiche ni ne permet de l'éditer. Le plan d'origine ci-dessus prévoyait
d'étendre cette table (`summary_author_id`, un écran de liste dédié).
**Abandonné en discutant la présentation avec l'auteur** : retour
utilisateur explicite — "sa présentation dans la sidebar est la même que
les autres fiches et en arborescence... il y a les titres des entrées".
`sessions` n'a ni titre garanti, ni auteur, ni visibilité par bloc, ni la
moindre présentation en fiche — tout aurait été à écrire de zéro pour
obtenir ce rendu, alors qu'une vraie fiche (`entities` + blocs) l'offre
gratuitement. Décision : chaque entrée du Livre de sessions est une
fiche normale d'un nouveau genre dédié, `entity_kind = "session_journal"`
— jamais un écran séparé.

### Modèle retenu

- **Devoir avant fiche** — nouvelle table `session_journal_entries`
  (`campaign_id`, `ingame_date` en JSON `GameDate`, `assigned_to`,
  `status: pending|written`, `entity_id` nullable, `written_at`). Le MJ y
  assigne un devoir (date ingame + joueuse) ; l'entité n'existe pas
  encore à ce stade — elle n'est créée que lorsque l'autrice commence
  réellement à écrire, pour que `entities.created_by` soit véritablement
  elle, jamais le MJ qui a assigné (évite un champ "auteur" redondant).
- **Correction MJ, gratuite** — `canEditEntity` autorise déjà tout MJ de
  campagne à modifier n'importe quelle fiche (cas 2). Il manquait
  seulement le droit pour l'autrice de continuer à modifier SA propre
  entrée ensuite : 6e cas ajouté (`entity_kind = "session_journal" AND
  created_by = auth.uid()`), même motif exact que le 5e cas des notes —
  et même régression déjà rencontrée et corrigée ce jour (voir V2.1-2
  ci-dessus) rendue impossible ici par un test d'intégration dédié
  (`canEditEntityRls.integration.test.ts`) qui compare le miroir SQL au
  miroir TypeScript sur ce cas précis.
- **Blocs** — au moment où l'autrice commence à écrire : un bloc
  `infobox` ("Date ingame" / "Rédigé par" / "Rédigé le", formaté une
  fois à la création) puis un bloc `text` vide. Aucun nouveau type de
  bloc — l'autrice ajoute ensuite Image, Musique, ou tout autre bloc déjà
  disponible via le même menu "+ Ajouter un bloc" que n'importe quelle
  fiche.
- **Sommaire** — `session_journal` exclu du regroupement alphabétique
  générique (`getEntityTree`/`getPublicEntityTree`) puis un groupe
  épinglé "Livre de sessions" reconstruit à la main et préposé en tête,
  entrées triées par `written_at` décroissant (jamais par nom). Même
  fonction pour le wiki joueur, l'aperçu et le partage public — filtrée à
  `entities.is_public` pour ces deux derniers, exactement comme toute
  autre fiche.
- **Page d'accueil du wiki** — les trois pages d'index
  (`joueur/wiki`, `apercu`, `partage/[token]`) redirigent vers l'entrée
  la plus récente quand il y en a une, au lieu de l'invite générique.
- **Devoir côté joueuse** — pas de signal dans l'arborescence elle-même
  (non demandé ce tour-ci) : une bannière en haut du wiki joueur
  ("Devoir : rédiger le récit du {date ingame}" → "Commencer à écrire"),
  qui ouvre un simple champ de titre puis redirige vers l'édition
  normale de la fiche fraîchement créée.

### Critères

- [x] Le Livre de sessions apparaît en premier dans le sommaire du wiki
      (joueur, aperçu, partage), présentation identique aux autres
      groupes de fiches.
- [x] Les entrées sont triées par date IRL de rédaction décroissante.
- [x] La page d'accueil du wiki s'ouvre sur l'entrée la plus récente.
- [x] Le MJ assigne le devoir à une joueuse pour une date ingame donnée.
- [x] L'autrice rédige avec les blocs habituels (texte, image...) ; le MJ
      peut toujours corriger ensuite.
- [x] La fiche affiche qui l'a écrite et quand (ingame et IRL).

`npm run typecheck && npm run lint && npm run test:core` passent (800
tests). `canEditEntityRls.integration.test.ts` (base réelle) passe avec
son nouveau cas. Vérifié en direct de bout en bout sur un monde de test :
devoir assigné par le MJ (calendrier révolutionnaire par défaut, via
`GameDateInput`) → bannière côté joueuse → fiche créée avec l'infobox
correctement rempli ("Rédigé par Camille des Bois", le nom du PJ, jamais
le compte) → apparition immédiate en tête du sommaire joueur ET MJ →
redirection de la page d'accueil du wiki vers cette entrée → correction
réussie depuis le compte MJ → passage en public et apparition sur
`/apercu` (contenu des blocs toujours masqué tant qu'ils restent
`visibility: players`, comme pour toute autre fiche). Compte et monde de
test nettoyés après vérification.

**Retour utilisateur (13 septembre), ajustements après usage :**
- **Relations retirées** de la fiche — pas utile pour ce type de fiche
  (`EditEntityForm.tsx`/`PublicEntityBody.tsx`, filtre sur
  `entity_kind !== "session_journal"`).
- **Le MJ peut s'auto-assigner un devoir** — `listJournalRoster`
  (`src/server/services/sessionJournal.ts`) inclut désormais tout MJ de la
  campagne (libellé fixe "MJ", jamais résolu par personnage puisque le MJ
  n'a normalement pas de PJ), en plus des joueuses.

**Retour utilisateur, refonte complète du bloc "Séance"** (deux captures
d'écran comparées avant/après par l'auteur) — le bloc `infobox` générique
de la version initiale ne suffisait plus :

- **Nouveau type de bloc dédié `session_journal_meta`**
  (`src/core/schemas/blocks/sessionJournalMeta.ts`) remplace l'`infobox` :
  quatre champs **fixes**, ni renommables ni supprimables (contrairement à
  un infobox normal) — Date ingame, Rédigé par, Rédigé le, Session du.
  Jamais dans le menu "+ Ajouter un bloc" (même exclusion que "generator"),
  posé une seule fois par `submitJournalEntry`.
- **Date ingame** — listes déroulantes (jour/mois/année) via le
  `GameDateInput` déjà partagé par le reste de l'app, plutôt qu'un texte
  libre formaté une fois.
- **Rédigé par** — liste déroulante reprenant `listJournalRoster` (joueuses
  + MJ), pré-remplie avec l'autrice réelle à la création.
- **Rédigé le** — posé automatiquement à la soumission (date IRL), **modifiable
  seulement par le MJ** ensuite (`isGm`, dérivé de `hideAiAssist`) : permet
  au MJ de voir quand une entrée a vraiment été écrite sans que l'autrice
  puisse elle-même avancer/reculer cette date.
- **Session du** (nouveau champ) — liste déroulante des séances réelles de
  la campagne (`real_sessions`, V2.1-4) : quelle séance jouée ce résumé
  couvre. C'est cette date, avec la date ingame, qui apparaît sur le wiki
  public — jamais "Rédigé par"/"Rédigé le" à eux seuls.
- **Présentation "livre" du wiki public** — le bloc Séance devient un pied
  de page discret (une seule ligne, en petit, sans titre de bloc) tout en
  bas de la fiche, plutôt qu'un bloc normal en haut ; lettrine sur le
  premier paragraphe du récit et séparateurs ornementaux entre les
  parties (titres H2/H3) — promis puis oublié à la livraison initiale,
  corrigé ici. Badge de type de fiche ("session_journal") masqué en haut à
  droite sur cette même vue.
- **Jour de la semaine calculé automatiquement** — nouveau réglage
  `weekdayEpoch` sur le calendrier du monde ("quel jour de semaine tombe
  le 1er jour de l'an 0", `src/core/calendar/weekday.ts`, testé) : affiché
  partout où une date ingame s'édite (`GameDateInput`, pas seulement le
  Livre de sessions) et sur "Rédigé le" (jour de semaine grégorien
  standard, éditeur et pied de page public).
- **Migration des entrées existantes** — `scripts/migrate-session-journal-meta.ts`
  (simulation par défaut, `--write` pour écrire) bascule toute entrée déjà
  rédigée avant cette refonte vers le nouveau format, à partir des
  données réelles de `session_journal_entries` (jamais un re-parsing du
  texte affiché de l'ancien infobox). Exécutée en production le 13
  septembre (1 entrée concernée, "Prologue").

`npm run typecheck && npm run lint && npm run test:core` passent après
chacun de ces ajustements. Vérifié en direct de bout en bout sur un monde
jetable (auto-assignation MJ, rédaction, remplissage des 4 champs, rendu
public avec lettrine/séparateurs/pied de page) puis nettoyé.

---

## V2.1-4 — Calendrier réel de planification des séances · `L` — fait

### Constat

Rien n'existait pour planifier une **date réelle** de séance. À ne pas
confondre avec le "Calendrier" déjà présent dans les outils MJ (V2-H2),
qui gère exclusivement les dates **fictives** du monde — renommé
**"Calendrier ingame"** au moment de ce ticket pour que la distinction
soit visible dans la sidebar elle-même, pas seulement dans la tête de
l'auteur. Le nouvel outil s'appelle **"Calendrier réel"**.

### Disposition retenue — piste D (disponibilités libres), variante F

Quatre pistes esquissées pour le mécanisme de proposition de date (A —
créneaux + vote, B — une date à la fois, C — Doodle complet, D —
disponibilités libres façon agenda partagé), puis quatre variantes une
fois D retenue pour la lecture côté MJ (E — calendrier + compteur, F —
classement des meilleurs jours, G — calendrier + tableau, H — un mois à
la fois guidé). **F retenue**, avec trois raffinements du même jour :

- **Chaque joueuse marque librement ses disponibilités sur un an** — un
  calendrier mensuel navigable (`AvailabilityCalendar.tsx`), jamais une
  liste de créneaux proposés par le MJ à deviner à l'avance.
- **Une plage horaire par jour, pas juste une case cochée** (retour
  utilisateur : "c'est les matchs jour+plage horaire+durée qui doivent se
  mettre en avant"). Le MJ voit, jour par jour, l'intersection réelle des
  horaires ("session complète" si elle couvre la durée visée, "session
  raccourcie (Xh)" avec l'horaire réel sinon, ex. un décalage d'1h entre
  deux joueuses) — calculé et testé en pur
  (`src/core/scheduling/overlap.ts`, 13 tests : intersection de plages,
  classification, classement par catégorie puis effectif puis durée).
- **Durée de session visée réglable par table**, jamais figée à 5h
  (`campaigns.target_session_minutes`).
- **Aucune limite au nombre de séances confirmées par mois** (retour
  utilisateur : "je dois pouvoir mettre deux sessions dans le même mois")
  — confirmer un jour ne touche à aucun autre.
- **Réglage manuel** : le MJ pose une date/heure directement dans le même
  outil, sans dépendre du classement de disponibilités.

### Modèle de données — table dédiée, jamais `sessions`

Deux nouvelles tables (`real_session_availabilities`,
`real_sessions`) plutôt qu'une extension de `sessions` (jeu réellement
joué, rouverte automatiquement par `getOrOpenSessionForCampaign` dès
qu'une action de jeu a lieu) : une séance planifiée dans le futur avec
cette table serait à tort prise pour "la session en cours" si quelqu'un
joue avant la date prévue. Le futur Livre de séance (V2.1-3) décidera
comment rapprocher les deux quand il sera écrit — l'historique des
parties jouées vit pour l'instant dans "Calendrier réel" lui-même
(réservoir déjà prêt à être consulté).

### Étapes

1. **Fait — Modèle de données** : `real_session_availabilities` (une
   plage par campagne/joueuse/jour, écriture réservée à soi-même),
   `real_sessions` (une ligne par séance confirmée, écriture réservée au
   MJ), `campaigns.target_session_minutes` — RLS sur le même motif que
   `combats` (lecture ouverte à tout membre du monde, rien de sensible
   entre coéquipières).
2. **Fait — "Calendrier ingame" renommé**, distinct de "Calendrier réel"
   dans la sidebar MJ (ordre alphabétique inchangé).
3. **Fait — Jours de la semaine renommables**, en passant (retour
   utilisateur), même motif que les mois déjà éditables : `daysPerWeek`
   (un simple compte, jamais utilisé pour un calcul réel) remplacé par
   `weekdays: {name}[]`. Calendrier par défaut : la décade du calendrier
   républicain français (Primidi…Décadi, dix jours) plutôt que la semaine
   grégorienne.
4. **Fait — Calendrier de disponibilités côté joueuse** — mensuel,
   navigable sur 12 mois, une plage horaire par jour, bande des mois déjà
   remplis pour naviguer sans tout revisiter.
5. **Fait — Classement MJ** — jours du mois triés (complet > raccourci >
   aucun chevauchement, puis effectif, puis durée), roster déplié au clic
   (qui a répondu quoi, identifié par son PJ comme partout ailleurs dans
   l'app — jamais un nom de compte), bouton "Confirmer".
6. **Fait — Réglage manuel, séances à venir (annulables), historique.**
7. **Fait — Bannière verticale côté joueuse** : "Prochaine session —
   {jour} {date}" une fois confirmée, sinon un bouton "Renseigner mes
   disponibilités" qui ouvre directement le calendrier de saisie.

Portée volontairement pas couverte, non demandée : notifications/rappels
(email, push) — aucune infrastructure de ce type dans le projet
aujourd'hui.

### Critères

- [x] Le MJ pose une date de prochaine séance, depuis le classement de
      disponibilités ou manuellement.
- [x] Elle s'affiche correctement côté joueuse (bannière verticale), et
      une fois sa date passée la suivante prend sa place naturellement.
- [x] L'annuler la retire partout où elle est affichée.
- [x] Une joueuse renseigne ses disponibilités (jour + plage horaire) sur
      un an à l'avance.
- [x] Le MJ voit, par jour et par mois, le nombre de personnes dispo et le
      chevauchement horaire réel — "session complète" ou "raccourcie" avec
      l'horaire exact.
- [x] Deux séances peuvent être confirmées dans le même mois.
- [x] Historique des parties jouées consultable dans le même outil.

`npm run typecheck && npm run lint` passent ; `npm run test:core` passe
(798 tests, dont les 13 nouveaux de `overlap.test.ts`). Vérifié en direct
sur la prod : classement affichant correctement "session raccourcie (4h)"
pour une seule joueuse disponible 19h–23h contre une cible de 5h,
confirmation créant la séance, bannière joueuse affichant "Prochaine
session — samedi 26 septembre 2026", annulation et effacement testés.
Jours de la semaine du calendrier ingame vérifiés (décade par défaut,
renommage testé sans être enregistré pour ne pas modifier les données
réelles du monde).

**Retour utilisateur (13 septembre), deux ajustements après usage :**
- **Réglage manuel en heure de fin plutôt qu'en minutes** — cohérent avec
  le calendrier de disponibilités du joueur, qui demande déjà une plage
  horaire plutôt qu'une durée ; la durée se calcule seule
  (`timeToMinutes`, déjà utilisé côté disponibilités).
- **Navigation mensuelle MJ corrigée** — le bouton "suivant" restait
  bloqué sur le même mois (et "précédent" sautait un mois sur deux) :
  `addMonths()` dans `SchedulingMjPanel.tsx` mélangeait un mois d'entrée
  0-indexé (convention `Date.getMonth()`, utilisée par l'aide homonyme du
  calendrier joueur) avec `view.month`, 1-indexé partout ailleurs dans ce
  composant. Corrigé en gardant une seule convention de bout en bout.

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

## V2.1-6 — Bloc musique : ambiance sonore sur le wiki public · `L`

### Constat

Le bloc `music` (V2-G3) n'existe aujourd'hui **que dans l'éditeur**. Sur les
trois pages de lecture, `PublicBlockView.tsx` ne connaît pas ce type : il
affiche le `<h3>` du titre du bloc et rien d'autre — un cadre vide portant le
mot « Musique », exactement ce que `docs/BACKLOG_V2.md` avait déjà noté au
passage en V2-G11 sans le traiter.

Demande de l'auteur (13 septembre 2026), en deux temps :

1. Sur le wiki public, le bloc musique ne doit **rien afficher**. Il sert
   uniquement à lancer la musique à la visite de la fiche, et à poser un
   bouton lecture/pause discret — d'abord « à côté du titre du bloc
   précédent », revu en cours de route (voir « Revirement » plus bas) pour
   vivre à côté du nom de la fiche.
2. Une option **dans** le bloc décide si la musique démarre d'elle-même à la
   visite, ou si elle attend le bouton.

Puis, en cours de discussion : des réglages de **fondu** entrant et sortant,
« à l'image du bloc image pour les images de fond » (`fadeMs`,
`src/core/schemas/blocks/image.ts`), et — une fois l'API YouTube admise — des
**bornes début/fin** par piste.

**Découverte faite en lisant le code avant d'écrire ce ticket** :
`components/entities/player/PlayerBlockView.tsx` et son
`AutoPlayMusicBlock.tsx` implémentaient déjà une lecture automatique à la
visite… mais plus personne ne les rendait. La seule trace de `PlayerBlockView`
dans le dépôt était un commentaire périmé en tête de
`app/m/[worldSlug]/joueur/wiki/[entitySlug]/page.tsx` : cette page est passée à
`PublicEntityBody` sans que les deux fichiers soient retirés. Du code mort,
supprimé au lot 1 — sa logique de démarrage étant reprise, correctement
branchée cette fois.

### Arbitrages tranchés avec l'auteur

| Question | Décision |
|---|---|
| Où s'applique le nouveau rendu | **Les trois pages de lecture** : wiki joueur (`/m/[worldSlug]/joueur/wiki`), aperçu MJ (`/m/[worldSlug]/apercu`), partage anonyme (`/partage/[token]`) — toutes passent par `PublicEntityBody` |
| Où se pose le bouton | **Toujours à côté du `<h1>` du nom de la fiche** — voir « Revirement » ci-dessous |
| Enchaînement des pistes | **Enchaîner quand c'est possible** — donc uniquement les pistes YouTube, via l'API ; les autres fournisseurs s'arrêtent après la première |
| Portée du fondu | **YouTube seulement** |
| Transition entre deux fiches portant chacune une musique | **Croisé** : l'ancienne descend pendant que la nouvelle monte |

#### Revirement — le bouton quitte le bloc précédent pour le titre de la fiche

La demande d'origine plaçait le bouton « à côté du titre du bloc précédent ».
Implémenté ainsi d'abord, puis repris sur retour de l'auteur, une fois le code
sous les yeux : « c'est plus simple et cohérent » de l'accrocher toujours au
nom de la fiche.

C'est aussi ce qui coûte le moins. La première approche demandait de choisir
une ancre, donc de traiter trois cas limites — bloc musique en tête de fiche,
bloc précédent de type `image` (dont le titre n'est jamais affiché sur ces
pages), bloc précédent sans libellé — et obligeait `PublicBlockView` à
accepter des enfants à côté de son `<h3>`. Avec le titre de la fiche, il ne
reste rien de tout cela : `PublicBlockView` ne gagne que son `return null`
pour `music`, et le plan se réduit à « un bouton par bloc musique, lequel
démarre à la visite ».

### Ce que l'API YouTube change, et ce qu'elle ne change pas

Le fondu a été demandé par analogie avec `fadeMs` du bloc image. L'analogie ne
tient pas : le fondu d'une image de fond est une transition CSS sur **notre**
élément, gratuite ; le son vit dans une iframe d'un autre domaine, dont on ne
peut pas toucher le volume. C'est le choix d'architecture explicite de V2-G3 —
« une iframe bête qu'on démonte / remonte, sans dépendre d'un SDK par
plateforme » (`components/shell/MusicPlaybackContext.tsx`) — qui rend le fondu
impossible en l'état.

Y renoncer suppose de charger l'**IFrame Player API de YouTube**
(`https://www.youtube.com/iframe_api`, script tiers, aucune dépendance npm
ajoutée). Elle donne trois choses d'un coup : `setVolume` (fondu),
`onStateChange` → `ENDED` (enchaînement), `loadVideoById({ videoId,
startSeconds, endSeconds })` (bornes par piste).

| Fournisseur | Fondu | Enchaînement | Bornes début/fin |
|---|---|---|---|
| YouTube | oui | oui | oui |
| SoundCloud | possible (`setVolume` existe) — **hors périmètre**, l'auteur a choisi YouTube seulement | non | non |
| Spotify | **non** — son API d'embed n'expose pas le volume | non | non |

Deux réserves à ne pas oublier : `endSeconds` est approximatif à la seconde
près (ce n'est pas un point de montage exact), et sur `/partage` le script
sera chargé chez un visiteur anonyme — signalé à l'auteur, qui a maintenu
« les trois pages de lecture ».

Un bloc mélangeant les fournisseurs reste donc **inégal par construction**.
L'éditeur doit le dire à côté du lien concerné, plutôt que d'afficher des
réglages sans effet.

### Découpage

Deux lots, dans cet ordre. Le lot 1 se tient entièrement sur l'iframe
actuelle : il est testable immédiatement, et il livre les deux demandes
d'origine. Le lot 2 est une refonte du lecteur partagé.

---

### Lot 1 — Bloc invisible, bouton discret, lecture à la visite

#### Étapes

1. **Schéma** — `src/core/schemas/blocks/music.ts` : ajouter
   `autoplayOnVisit: z.boolean().default(false)`. Champ optionnel avec défaut :
   les blocs déjà en base restent valides sans migration de données. **Défaut
   à `false`** — un wiki qui se met à jouer du son sans qu'on l'ait demandé est
   une mauvaise surprise ; l'auteur coche quand il le veut. `registry.ts` le
   pose aussi dans la donnée par défaut d'un bloc neuf : elle est insérée
   telle quelle en base, sans passer par Zod, donc le défaut du schéma seul ne
   suffisait pas.
2. **Rendu public** — `PublicBlockView.tsx` : `music` renvoie `null`, y compris
   son titre (même traitement qu'une image cochée « fond de page », déjà en
   place au même endroit). Plus aucun cadre vide.
3. **Bouton au titre de la fiche** — le plan (quels boutons, lequel démarre à
   la visite) est calculé par `planMusicAttachments`, une fonction pure de
   `src/core/music/blockAttachment.ts`, **testée d'abord** : c'est la seule
   partie qui demande un raisonnement, et elle s'éprouve en millisecondes là
   où elle exigerait un wiki publié et un navigateur si elle restait dans un
   composant serveur. `PublicEntityBody.tsx` extrait les blocs `music` du fil
   normal (comme il le fait déjà pour `session_journal_meta`) et rend un
   bouton par bloc à côté du `<h1>`. Le bouton est un composant client, seul
   élément interactif ajouté à une page par ailleurs servie en rendu serveur.
4. **Lecture à la visite** — quand `autoplayOnVisit` est coché, la première
   piste démarre au montage via `useMusicPlayback().play()`. Reprend la logique
   de l'ancien `AutoPlayMusicBlock.tsx`. Si plusieurs blocs de la même fiche
   sont cochés, **le premier dans l'ordre de la fiche gagne** — le lecteur
   partagé n'a qu'une source à la fois, laisser deux blocs se disputer le
   lecteur donnerait un résultat dépendant de l'ordre de montage.
5. **Éditeur** — `MusicBlockEditor.tsx` : case à cocher « Lancer la première
   piste à la visite de la fiche » (`components/shared/Checkbox.tsx`, jamais la
   case native). L'éditeur garde par ailleurs son affichage actuel (liste de
   pistes, bouton par piste) : on ne masque le bloc que sur les pages de
   lecture, une fiche qu'on modifie n'est pas une fiche qu'on visite pour son
   ambiance.
6. **Nettoyage** — supprimer `components/entities/player/PlayerBlockView.tsx`
   et `AutoPlayMusicBlock.tsx` (code mort, voir Constat), et corriger le
   commentaire périmé de `app/m/[worldSlug]/joueur/wiki/[entitySlug]/page.tsx`.

#### Critères

- [x] La case « Lancer à la visite » existe dans l'éditeur, décochée par
      défaut, et **persiste** : vérifiée en navigateur sur la fiche « Fine
      Lââm » du monde ClaudeLand, avec le lien YouTube fourni par l'auteur —
      cochée, sortie du bloc (l'éditeur enregistre à la perte du focus,
      `EntityBlocks.tsx`), rechargement, `aria-checked="true"` et nom de piste
      conservés. C'est l'aller-retour Zod du nouveau champ qui était en
      question, il est bon.
- [x] Le plan d'affichage est couvert par 11 tests unitaires
      (`src/core/music/blockAttachment.test.ts`) : extraction des blocs du fil,
      un bouton par bloc, position du bloc sans effet sur le résultat, bloc
      sans piste ignoré, première piste seule retenue, premier bloc coché
      gagnant, champ absent traité comme un refus.
- [x] Un bloc musique n'affiche plus rien du tout — ni cadre, ni titre.
      Constaté sur `/partage/leschroniquesdesroyaumesoublies/37` (entrée
      « Prologue » du Livre de sessions) : un seul `h3.block-title` sur la
      page, aucun cadre « Musique ».
- [x] Un bouton ▶/⏸ discret apparaît à côté du nom de la fiche, centré sur la
      hauteur du titre, et bascule bien en ⏸ pendant la lecture.
- [x] Case cochée : la première piste démarre en arrivant sur la fiche — sous
      la réserve d'activation ci-dessous, constatée puis corrigée en direct.
- [ ] Case décochée : rien ne démarre à la visite, le bouton fonctionne.
- [ ] Lancer une piste de bloc met toujours la radio d'arrière-plan en pause,
      et inversement (acquis de V2-G3, à ne pas casser) — pas encore reproduit,
      la radio n'existe pas sur le partage anonyme.
- [x] `npm run typecheck` et `npm run lint` passent ; `test:core` (818 tests,
      81 fichiers) et la suite hors intégration (836 tests, 84 fichiers)
      passent.

#### Le bouton mentait — constaté en production, corrigé

Première vraie utilisation, sur l'entrée « Prologue » publiée : la musique ne
démarrait pas à la visite, **mais le bouton s'affichait quand même en ⏸**, et
il fallait **deux clics** pour lancer le son.

Mesuré sur la page : l'iframe était bien montée
(`…/embed/j940HnlMM8k?…&autoplay=1`), le bouton annonçait « Mettre en pause »,
et `navigator.userActivation.hasBeenActive` valait `false`. Le navigateur
avait donc refusé le son **en silence** — l'iframe existe, rien n'en sort.

La cause est dans l'enchaînement, pas dans le lecteur : `PublicMusicToggle`
demandait la lecture sans condition, le lecteur partagé enregistrait la source,
`currentKey` correspondait, le bouton passait en ⏸. Le premier clic était donc
interprété en « pause » (il ne faisait que défaire cet état), et seul le second
lançait vraiment — cette fois avec un geste utilisateur.

Correctif : ne demander la lecture automatique que si
`navigator.userActivation.hasBeenActive` est vrai. C'est la seule façon de
savoir **à l'avance** si la demande aboutira. Faux sur un lien de partage
ouvert à froid, vrai dès qu'on navigue dans le wiki (même document) : la
lecture à la visite fonctionne donc là où elle le peut, et le bouton dit la
vérité partout.

Vérifié en local sur la même page de partage, les trois états :

| Scénario | iframe | Bouton |
|---|---|---|
| Lien ouvert à froid | aucune | ▶ « Lancer » |
| Un seul clic | montée, `autoplay=1` | ⏸ |
| Retour par navigation interne | montée d'elle-même | ⏸ |

**Suite, sur décision de l'auteur** : sur un lien de partage ouvert à froid —
le cas principal de `/partage` — la lecture à la visite ne se déclencherait
jamais, par construction du navigateur. Elle est donc **armée sur le tout
premier geste du visiteur** (un `pointerdown` ou un `keydown` n'importe où dans
la page, en phase de capture). Vérifié : un clic sur un simple paragraphe
charge l'API et lance la musique.

Le geste étant capturé avant les gestionnaires de la page, un premier clic
porté sur le bouton lui-même appelle `play` deux fois avec la même clé — ce qui
ne relance rien, la source étant identique.

#### Noté au passage, hors périmètre — un test d'intégration fragile

`homebrewWeapon.integration.test.ts` a échoué une fois sur « Test timed out in
5000ms », puis est repassé trois fois de suite, et il passe aussi sur la
branche sans les modifications de ce ticket. Son corps prend 3 à 4,2 s contre
un délai d'attente de 5 s : il tape le vrai Supabase, et la moindre gigue
réseau le fait basculer. Ce n'est pas un test cassé, c'est un test dont la
marge est trop mince — il rendra la suite complète capricieuse tant qu'on ne
lui donnera pas un délai adapté à un appel réseau. À traiter dans son propre
ticket, pas ici.

---

### Lot 2 — Lecteur YouTube piloté : fondu, enchaînement, bornes

#### Étapes

1. **ADR** — `docs/adr/NNNN-lecteur-youtube-pilote.md` : V2-G3 avait
   explicitement écarté les SDK par plateforme ; on y revient pour le fondu, en
   connaissance de cause et pour YouTube seulement. Contexte, options (iframe
   bête / API YouTube / API par fournisseur), décision, conséquences (script
   tiers sur le wiki public y compris anonyme, comportement inégal selon le
   fournisseur du lien). À écrire **avant** le code : c'est le renversement
   d'une décision déjà consignée.
2. **Noyau pur d'abord, tests en tête** — `src/core/music/` :
   - calcul de la rampe de volume (durée, pas, position → volume 0-100),
     fonction pure, aucune dépendance au navigateur ;
   - `toEmbedUrl` étendu aux bornes `start`/`end` pour le repli iframe ;
   - bornes validées l'une contre l'autre (`endSeconds > startSeconds`).
3. **Schéma** — `music.ts` : `fadeInMs` / `fadeOutMs` au niveau du bloc (mêmes
   bornes que le bloc image, 0-3000, à confirmer à l'usage) ; `startSeconds` /
   `endSeconds` optionnels **par piste**.
4. **Refonte du lecteur partagé** — `MusicPlaybackContext.tsx` : lecteur
   YouTube piloté par l'API quand la piste est YouTube, repli sur l'iframe
   actuelle sinon. La règle « une seule iframe » devient « une seule source
   **active** » : pendant un fondu croisé, deux lecteurs coexistent le temps de
   la transition, l'ancien étant démonté une fois son volume à zéro. Le script
   YouTube n'est chargé qu'à la première piste YouTube effectivement jouée,
   jamais au chargement de la page.
5. **Enchaînement** — sur `ENDED`, passer à la piste suivante du bloc, dans
   l'ordre. S'arrêter en fin de liste (pas de boucle — à demander à l'auteur si
   le besoin apparaît, pas avant). `planMusicAttachments` ne retient
   aujourd'hui que la première piste : c'est là que la liste complète devra
   remonter.
6. **Éditeur** — réglages de fondu au niveau du bloc, champs début/fin par
   piste, et mention explicite à côté d'une piste Spotify/SoundCloud que ces
   réglages ne s'y appliquent pas.
7. **Radio d'arrière-plan** — les durées de fondu sont portées par la source
   qu'on lance, pas par le lecteur : la radio (`RadioWidget.tsx`) n'en fournit
   aucune et garde donc exactement son comportement actuel. Aucune modification
   de son côté.

#### Critères

- [x] **Fondu entrant et sortant réellement appliqués**, mesurés sur
      `/partage/leschroniquesdesroyaumesoublies/37` en écoutant les messages du
      lecteur : montée `0 → 4 → 7 → 21 → 24 …`, descente
      `100 → 96 → 93 → … → 3 → 0` en 31 paliers, soit exactement `fadeVolumeAt`
      battu toutes les 50 ms sur 1500 ms, puis la voix se retire d'elle-même.
- [x] **Le script YouTube n'est pas chargé tant que rien ne joue.** Sur un
      chargement à froid : aucun `<script src="…/iframe_api">`, `window.YT`
      indéfini, aucune iframe. Il n'apparaît qu'au premier geste.
- [x] **Lecture réelle vérifiée**, pas seulement une iframe montée : le
      `currentTime` du lecteur avance (21,4 s → 25,9 s en 5 s d'observation).
- [x] `npm run typecheck` et `npm run lint` passent ; 860 tests hors
      intégration (85 fichiers), dont 24 nouveaux sur `fade.ts`,
      `youtubeVideoId` et les bornes.
- [ ] Deux pistes YouTube dans un bloc s'enchaînent dans l'ordre, sans
      intervention — **implémenté mais pas encore constaté** : il faut un bloc
      à deux pistes sur une fiche publiée, or le compte de test ne peut pas en
      créer (voir « Ce qui bloque » du lot 1). Le plus rapide : ajouter une
      seconde piste au bloc du Prologue, et une borne `fin` courte à la
      première pour ne pas attendre la fin du morceau.
- [ ] Bornes début/fin respectées sur une piste YouTube — même situation :
      la traduction d'URL est testée unitairement, le passage à
      `loadVideoById` ne l'est pas encore en navigateur.
- [ ] En passant d'une fiche à une autre portant chacune sa musique, les deux
      se chevauchent — demande deux fiches publiées portant chacune un bloc.
- [ ] Une piste Spotify ou SoundCloud continue de fonctionner — sans fondu,
      sans enchaînement, sans bornes — et l'éditeur le dit.
- [ ] Exclusion mutuelle avec la radio toujours vraie dans les deux sens
      (la radio n'existe pas sur le partage anonyme).

#### Un plantage trouvé en navigateur, invisible autrement

`YT.Player(element)` **remplace** l'élément qu'on lui confie par son iframe.
Lui donner un nœud rendu par React faisait tomber la page entière au
démontage de la voix — `NotFoundError: Failed to execute 'removeChild'` —
c'est-à-dire précisément à la fin du fondu sortant : React croyait encore
gérer un nœud que YouTube avait fait disparaître.

Correctif : le composant ne rend qu'un conteneur vide et lui greffe à la main
un enfant, que React ne suit pas ; c'est cet enfant que YouTube remplace.
Retirer un conteneur dont React ignore le contenu ne pose aucun problème.

Rien dans les types ni dans les tests ne pouvait attraper ça : `typecheck`,
`lint` et 860 tests passaient avec le bug en place.

---

## Ordre suivi

Aucune dépendance technique dure entre ces cinq tickets. Fait dans l'ordre
V2.1-1, V2.1-2, V2.1-4, V2.1-5, puis V2.1-3 en dernier (le seul dont le
plan initial a changé en cours de route, une fois la présentation en
sommaire tranchée avec l'auteur). **Les cinq tickets d'origine de ce backlog
sont clos.**

V2.1-6 est arrivé après coup, sans dépendance sur les précédents. Ses deux
lots, eux, sont ordonnés : le lot 2 refond le lecteur partagé que le lot 1
utilise tel quel. Avancement tenu à jour dans les cases à cocher de chaque
lot, au fur et à mesure — pas à la fin.
