# Backlog V2.1 — Correctifs pour la table de jeu

Cinq demandes de l'auteur (4 septembre 2026), au service direct de sa table
(joueuses + MJ) plutôt que du reste du plan V2/V3 — plus une sixième arrivée
le 13 septembre, une fois les cinq premières closes — puis quatre traînes
ouvertes en relisant le backlog et en instruisant des incidents. Chaque ticket suit la
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
| V2.1-6 | Bloc musique : ambiance sonore sur le wiki public | `L` | **Fait** (14 septembre) — les deux lots livrés, tous les critères vérifiés en navigateur. Le dernier a trouvé un bug : Spotify localise ses liens de partage (`/intl-fr/track/…`), que le résolveur refusait en silence |
| V2.1-7 | Une modification qui ne s'enregistre pas, et des contrôles anonymes | `M` | **Fait** (14 septembre) — né de V2.1-6 : une case cochée se perdait en silence, deux fois en un jour. Troisième occurrence du même défaut, donc traité à la cause (ADR 0023). Corrige au passage le nom accessible des cases et des listes |
| V2.1-8 | `onSaveNow` rejoint le contexte d'enregistrement | `S` | **Fait** (14 septembre) — la traîne consignée en fin de V2.1-7 : le bloc carte gardait le correctif ponctuel d'avant l'ADR 0023. Remplacement mécanique, comportement mesuré identique avant/après |
| V2.1-9 | Un test d'intégration à la marge trop mince | `S` | **Fait** (14 septembre, avant d'être écrit) — `homebrewWeapon.integration.test.ts` échouait par intermittence sur le délai de 5 s de Vitest. Corrigé dans la foulée de V2.1-6 sans qu'aucun ticket ne le porte ; consigné ici après coup |
| V2.1-10 | Deux traînes du dépassement de quota Vercel | `S` + `M` | **Fait** (15 septembre) — volet A **caduc, mesuré** : `npm ci` passe, npm 11.17 ne traite plus la peer optionnelle comme bloquante. Volet B : **quatre** chaînes vers `sharp` et non deux, les deux autres trouvées en vérifiant avant de coder. Mesuré : 79 fonctions portaient le binaire, il en reste 4 — les quatre routes qui téléversent |
| V2.1-11 | Bloc image : ancrage explicite, fond de page à trois états, parallaxe | `L` | **Fait** (15 septembre) — trois lots. L'ancrage devient explicite et l'image entre DANS son bloc hôte, ce qui fait tomber ensemble la bordure orpheline et le décalage au-dessus du titre. Interface esquissée et manipulée avant d'écrire une ligne : la séance a déplacé le modèle de données |
| V2.1-12 | Une seule peau de wiki, dans les layouts | `L` | **Fait** (15 septembre) — l'onglet Wiki joueur réimplémentait `BookSkin` et la copie n'avait pas emporté le fond de page. La coquille remonte dans les `layout.tsx` (par monde), l'enregistrement du fond reste dans la page (par fiche) : le sommaire cesse de se reconstruire, sur `/apercu` comme chez le joueur. `/partage` garde la sienne dans sa page, sa garde par mot de passe devant précéder tout chargement |

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
- [x] **Case décochée : rien ne démarre à la visite, et le bouton
      fonctionne** — mesuré sur une page de partage ouverte à froid, bloc
      `autoplayOnVisit` décoché :

      | Moment | iframes | Bouton | `hasBeenActive` |
      |---|---|---|---|
      | Arrivée à froid | 0 | Lancer « Musique » | `false` |
      | Après un clic sur un paragraphe | **0** | Lancer « Musique » | **`true`** |
      | Après un clic sur le bouton | 1 | Mettre en pause « Musique » | `true` |

      **C'est la ligne du milieu qui compte.** Le lot 1 arme la lecture à la
      visite sur le tout premier geste du visiteur, faute de quoi elle ne
      partirait jamais sur un lien ouvert à froid. Il fallait donc vérifier que
      cet armement **ne se déclenche pas** quand la case est décochée : le
      geste neutre a bien fait passer `navigator.userActivation.hasBeenActive`
      à `true` — l'écouteur a eu sa chance — et rien n'a démarré. Sans cette
      étape, le critère se serait contenté d'observer une page inerte, ce qui
      n'aurait rien prouvé.
- [x] Lancer une piste de bloc met toujours la radio d'arrière-plan en pause,
      et inversement (acquis de V2-G3, à ne pas casser) — vérifié sur la fiche
      de Fine Lââm ; voir le critère jumeau du lot 2, une seule mesure couvre
      les deux puisque le lecteur partagé est le même. À noter pour la suite :
      **ce point ne se teste pas sur `/partage`**, où il n'y a pas de radio du
      tout — attendre un lien de partage était une impasse.
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

#### Noté au passage, hors périmètre — `npm run lint` cassé par un worktree

`npm run lint` échouait dès qu'une session d'agent laissait un worktree sous
`.claude/worktrees/`. Git ignore ce chemin (`.git/info/exclude`), mais ESLint
parcourt le disque, pas l'index : il vérifiait le projet une fois de plus par
worktree ouvert. Le symptôme était trompeur — une violation du confinement du
client service-role — alors que le fichier fautif était le fichier confiné
lui-même, que la règle reconnaît par son chemin et que le préfixe de worktree
rendait méconnaissable. Corrigé par `.claude/worktrees/**` dans le
`globalIgnores` (et non `.claude/**` : un script ou une config JS ailleurs sous
`.claude/` doit rester vérifié).

#### Noté au passage, hors périmètre — un test d'intégration fragile

`homebrewWeapon.integration.test.ts` a échoué une fois sur « Test timed out in
5000ms », puis est repassé trois fois de suite, et il passe aussi sur la
branche sans les modifications de ce ticket. Son corps prend 3 à 4,2 s contre
un délai d'attente de 5 s : il tape le vrai Supabase, et la moindre gigue
réseau le fait basculer. Ce n'est pas un test cassé, c'est un test dont la
marge est trop mince.

**Traité à part le jour même, en V2.1-9** — et en réalité **avant** que cette
note ne soit écrite : le commit `261ec55` (10 h 20) sépare les tests
d'intégration en un projet Vitest à part, cette note date de 10 h 29. Elle a
annoncé un chantier déjà fait, et aucun ticket ne le portait jusqu'ici.

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
   l'ordre. S'arrêter en fin de liste — **le besoin de la boucle est apparu
   ensuite**, voir ci-dessous.
5 bis. **Lecture en boucle** (demandée après coup) — case à cocher dans le
   bloc : arrivé au bout de la liste, on repart de la première piste, y
   compris quand le bloc n'en a qu'une, le cas le plus courant d'une ambiance.
   Décochée par défaut : les blocs déjà posés s'arrêtaient en fin de liste, ils
   continuent de s'arrêter. La décision sort du fournisseur de contexte pour
   devenir `nextTrackIndex` (`src/core/music/nextTrack.ts`), fonction pure et
   testée — elle a assez de cas limites (piste unique, liste vide, index devenu
   hors liste parce qu'on a retiré une piste en cours de lecture) pour mériter
   d'être éprouvée sans navigateur.

   **Un piège à ne pas rouvrir** : la voix est identifiée par une clé React. Un
   bloc d'une seule piste en boucle revient au même index — sans numéro de
   passage (`lap`) dans la clé, React ne remonterait rien et la piste ne
   repartirait jamais. C'est le `lap` qui force la reconstruction, et qui rend
   au passage son fondu entrant à chaque tour.
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
- [x] **Deux pistes YouTube s'enchaînent dans l'ordre, sans intervention.**
      Mesuré en production sur le Prologue, l'auteur ayant ajouté une seconde
      piste et une borne `Fin` à 10 s :

      | Piste | Temps joué |
      |---|---|
      | `j940HnlMM8k` (borne Fin à 10 s) | 0 → **10,013 s**, puis arrêt |
      | `QgtiY-77j-k` | reprend à 0 et continue |

      Une seule iframe tout du long, et la piste enchaînée monte en fondu
      (`0 → 7 → 10 → 20 → 34`).
- [x] **Bornes début/fin respectées** — 10,013 s pour une borne à 10 s, soit
      13 ms d'écart. Conforme à la réserve annoncée (précision à la seconde).
- [x] Les réglages apparaissent bien dans l'éditeur : Début/Fin sous chaque
      piste YouTube, les deux curseurs de fondu en bas du bloc.
- [x] **La lecture en boucle rejoue le bloc arrivé au bout** — constatée
      enfin, et dans les deux formes, avec des bornes `Fin` à 6 s pour ne pas
      attendre la fin des morceaux. Les identifiants de vidéo sont lus dans les
      messages du lecteur, donc c'est bien la piste qui change, pas seulement
      un compteur.

      **Bloc à deux pistes — deux tours complets, sans intervention :**

      | Instant | Piste |
      |---|---|
      | 4,7 s | 1 (`JSk0BUDfAQ4`) |
      | 13,6 s | 2 (`QgtiY-77j-k`) |
      | **22,1 s** | **1 — le bloc repart du début** |
      | 29,4 s | 2 |
      | **37,6 s** | **1 — deuxième tour** |

      **Bloc à une seule piste — le cas que le ticket signalait comme piégeux**
      (voir l'étape 5 bis : un bloc d'une seule piste revient au MÊME index,
      donc sans numéro de passage dans la clé React, rien ne serait remonté et
      la piste ne repartirait jamais). Trois redémarrages observés, toujours la
      même vidéo, toujours une seule iframe :

      | Instant | `currentTime` |
      |---|---|
      | 35,6 s | 6 s → **0** |
      | 43,2 s | 6 s → **0** |
      | 51,0 s | 6 s → **0** |

      Le cas à deux pistes seul n'aurait pas suffi : en passant de 2 à 1,
      l'index change, donc la clé React change de toute façon et le `lap`
      n'est jamais mis à l'épreuve. C'est le bloc d'une seule piste — « le cas
      le plus courant d'une ambiance » — qui l'exerce vraiment.
- [x] **En passant d'une fiche à une autre, les deux musiques se
      chevauchent.** Mesuré du Prologue vers « Brennan Torram » :

      | Temps | État |
      |---|---|
      | 3,6 s | 1 iframe, fiche 37 |
      | 14,6 s | navigation → **2 iframes simultanées** |
      | 16,1 s | retour à 1 iframe |

      Les deux identifiants de vidéo alternent dans le flux de messages pendant
      ce créneau — les deux lecteurs vivent bien en même temps — et il s'écoule
      exactement **1,5 s** entre les deux bascules, le `fadeOutMs` configuré.
- [x] **Une piste Spotify continue de fonctionner — et l'éditeur le dit.**
      Vérifié sur un vrai lien fourni par l'auteur, et **ce critère a trouvé un
      bug** : voir ci-dessous. Une fois corrigé, la piste monte bien son
      iframe, `https://open.spotify.com/embed/track/5aFkncSW2aZuYByqKC0Gse?autoplay=1`,
      et le bouton passe en « Mettre en pause ».

      La preuve la plus nette de la distinction tient dans **un seul bloc
      portant les deux fournisseurs** : la piste Spotify n'affiche aucun champ
      Début/Fin et porte la phrase « Fondu, enchaînement et bornes début/fin ne
      s'appliquent qu'aux liens YouTube » ; la piste YouTube juste en dessous a
      ses deux champs. Des réglages absents valent mieux que des réglages sans
      effet.

      **Ce que je n'ai pas mesuré, et pourquoi** : l'absence de fondu et
      d'enchaînement. Le geste qui semblait les départager — arrêter la piste
      et chronométrer — ne départage rien : mesuré à 28 ms pour Spotify comme
      pour YouTube, parce qu'un arrêt explicite n'est jamais fondu. Les deux
      propriétés tiennent par construction (`VoixIframe` n'a aucun accès au
      volume et n'émet jamais de fin de piste, que seul le lecteur piloté
      produit), mais c'est une lecture du code, pas une mesure — dit ici plutôt
      que maquillé en constat.
- [x] **Exclusion mutuelle avec la radio, vraie dans les deux sens** —
      mesurée le 14 septembre **sur la fiche de Fine Lââm**, dans ClaudeLand,
      contre la station « Station test » que l'auteur a posée (le blocage
      d'origine : voir ci-dessous). Les deux bascules, avec l'état des deux
      boutons, le compte d'iframes, et le temps de lecture observé :

      | Geste | Bouton du bloc | Bouton de la station | iframes | `currentTime` |
      |---|---|---|---|---|
      | Piste du bloc lancée | Mettre en pause | Lecture | 1 | 7,8 → 13,4 s (bloc) |
      | Station lancée par-dessus | **Lecture** | **Mettre en pause** | 1 | 5,1 → 10,8 s (radio) |
      | Piste du bloc relancée | **Mettre en pause** | **Lecture** | 1 | 8,5 → 14,2 s (bloc) |

      Trois choses tiennent ensemble, et il fallait les trois :

      1. **Les deux boutons basculent**, chacun dans le bon sens, à chaque fois.
      2. **Il reste exactement une iframe, et jamais la même** : celle en place
         avant chaque bascule a été marquée, puis retrouvée **retirée du
         document** après. Ce n'est pas un lecteur qu'on repointe, c'est
         l'ancien qu'on démonte — l'invariant « une seule source active » est
         constaté, plus déduit.
      3. **Les deux jouent réellement**, ce que ni le bouton ni le compte
         d'iframes ne prouvent : le `currentTime` du lecteur avance dans les
         trois états, lu dans les messages du lecteur. Une iframe montée mais
         muette aurait passé les deux premiers points.

      La même mesure avait d'abord été faite dans un monde de test jetable,
      faute de station disponible ; elle a donné exactement le même résultat.
      C'est attendu — le lecteur partagé est monté une seule fois dans
      `app/layout.tsx` et ne connaît ni le monde ni la campagne — mais ça ne se
      raconte pas, ça se refait.

#### Le bug que ce dernier critère a trouvé — Spotify localise ses liens

Le lien fourni par l'auteur était `https://open.spotify.com/intl-fr/track/…`.
**Ce préfixe n'est pas une curiosité : Spotify le pose lui-même**, depuis son
propre bouton « Copier le lien », dès que l'interface n'est pas en anglais —
donc systématiquement, pour ce projet.

`toEmbedUrl` ancrait sa reconnaissance en début de chemin
(`/^\/(track|playlist|…)/`). Le segment de langue faisait échouer la
correspondance, et la fonction renvoyait `null`.

**Le symptôme était le pire possible : le silence.** `detectProvider` ne
regarde que l'hôte, donc le lien passait la validation à l'ajout ; la piste
s'inscrivait dans le bloc, le bouton basculait en pause au clic — et aucune
iframe n'était montée. Exactement le « bouton menteur » que ce ticket avait
déjà combattu au lot 1, sous un autre visage.

**Corrigé dans le noyau pur, tests d'abord** : un préfixe `intl-xx` (ou
`intl-xx-yy`) optionnel devant le type de ressource. Toléré comme préfixe
précis, jamais comme joker — `/nimporte/track/abc` et `/intl-francais/track/abc`
restent refusés, et un test le fixe. C'est le même principe que le refus de
`open.spotify.com.evil.com` déjà en place : on élargit ce que Spotify produit
vraiment, pas ce qui ressemble de loin à un lien Spotify.

Ni les types ni les 994 tests d'alors ne pouvaient attraper ça : la seule
forme d'URL Spotify éprouvée était la forme anglaise. **Un lien réel de
l'auteur a suffi** — et c'est le troisième défaut de ce ticket que seul un
usage réel a révélé.

#### Comment ces deux derniers critères ont été éprouvés

Les deux — case décochée, lecture en boucle — demandaient une **page de
lecture** et des réglages qu'aucune fiche existante ne portait. Ils ont donc
été montés dans un monde de test (« Test boucle V2.1-6 », supprimé une fois
les mesures prises) : une fiche publiée, un lien de partage, et deux blocs
`music` — l'un à deux pistes, l'autre à une seule — tous deux en boucle, avec
des bornes `Fin` à 6 s pour que le tour se referme en quelques secondes plutôt
qu'en quatre minutes.

Rien de tout cela ne pouvait se faire dans ClaudeLand ni dans Les Chroniques :
le compte de vérification y est joueur, et surtout ces réglages auraient
modifié le contenu de l'auteur.

**Une borne `Fin` courte est l'outil qui rend ce critère testable.** Sans
elle, vérifier une boucle demande d'écouter un morceau entier ; avec elle, deux
tours complets tiennent dans quarante secondes. À réutiliser telle quelle la
prochaine fois.

#### Ce qui a tenu ce critère ouvert si longtemps

Le blocage annoncé — « la radio de ce monde ne contient aucune station » — ne
pouvait pas être levé par l'assistant seul. C'est une contrainte
d'autorisation, pas un oubli.

**Une station de radio n'est plus une préférence de navigateur.** La note de
V2-G3 (`docs/BACKLOG_V2.md`) décrit encore des stations en `localStorage` ;
elles ont depuis migré côté serveur — table `world_radio_stations`, sous RLS,
**stations du monde** sur retour explicite de l'auteur (« les stations radio
sont celles que le MJ met en place pour ce monde et accessibles aux joueurs »).
Ajout et suppression sont réservés au MJ : `canManage`, calculé côté serveur
par `isWorldAdmin`, et la route `POST` refuse tout le reste.

Le compte connecté dans le navigateur de vérification est un compte **joueur**
de ClaudeLand — `GET /api/worlds/faerun-copie-3/radio-stations` répond
`canManage: false`. Poser une station y demandait donc le compte MJ de
l'auteur, ce qu'il a fait ; la lecture, elle, est ouverte à tout membre, donc
le compte joueur a pu lancer la station sans rien changer d'autre.

**Deux fausses pistes écartées en chemin**, parce qu'elles se représenteront :

- **Le partage anonyme.** Le critère du lot 1 attendait d'être reproduit sur
  `/partage`. Il ne peut pas l'être : il n'y a pas de radio du tout sur une
  page de partage, donc aucune exclusion à y vérifier.
- **Un lien d'invitation ne confère pas le rôle qu'on croit.** L'auteur a
  d'abord transmis un lien `/rejoindre/<token>` en pensant y attacher un accès
  MJ. Ce jeton était l'invitation **joueur déjà réclamée** par le compte du
  navigateur : la page court-circuite vers `/entrer`, rétablit la même session,
  et `canManage` reste `false`. Le rôle d'un lien se choisit à sa création
  (`InviteLinkPanel`, liste « Rôle du lien » : Au choix / Joueur / MJ), jamais
  à sa réclamation.

Rien n'a été écrit dans ClaudeLand par l'assistant : la station y a été posée
par l'auteur, depuis son propre compte.

#### Le premier clic sur le bouton s'annulait lui-même

Trouvé en production, et invisible aux tests comme aux types : quand le tout
premier geste du visiteur était un clic sur le bouton, **rien ne partait**.

`pointerdown` et `click` sont deux événements distincts, et React a le temps de
rafraîchir entre les deux. L'écouteur qui arme la lecture au premier geste
lançait donc la musique sur `pointerdown` ; à l'arrivée du `click`, le
`onClick` du bouton voyait une lecture en cours et appelait `stop()`. Le
premier clic armait et mettait en pause dans la foulée.

Le diagnostic a demandé deux passes, et la première était incomplète : j'ai
d'abord cru à deux appels concurrents de `play`, corrigés par un garde
d'idempotence dans `MusicPlaybackProvider` (demander la source déjà active ne
relance rien) et par un `fondre` qui prévient l'appelant même sans lecteur —
deux gardes justes en soi, gardés. Mais la vraie cause était le `stop()`.
L'écouteur se contente désormais de se désarmer quand le geste vient du bouton
lui-même.

Aucune de ces trois erreurs n'était détectable sans navigateur : `typecheck`,
`lint` et 870 tests passaient à chaque fois.

#### Fragilité trouvée au passage — l'enregistrement à la perte du focus

Un bloc s'enregistre quand le focus le quitte (`handleBlockBlur`,
`EntityBlocks.tsx`). Pour un champ de texte, on en sort naturellement ; pour
une **case à cocher**, le geste naturel est de cocher puis de partir — et la
modification est perdue sans le moindre signe. Le piège a mordu deux fois sur
ce seul ticket, l'assistant puis l'auteur, à chaque fois sur une case du bloc
musique.

Ce n'est pas propre à ce bloc et ça débordait de ce ticket : **traité à part,
en V2.1-7**.

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

## V2.1-7 — Une modification qui ne s'enregistre pas, et des contrôles anonymes · `M` — fait

### Constat

Né de V2.1-6, et de deux pertes de données à quelques heures d'intervalle : une
case à cocher du bloc musique cochée, la page quittée, la modification perdue
**sans le moindre signe** — une fois par l'assistant, une fois par l'auteur.
Dans les deux cas la case paraissait cochée à l'écran alors que la donnée
servie au wiki public disait encore `false`.

Un bloc ne s'enregistre qu'à la perte du focus (`handleBlockBlur`,
`EntityBlocks.tsx`). Cette règle épouse bien la saisie de texte — on sort d'un
champ pour aller ailleurs — et mal tout le reste : avec une case à cocher ou
une liste déroulante, le geste naturel est d'agir **puis de partir**.

**Ce défaut avait déjà mordu deux fois avant**, chaque fois corrigé sur place :

1. **Bloc carte** (Lot I) — un téléversement « visible à l'écran, jamais
   persisté ». Corrigé par une prop `onSaveNow` passée de main en main.
2. **Listes déroulantes** — le menu vit dans un portail hors de la carte du
   bloc, donc cliquer une option faisait sortir le focus *avant* la sélection,
   et le blur enregistrait l'état précédent. Corrigé par un `onMouseDown`
   préventif qui, en gardant le focus dans le bloc, a figé l'autre moitié du
   problème.

Avec la case du bloc musique, cela fait trois. La règle des trois dit qu'il est
temps de traiter la cause au lieu du symptôme.

**Découverte pendant le correctif**, et de la même famille : les cases à cocher
n'avaient **aucun nom accessible**. Un `<label>` ne nomme que les contrôles
natifs, et `Checkbox` est un `<span role="checkbox">` — l'envelopper n'a jamais
suffi. Les listes déroulantes, elles, avaient un nom, mais c'était **la valeur
choisie** : un lecteur d'écran annonçait « Public, bouton » sans jamais dire de
quoi « Public » est la réponse.

### Mesure de l'étendue, avant de choisir

- **19 éditeurs de bloc**, dont **11** portent des contrôles non textuels et
  **10** passent par le chemin fautif (seul le pointage d'un objectif de quête
  y échappe, il a sa propre route).
- **79 utilisations de `Dropdown`**, dont **13** sans `aria-label` — alors que
  la charte le prescrivait depuis la V2. Mon propre relevé n'en avait trouvé
  que 11 : les deux derniers ont été débusqués par le compilateur, ce qui est
  exactement l'argument pour une garantie de type plutôt qu'un audit.

Fait déterminant pour le choix de mécanisme : `Checkbox` et `Dropdown` sont des
widgets ARIA maison — la charte les impose pour ne pas dépendre des contrôles
natifs — et n'émettent donc **aucun événement `change`** qu'un conteneur
pourrait écouter. La solution élégante était morte d'avance.

### Décision

`docs/adr/0023-enregistrement-des-blocs.md`, écrit avant le code : **un
contrôle discret enregistre son bloc immédiatement, le texte garde le blur.**

Un contexte minuscule (`components/shared/EditCommitContext.tsx`) porte le
signal ; `Checkbox` et `Dropdown` le réclament, `EntityBlocks` le fournit par
carte. **Aucun des dix éditeurs concernés n'est touché**, et hors d'un bloc le
contexte vaut `null` — les deux composants se comportent partout ailleurs
exactement comme avant.

Options pesées puis écartées, détaillées dans l'ADR : un enregistrement différé
sur toute modification (multiplierait les écritures pendant la frappe, alors
que le projet a déjà touché ses quotas Supabase), un simple avertissement au
départ de la page, un bouton « Enregistrer » par bloc.

### Étapes

1. **Le mécanisme d'engagement** — contexte + les deux composants partagés +
   le fournisseur dans `EntityBlocks`. `saveBlock` fusionne les demandes d'un
   même tour, pour qu'un éditeur qui enregistre déjà explicitement (fiche de
   personnage, bloc carte via `onSaveNow`) n'écrive pas deux fois.
2. **L'indicateur d'enregistrement** — l'écriture était entièrement muette, et
   c'est ce silence qui a laissé passer trois pertes. En **deux temps** :
   « Enregistrement… » dès le départ de la requête, « Enregistré » à son
   arrivée, effacé sur échec. Le premier jet n'affichait qu'« Enregistré » au
   retour — une à deux secondes après le geste, trop tard pour rassurer.
3. **Nom accessible des cases** — le libellé visible est rendu dans un élément
   porteur d'un identifiant, réclamé par `aria-labelledby`. Le type impose
   qu'une case soit nommée : libellé visible **ou** `aria-label`.
4. **Nom accessible des listes** — `aria-label` devient obligatoire par le
   type. Les 13 appels manquants sont nommés par ce qu'ils **choisissent**,
   jamais par ce qu'ils affichent. `RuleSelect` réclame ce nom à ses cinq
   appelants au lieu d'en inventer un.
5. **Revue des 65 libellés préexistants** — voir ci-dessous.
6. **Charte** (`docs/CHARTE-UI.md` §3) — elle prescrivait la règle, elle dit
   désormais que le type l'impose, et pourquoi le piège se voit mal.

### Ce que la revue des libellés a trouvé

Je cherchais des noms qui décrivent la valeur au lieu du rôle. Il n'y en avait
qu'un. Le vrai défaut, **huit sélecteurs**, était ailleurs : un nom **statique
dans une liste répétée**. Chaque aspiration annonçait « Horizon », chaque
couche de carte « Visibilité de la couche », le commanditaire de quête comme
chacun de ses objectifs « Entité liée ». Six boutons homonymes d'affilée, sans
moyen de savoir lequel appartient à quelle ligne : le nom existait, il ne
servait à rien.

Chacun porte désormais ce qui identifie sa ligne — le texte saisi quand il
existe, son rang à défaut. La case à cocher de chaque objectif de quête
souffrait du même travers, trouvée à deux lignes de là.

Trois autres au passage : `"Recuperation"` était le seul libellé du dépôt sans
accents ; le choix d'un membre de catégorie s'annonçait par son propre contenu,
identique à la valeur affichée tant que rien n'est choisi ; et `CampaignDetail`
avait quatre sélecteurs nommés « Personnage », « Fiche » et « Joueur » **deux
fois** sur la même page.

### Critères

- [x] Cocher une case enregistre le bloc **immédiatement** — vérifié en
      navigateur : exactement **une** requête `PATCH`, tout de suite, et la
      valeur survit à un rechargement immédiat, le scénario qui la perdait.
- [x] Un éditeur qui enregistre déjà explicitement n'écrit pas deux fois.
- [x] L'indicateur apparaît **dès le geste** : « Enregistrement… » à 262 ms,
      « Enregistré » à 2 257 ms sur la même écriture, puis effacé après 2 s.
- [x] **Sur échec, aucune réussite n'est annoncée** — éprouvé sur un `500`
      forcé : aucun « Enregistré », seul le bandeau d'erreur, à 401 ms.
- [x] Les cases ont un nom accessible — `aria-labelledby` résout les trois
      cases de la fiche de test vers leur libellé visible.
- [x] Une case sans nom **ne compile plus** — éprouvé sur un fichier témoin
      (`TS2322`), témoin supprimé. Un type qui n'interdit rien ne vaut rien.
- [x] Les 79 listes déroulantes sont nommées, et les noms répétés dans une
      liste sont distincts ligne à ligne.
- [x] Rien n'a cassé — vérifié en navigateur après coup : la fiche se charge,
      les listes s'ouvrent et se ferment, la mise en page du libellé de case
      est inchangée (conteneur `flex items-center`, 24 px, un seul élément
      flex sans style).
- [x] `npm run typecheck && npm run lint` passent ; 870 tests hors intégration.

### Une erreur de diagnostic, consignée

Pendant la vérification finale, les fiches ont renvoyé **404**. J'ai testé le
commit d'avant, il répondait 200, et j'en ai conclu — à tort, et je l'ai
annoncé — que ces modifications avaient cassé quelque chose.

La bissection des quatre commits a montré que tous fonctionnent. Les 404
venaient du **démarrage à froid de Turbopack** : les premières requêtes
tombaient pendant la compilation de la route, et l'ancien commit répondait 200
simplement parce que le serveur avait eu le temps de chauffer.

C'est la troisième fois de la journée qu'une corrélation mène à une fausse
cause (voir aussi le `removeChild` et le double `play` de V2.1-6). La leçon est
la même : mesurer avant d'annoncer, et bissecter plutôt que de raisonner.

### Une traîne, depuis refermée

`onSaveNow` (bloc carte) faisait désormais double emploi : la même idée,
trouvée plus tôt pour un seul bloc et câblée en prop. Noté ici plutôt
qu'entrepris au passage, puis traité pour lui-même en **V2.1-8**.

---

## V2.1-8 — `onSaveNow` rejoint le contexte d'enregistrement · `S` — fait

### Constat

L'ADR 0023 a donné à tout l'éditeur un canal unique pour « cette valeur est
engagée » : un contexte minuscule (`EditCommitContext`) que `EntityBlocks`
fournit par carte et que `Checkbox` et `Dropdown` réclament. Il a été écrit
parce que le même défaut avait mordu trois fois — et **la première de ces trois
fois, c'était le bloc carte**, corrigé sur place par une prop `onSaveNow`
passée de main en main sur quatre niveaux : `EntityBlocks` → `BlockDataEditor`
→ `MapBlockEditor` → `MapWorkspace`.

Une fois l'ADR livré, cette prop est le dernier endroit qui résout au cas par
cas un problème désormais résolu pour tout le monde. Deux mécanismes pour une
seule idée, dont l'un se traîne dans la signature de trois composants qui n'ont
rien à faire de la persistance.

Ce n'était pas un risque : les deux chemins aboutissent au même `saveBlock`,
sérialisé par bloc. C'était une redondance — et une redondance dans un
mécanisme dont le silence a déjà coûté trois bugs mérite d'être retirée pendant
qu'on s'en souvient, pas dans six mois.

### Ce que le remplacement change, exactement

`onSaveNow(next)` appelait `onSaveBlock(block.id, { data: next })` : la donnée
en surcharge, parce qu'à l'époque rien ne garantissait que l'état React ait
re-rendu. `commit()` appelle `onSaveBlock(block.id)` tout court.

**C'est équivalent, et pour une raison précise** : les trois appelants font
`onChange(next)` immédiatement avant, et `onChange` remonte jusqu'à
`patchBlock`, qui écrit dans `blocksRef` — le miroir **synchrone** de l'état,
mis à jour dans le même appel que `setBlocks`. `doSaveBlock` lit ce ref, jamais
`blocks`. La donnée neuve est donc déjà en place quand la requête part.

Un seul effet de bord, et il va dans le bon sens : sans surcharge, la demande
passe maintenant par la fusion du même tour (ADR 0023) — deux gestes dans le
même tour ne produisent plus qu'une requête au lieu de deux.

### Étapes

1. `MapWorkspace.tsx` — `useEditCommit()` en tête du composant, `onSaveNow`
   retiré des props ; `upload` et `saveCurrentViewAsDefault` appellent
   `commit?.()`.
2. `MapBlockEditor.tsx` — même chose ; `pickCarte`, `useOwnImage` et
   `saveRefDefaultView` appellent `commit?.()`, et le `MapWorkspace` de la
   modale n'a plus de prop à relayer.
3. `EntityBlocks.tsx` — `onSaveNow` disparaît de `BlockDataEditor` (props,
   documentation, cas `map`) et du rendu de `SortableBlockCard`. Le commentaire
   de fusion de `saveBlock` ne cite plus le bloc carte comme second cas.

`CarteMapPanel.tsx` (vue « Cartes » dédiée) n'est pas touché et n'a rien à
faire : il n'a jamais fourni `onSaveNow`, il ne fournit pas non plus de
contexte, donc `useEditCommit()` y vaut `null` — exactement le comportement
d'avant, où `onChange` persiste lui-même. C'est la propriété qui rendait ce
contexte utilisable partout, elle sert ici une deuxième fois.

### Critères

- [x] Plus une seule occurrence de `onSaveNow` dans le dépôt.
- [x] **Téléverser une carte depuis la modale persiste** — vérifié en
      navigateur sur un monde de test créé pour l'occasion. L'image a été
      posée dans le champ de fichier **par script**, donc sans le moindre
      changement de focus : c'est précisément le cas que la prop protégeait, et
      il n'y a aucun blur pour couvrir l'erreur. Résultat : **exactement un
      `PATCH`**, en `200`. Après rechargement complet, le bouton du bloc
      affiche « Agrandir / remplacer » et non « + Téléverser une carte » — ce
      libellé dépend de l'`assetId` persisté.
- [x] **« Définir cette vue par défaut » persiste** — carte déplacée à la
      souris, bouton cliqué, puis rechargement complet : la modale rouvre sur
      la vue déplacée, pas sur la vue centrée.
- [x] **Le nombre de requêtes est inchangé** — même protocole exécuté deux
      fois, sur le code d'avant (mis de côté par `git stash`) puis sur le code
      d'après, en comptant les `PATCH` par instrumentation de `fetch` :

      | Code | Requêtes | Instants |
      |---|---|---|
      | Avant (`onSaveNow`) | 2 | 26 571 ms · 31 735 ms |
      | Après (`commit`) | 2 | 26 153 ms · 31 189 ms |

      Deux, et non une : la première ne vient pas du bouton mais du blur du
      conteneur au moment où l'on saisit la carte à la souris — le focus quitte
      alors le bouton qui a ouvert la modale. Comportement **antérieur à ce
      ticket, identique des deux côtés** : mesuré, pas déduit.
- [x] `npm run typecheck`, `npm run lint`, et la suite complète : 992 tests,
      115 fichiers, tests d'intégration compris.

### Non exercé, et dit comme tel

Les trois appels de `MapBlockEditor` (`pickCarte`, `useOwnImage`,
`saveRefDefaultView`) n'ont pas été déclenchés en navigateur : ils demandent
une fiche de type « Carte » déjà présente dans le monde, que le monde de test
n'avait pas. Ils appellent le même `commit` du même composant, dans le même
sous-arbre, que les deux chemins vérifiés — mais ce sont trois chemins de
moins, et la leçon du 14 septembre est justement qu'un raisonnement juste ne
vaut pas une mesure.

### Le monde de test, et ce qu'il en reste

Le compte ouvert dans le navigateur est un compte joueur, sans droit
d'édition sur les mondes existants : la vérification a demandé de créer un
monde à part (« Test carte V2.1-8 »), supprimé une fois les mesures prises.
Rien n'a été touché dans ClaudeLand ni dans Les Chroniques des Royaumes
Oubliés.

---

## V2.1-9 — Un test d'intégration à la marge trop mince · `S` — fait

### Constat

`homebrewWeapon.integration.test.ts` échouait par intermittence sur « Test
timed out in 5000ms », puis repassait plusieurs fois de suite — et échouait
aussi bien sur `master` que sur une branche de travail. Son corps prend 3 à
4,2 s (mesuré ; jusqu'à 5,91 s une fois) contre le délai par défaut de Vitest,
5 000 ms. Il tape le vrai Supabase : la moindre gigue réseau le fait basculer.

Ce n'était donc pas une régression, ni un test cassé. C'était un test dont la
marge est trop mince — et tant qu'elle l'est, `npm run test` reste capricieux,
ce qui est bien pire qu'un test lent : une suite qui échoue au hasard finit par
ne plus être lue.

### Décision

Vitest n'offre pas de délai d'attente par glob **à l'intérieur** d'un projet.
La séparation en projets est le mécanisme prévu pour ça, et c'est celle qui a
été retenue : un projet `unit` (tout `src/` et `lib/` sauf
`*.integration.test.ts`) qui garde le filet serré de 5 s — là où un
dépassement signale une boucle infinie, pas une latence — et un projet
`integration` à **30 s**, `testTimeout` et `hookTimeout`, soit environ sept
fois le pire temps mesuré.

Volontairement large : ce qu'on veut détecter ici, c'est un test **réellement
bloqué**, pas une requête un peu lente. Le coût d'un délai large est nul tant
que les tests passent, et borné quand l'un d'eux bloque, les fichiers étant
déjà sérialisés (`fileParallelism: false`, hérité de la bascule vers un pool de
comptes de test réutilisables).

Un piège noté sur place, parce qu'il ne se devine pas à la lecture :
`extends: true` **concatène** les tableaux hérités au lieu de les remplacer.
Déclarer `include` à la racine ramènerait donc tous les fichiers dans le projet
`integration` — et leur donnerait précisément le délai large qu'on veut leur
refuser. `include` est déclaré par projet, jamais à la racine.

### Fait avant d'être écrit

Ce ticket consigne un travail déjà livré : commit `261ec55`, « separe les
tests unitaires des tests d integration dans Vitest », le 14 septembre à
10 h 20 — soit **neuf minutes avant** la note de V2.1-6 qui annonçait le
chantier comme restant à faire. Rien ne le portait : ni backlog V2.1, ni V2,
ni V3. Il n'existait que dans son message de commit et dans les commentaires
de `vitest.config.ts`.

C'est la même omission que celle réparée pour V2.1-7, et elle mérite d'être
dite une fois de plus : **un travail qui ne vit que dans un message de commit
est un travail qu'on refera.** Ici, la trace périmée avait même commencé à
mentir — elle a fait annoncer ce point comme ouvert lors d'une relecture du
backlog.

### Critères

- [x] Les tests d'intégration disposent de 30 s (`testTimeout` et
      `hookTimeout`), les tests purs gardent 5 s.
- [x] `npm run test:core` reste borné à `src/core` par son argument de ligne de
      commande, inchangé.
- [x] La suite complète passe : 992 tests, 115 fichiers, 1 sauté, 157,9 s —
      tests d'intégration inclus, `.env.local` présent.
- [x] La note périmée de V2.1-6 ne dit plus « à traiter dans son propre
      ticket » : elle renvoie ici, avec l'ordre réel des faits.

---

## V2.1-10 — Deux traînes du dépassement de quota Vercel · `S` + `M` — fait

### Constat

Vercel a refusé de déployer le 15 septembre : « Exceeded free resources —
Functions Storage 14,67 GB / 10 GB ». La cause était une seule ligne de
`next.config.ts` : `outputFileTracingIncludes` valait `"/**"`, donc les 78 Mo
de binaires natifs de `@img` (deux copies de `libvips`, la nôtre et celle que
Next embarque pour son optimiseur d'images, plus une version WebAssembly)
étaient recopiés dans **chacune des 208 fonctions** du déploiement. Environ
16 Go par déploiement, sur un quota de 10 Go cumulé. Corrigé par le commit
`849bd4e`, qui limite l'inclusion aux quatre routes atteignant réellement un
`await import("sharp")` : 16 773 Mo de fichiers tracés avant, 1 564 Mo après.

Ce ticket porte les deux points relevés **en instruisant** ce dépassement, et
laissés de côté parce qu'ils sortaient du correctif. Ni l'un ni l'autre ne
bloque quoi que ce soit aujourd'hui ; c'est précisément pourquoi ils méritent
un ticket plutôt qu'une note — une note ne sait pas se corriger quand le
travail est fait (leçon de V2.1-9, payée deux fois).

### Volet A — `package-lock.json` désynchronisé, `npm ci` refuse de tourner · `S`

```
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: @swc/helpers@0.5.23 from lock file
```

La chaîne, vérifiée paquet par paquet : `next-intl@4.13.4` tire
`@swc/core@1.15.47`, qui déclare une **peerDependency optionnelle**
`@swc/helpers: ">=0.5.17"`. Le projet a `@swc/helpers@0.5.15` — dépendance
directe de `next@16.2.12` — qui ne satisfait pas cette plage. npm veut donc
installer une copie imbriquée en 0.5.23, et cette entrée est absente du
lock. Le lock remonte au 13 septembre (`dc44e16`) et enregistre
`@swc/core@1.15.47` sans mention de la peer.

Ce n'est donc pas un lock corrompu, ni une manipulation ratée : c'est un lock
écrit avant que cette contrainte n'existe dans l'arbre.

Ce que ça coûte : **toute installation reproductible échoue.** `npm install`
passe et régénère le lock, `npm ci` non — or `npm ci` est ce qu'exécute une
plateforme de déploiement quand elle trouve un lock. Pourquoi les
déploiements Vercel passent malgré tout n'a pas été établi ici, faute
d'accès aux journaux de build : à regarder avant de conclure, plutôt qu'à
supposer.

### Volet B — 759 Mo de `sharp` encore recopiés dans des fonctions qui ne s'en servent pas · `M`

Après `849bd4e`, il reste 1 564 Mo de fichiers tracés par déploiement. Les
quatre routes d'upload en pèsent 324 : c'est leur métier, elles exécutent
vraiment `sharp`. Le reste se répartit ainsi (mesuré sur le build du
15 septembre, en sommant les fichiers listés par les `.nft.json`) :

| | fonctions | poids | dont `sharp` et `@img` |
|---|---|---|---|
| hors upload, sans trace de `sharp` | 129 | — | 0 |
| hors upload, portant `sharp` pour rien | 75 | 1 240 Mo | **759 Mo** |

Ces 75 fonctions n'appellent jamais `sharp` : l'`await import("sharp")` est
dans une branche qu'elles n'atteignent pas. Mais le traceur de fichiers de
Next travaille sur le graphe d'**imports**, pas sur les chemins d'exécution —
il suffit qu'un module du graphe mentionne `sharp` pour que le binaire suive.

Deux chaînes distinctes, et c'est le point qui décide du travail :

1. `app/layout.tsx` importe `resolveBackgroundSelection` depuis
   `src/server/services/backgroundImages.ts` — un fichier qui contient aussi
   `uploadBackgroundImage` → `processBackgroundImage` → `import("sharp")`.
   Comme c'est le layout racine, cette chaîne atteint **les 47 pages**.
2. `src/server/services/blocks.ts` importe `deleteAsset` depuis
   `src/server/services/storage.ts` — un fichier qui contient aussi
   `uploadAsset`, et le même `import("sharp")`. Cette chaîne atteint **27
   routes d'API**.

**Traiter une seule des deux ne gagne rien** : chaque fonction concernée doit
perdre ses deux chaînes pour que le binaire cesse d'être copié. C'est ce qui
fait la taille `M` plutôt que `S`.

La forme retenue est la même dans les deux cas : sortir la lecture du fichier
qui porte l'écriture, pour que lire un fond ou supprimer un asset n'oblige
plus à embarquer le pipeline de traitement d'image. Pas une abstraction — une
séparation, au sens de la règle des trois : c'est le deuxième cas concret du
même défaut, et les deux sont devant nous.

### Étapes

- [x] A1. `npm install` : **le lock n'a pas bougé d'un octet.** Avec npm
      11.17.0, la peer `@swc/helpers >=0.5.17` étant déclarée **optionnelle**
      par `@swc/core`, npm ne crée aucune copie imbriquée et considère l'arbre
      satisfaisable. `npm ls @swc/helpers` signale toujours
      `invalid: ">=0.5.17"`, mais c'est un diagnostic, pas un blocage.
- [x] A2. **`npm ci` passe** (code 0), sur un `node_modules` réellement
      supprimé puis réinstallé depuis le lock, sans modifier le lock.
- [x] A3. Sans objet : aucun fichier à commiter, le lock est inchangé.
- [ ] A4. Journaux de build Vercel : pas d'accès depuis cette session.

**Volet A est caduc, et c'est une mesure, pas une supposition.** L'erreur citée
plus haut ne se reproduit plus. Elle a été observée avec une autre version de
npm — la seule explication compatible avec le fait que ni le lock ni le
`package.json` n'ont changé depuis. La leçon vaut d'être gardée : **un message
d'erreur d'outillage date autant qu'il décrit.** Celui-ci a survécu à sa cause
pendant deux jours, le temps d'être consigné dans un ticket.

Reste ouvert, et seulement ça : savoir si Vercel exécute `npm ci` ou
`npm install`. Sans accès aux journaux, ça ne se déduit pas — et ça ne bloque
plus rien maintenant que les deux passent.
- [x] B1. `backgroundImages.ts` → `backgroundImageUpload.ts`.
- [x] B2. `storage.ts` → `assetUpload.ts`.
- [x] **B1 bis. `entityPortraits.ts` → `entityPortraitUpload.ts`.**
- [x] **B2 bis. `blockImages.ts` → `blockImageUpload.ts`.**
- [x] B3. Remesuré en sommant les `.nft.json` — chiffres ci-dessous.

**Deux chaînes de plus que prévu.** L'analyse initiale en nommait deux ; elles
sont bien réelles, mais elles ne suffisaient pas. En vérifiant — avant de coder
— que les traiter suffirait, deux autres fichiers sont apparus, porteurs du
même défaut :

- `entityPortraits.ts` mêlait `uploadEntityPortrait` et `getPortraitLayout`,
  or ce dernier est importé par `publicShare.ts`, `playerEntityDetail.ts` et
  `entityWindow.ts` — c'est-à-dire par **toute page de wiki** ;
- `blockImages.ts` mêlait `uploadBlockImage` et `getBackgroundMetaForBlock`,
  même portée, et ce fichier atteint `sharp` **deux fois** (couleur dominante,
  puis `uploadAsset`).

C'est le ticket lui-même qui rendait cette vérification obligatoire : il posait
que « traiter une seule des deux ne gagne rien », chaque fonction devant perdre
**toutes** ses chaînes. Avec quatre, en traiter deux n'aurait rien gagné non
plus — et la mesure finale l'aurait dit, après coup.

Règle qui en sort, écrite en tête de chaque fichier créé : **un fichier qui
touche `sharp` ne doit rien exporter qu'un chemin de lecture ait besoin
d'importer.**

### Critères

- [x] `npm ci` installe le projet sans erreur, sur un `node_modules` réellement
      supprimé.
- [x] `npm run typecheck && npm run lint && npm run test` passent.
- [x] **Aucune fonction hors upload ne trace `sharp` ni `@img` : les 75 passent
      à 0.** Mesuré en sommant les `.nft.json` du build : sur **210 fonctions
      tracées**, exactement **4** portent `@img`, et ce sont les quatre routes
      d'upload — `blocks/[blockId]/image`, `entities/[id]/portrait`,
      `settings/background`, `worlds/[worldSlug]/assets` — à 38 Mo chacune. Les
      **206 autres portent 0 Mo**.
- [ ] Les quatre routes d'upload tracent toujours
      `@img/sharp-libvips-linux-x64/lib/libvips-cpp.so` — **non vérifiable
      depuis cette machine** : un build Windows trace `@img/sharp-win32-x64`,
      jamais le paquet linux. Ce qui EST vérifié, c'est le mécanisme —
      `outputFileTracingIncludes` englobe `./node_modules/@img/**/*`, donc les
      quatre routes reçoivent l'arbre `@img` complet de la plateforme de build,
      quel qu'il soit. Le nom du fichier change, pas la règle.
- [ ] Un envoi d'image réel passe sur le déploiement : portrait d'entité,
      image de bloc, image de fond, asset de monde. Les quatre, une fois
      chacune : c'est le seul contrôle qui distingue vraiment un binaire
      présent d'un binaire absent. **À faire après déploiement.**
- [x] Poids total tracé : **638 Mo** sur ce build local. À ne pas comparer
      directement aux 1 564 Mo du 15 septembre, mesurés sur un build Linux
      avec d'autres binaires — le chiffre qui se compare sans réserve est le
      nombre de fonctions portant `sharp` : **79 avant, 4 après.**

### Ce que ce ticket n'inclut pas

Les 14,67 Go déjà consommés ne se libèrent pas tout seuls : le quota compte
les déploiements **conservés**, pas seulement le dernier. La suppression des
anciens déploiements se fait dans l'interface Vercel, à la main, et ne peut
pas être portée par un ticket de ce dépôt.

---

## V2.1-11 — Bloc image : ancrage explicite, fond de page à trois états, parallaxe · `L` — fait

### Constat

Le mode « retour à la ligne » du bloc image (V2-G12) n'insère jamais l'image
dans le bloc qu'elle doit accompagner : il la laisse **bloc frère**, juste
avant sa cible, et compte sur le flottement CSS pour que le texte suivant
l'enrobe (`renderWrappedBlocks`, `components/entities/public/PublicEntityBody.tsx`).

Deux défauts en découlent, visibles sur une entrée du Journal de session :

- **Une ligne de séparation orpheline.** Le bloc image passe par le même
  habillage que tous les autres (`PublicBlockView`, `border-b border-edge/60
  py-4`). La `<figure>` flottant, elle sort de ce conteneur : il reste une
  `div` **vide** de 32 px avec sa bordure basse. Un trait qui ne sépare rien.
- **L'image démarre au-dessus du titre.** Le point d'ancrage du flottement
  est le début de cette div vide, donc ~32 px avant le bloc texte — avant
  son titre. Structurellement, l'image ne *peut pas* commencer au niveau du
  titre : elle est placée avant lui dans le flux.

Un troisième défaut, moins visible mais plus grave à l'usage : la cible est
**implicite** (« le bloc suivant »). Réordonner les blocs change en silence
quel texte enrobe l'image.

Enfin, `useAsWikiBackground` est aujourd'hui **exclusif** : une image cochée
comme fond de page disparaît entièrement du corps de la fiche
(`PublicBlockView` renvoie `null`). L'auteur veut les trois combinaisons.

### Décisions prises avec l'auteur (14 septembre)

Esquisse d'interface construite et manipulée avant d'écrire du code. Quatre
points tranchés :

1. **Ancrage explicite, pas de détection positionnelle.** Une liste
   déroulante des blocs de la fiche remplace « le bloc suivant ».
2. **Position par crans discrets, jamais en pourcentage.** Un flottement CSS
   s'accroche au point du flux où il est inséré : « placer à 40 % de la
   hauteur » n'existe pas. L'unité honnête est le **segment** — qui porte
   déjà un `id` stable (`zSegment`, `src/core/schemas/entities/segments.ts`).
   Un curseur à N+1 crans, dont l'étiquette cite le texte réel du segment
   (« avant "Elle ne comprend pas…" »), plutôt qu'un numéro à compter.
3. **Trois comportements, pas deux.** Bloc autonome / ancrée avec texte qui
   contourne / ancrée en coupant le texte sur toute la largeur. Le troisième
   est un vrai besoin exprimé, pas une généralisation spéculative.
4. **Mini-carte d'aperçu dans l'éditeur**, faite dès ce ticket et non après :
   c'est elle qui supprime l'incertitude sur le point de chute de l'image.

L'interface sépare enfin deux questions que les pastilles actuelles
`Intercaler`/`Retour à la ligne` confondent : *où est l'image* et *comment le
texte réagit*. C'est la cause de la surprise à l'usage — on choisit un
comportement de texte et on obtient un déplacement.

Les contrôles se ferment en cascade : bloc autonome éteint position et
comportement ; texte qui contourne retire `Centre` de l'alignement au lieu de
l'accepter puis de le réécrire en silence (`ImageBlockEditor.tsx` le fait
aujourd'hui) ; fond de page seul éteint toute la section emplacement.

### Interface retenue

Trois esquisses manipulées successivement avec l'auteur, la dernière portant
sur le seul dessin des déclencheurs de liste.

**Règle de forme : choix discret = liste, valeur continue = curseur.** Les
pastilles `Intercaler`/`Retour à la ligne` disparaissent donc entièrement,
y compris pour l'alignement et le fond de page — une pastille restante
serait l'exception qui fait réfléchir.

**Toutes les listes passent par `components/shared/Dropdown.tsx`**, dans son
apparence actuelle (bordure fine, `bg-transparent`, `size="md"`). La première
esquisse utilisait des `<select>` natifs, ce que `docs/CHARTE-UI.md` §3
interdit explicitement — le menu d'un `<select>` est peint par le navigateur
et ne suivra jamais les jetons. Trois variantes ont été proposées (champ en
creux, rangée de réglage, valeur seule en ambre) ; **l'auteur retient
l'existant**. Conséquence utile : `Dropdown` n'est pas touché, donc ce ticket
ne modifie aucun composant partagé.

**Disposition, cinq rangées** au lieu de sept — `Fond de page` seul en haut
(c'est le portier de la cascade, l'apparier avec un contrôle qu'il éteint
donnerait une rangée à moitié grisée), puis `Emplacement`, puis `Position`,
puis les paires `Comportement` + `Alignement` et `Taille` + `Parallaxe`.
Chaque paire réunit deux contrôles de même niveau de cascade et de même
nature.

### Modèle de données

Champs **additifs** sur `zImageBlockData` (`src/core/schemas/blocks/image.ts`),
`__v` inchangé à `1` : aucune migration de données, aucun bloc existant
invalidé.

```ts
placement: z.enum(["flux", "ancree"]).default("flux"),
anchor: z.object({
  blockId: z.string(),
  segmentId: z.string().nullable(),   // null = en tete du bloc
}).nullable().default(null),
anchorFlow: z.enum(["contourne", "coupe"]).default("contourne"),
alsoShowInFlow: z.boolean().default(false),   // n'a de sens qu'avec useAsWikiBackground
parallaxPct: z.number().int().min(0).max(40).default(0),   // 0 = aucun effet
```

**Valeurs d'énumération corrigées en anglais au début du lot 2.** Le lot 1 les
avait écrites en français (`flux`/`ancree`, `contourne`/`coupe`), ce que
`CLAUDE.md` interdit : les identifiants techniques restent en anglais, et la
règle cite explicitement les **valeurs de colonnes** — ces chaînes vivent dans
une colonne JSONB, à côté d'un `wrapMode` qui dit déjà `intercalate`/`wrap`.
Elles deviennent `flow`/`anchored` et `float`/`break`. Corrigé avant qu'aucune
donnée réelle ne les porte : les seuls blocs qui les avaient étaient les blocs
de contrôle du lot 1, déjà supprimés.

**`anchor.position` ajouté en cours de lot 1** (`"before" | "after"`, défaut
`"before"`). L'esquisse validée par l'auteur portait un dernier cran « à la
fin du bloc », et un ancrage « avant tel segment » ne sait pas l'exprimer :
aucune position ne suit le dernier segment. Un bloc autonome posé juste après
n'est pas équivalent — il porte son propre cadre de bloc. Le champ ne sert
qu'à ce cran ; il est oublié quand le segment visé disparaît, puisque « en
tête » n'a pas d'« après ».

`wrapMode` n'apparaît plus dans l'interface mais **reste lu** : une fonction
pure `planImageAnchors(blocks)` traduit l'ancien `wrapMode: "wrap"` en
« ancrée au premier segment du bloc suivant, texte qui contourne ». Les
fiches existantes gardent leur rendu, et le reste du code ne connaît qu'un
seul chemin. La traduction du legacy vit à un seul endroit, testé.

`useAsWikiBackground` est inchangé, y compris sa règle serveur d'unicité par
fiche (`clearOtherWikiBackgrounds`, `src/server/services/blocks.ts`). Le
troisième état vient de `alsoShowInFlow`, dont le défaut `false` reproduit
exactement le comportement actuel.

### Lot 1 — ancrage explicite

- [x] `planImageAnchors(blocks)` dans `src/core/images/` — **tests d'abord**,
      sur le modèle de `planMusicAttachments` (`src/core/music/blockAttachment.ts`),
      qui résout déjà « ce bloc sort du fil et va s'accrocher ailleurs ».
      Couvre : traduction du legacy `wrapMode`, bloc cible supprimé, segment
      cible supprimé, plusieurs images sur un même bloc, image ancrée à
      elle-même (refusée).
- [x] Repli explicite, jamais de disparition silencieuse : bloc cible
      introuvable → l'image retombe en mode flux, à sa place dans la fiche ;
      segment introuvable → ancrage en tête du bloc.
- [x] `PublicEntityBody` ne rend plus l'image ancrée comme bloc frère : elle
      est injectée **dans** le `<div>` du bloc hôte, avant le segment visé.
      Supprime la bordure orpheline et le décalage au-dessus du titre.
- [x] Le conteneur du bloc hôte passe en `flow-root`, sinon une image plus
      haute que le texte déborde sur le bloc suivant.
- [x] `ImageBlockEditor` reçoit la liste des blocs frères (`EntityBlocks` les
      a déjà en état) : liste déroulante + curseur à crans + pastilles de
      comportement, en cascade.
- [x] Mini-carte d'aperçu dans l'éditeur : segments du bloc cible en
      miniature, image au cran choisi, côté et largeur respectés.
- [x] Sous 640 px, une image qui contourne passe en pleine largeur sans
      flottement — une colonne de texte à côté de 480 px est illisible.
- [x] La légende reste éditable et s'affiche sous l'image dans les trois
      modes. Signalée par l'auteur en cours de lot : les esquisses ne
      dessinaient que la colonne de réglages, et son champ vit en dehors —
      pleine largeur en bas de l'éditeur, comme le champ d'URL en haut.
      Rien n'avait été retiré, mais l'esquisse le laissait croire.

### Lot 2 — fond de page à trois états

- [x] Liste `Pas de fond de page` · `En fond, en plus de la fiche` ·
      `Seulement en fond`, calculée depuis le couple `useAsWikiBackground` ×
      `alsoShowInFlow`. Le ticket disait « pastilles » : écrit avant la
      décision d'interface qui a fait de tout choix discret une liste.
- [x] La traduction couple ↔ trois états vit dans `src/core/images/
      backgroundMode.ts`, **testée** (9 cas) : le rendu et l'éditeur lisent
      la même règle plutôt que de la réécrire chacun de leur côté. La
      quatrième combinaison (`alsoShowInFlow` sans fond) est absorbée, jamais
      laissée produire un état fantôme.
- [x] `PublicBlockView` ne renvoie `null` que pour « seulement en fond ».
- [x] « En plus » : l'image s'affiche à son emplacement ancré ou autonome
      **et** en fond — le flou et le fondu restent des réglages du fond seul.
- [x] La règle d'unicité du fond par fiche reste intacte : `alsoShowInFlow`
      s'ajoute à côté de `useAsWikiBackground` au lieu de le remplacer, donc
      `clearOtherWikiBackgrounds` n'est pas touché.
- [x] La liste vient **en premier** dans la colonne de réglages : c'est la
      seule question qui peut annuler toutes les autres. « Seulement en
      fond » masque la section emplacement et dit pourquoi, plutôt que de
      laisser six réglages sans effet.

**Vérifié en navigateur** sur un bloc de contrôle, les trois états à la
suite : « pas de fond » → image présente et flottante à gauche dans
`.rich-text-content` ; « en plus » → image présente (ce que l'ancien code
refusait) ; « seulement en fond » → image absente du corps, et zéro bordure
orpheline.

**Non vérifié de mes yeux** : la peinture du fond elle-même.
`WikiBackgroundProvider` n'est monté que dans les layouts de `/partage/**` et
`/m/[worldSlug]/apercu/**` — jamais sur la route wiki joueur, la seule
accessible à la session de travail. Ce chemin n'est pas modifié par ce lot :
il ne lit que `useAsWikiBackground`, inchangé.

### Lot 3 — parallaxe

- [x] Curseur d'intensité `0–40 %`, **sans case à cocher séparée** : `0`
      éteint l'effet. Un contrôle au lieu de deux, et l'état se lit d'un
      coup d'œil. Apparié avec `Taille`, et une ligne dit ce qui va arriver
      (« aucun effet » à 0, l'avertissement de rognage au-dessus).
- [x] Le calcul vit dans `src/core/images/parallax.ts`, **testé** (11 cas) :
      il est faux de trois façons différentes s'il est écrit à la main dans
      un composant — borne oubliée (l'image sort de son cadre sur une fiche
      longue), division par zéro (fenêtre de hauteur nulle au premier
      rendu), décalage fractionnaire (le texte voisin vibre). Trois défauts
      qui demanderaient un navigateur et un long défilement pour se montrer.
- [x] `prefers-reduced-motion: reduce` neutralise l'effet **deux fois** : le
      composant ne s'abonne même pas, et une règle CSS annule la
      transformation — sinon un décalage posé avant que la préférence ne
      change resterait figé.
- [x] Seules les images d'intensité `> 0` deviennent un composant client. Il
      est chargé par `dynamic()`, contrairement à ce que conclurait la règle
      du fichier (« on ne découpe que ce qui pèse ») : ici le poids n'est pas
      le sujet, c'est le seul composant client de tout le rendu d'image, et
      un import statique ferait entrer son JS dans le paquet de **toute**
      page wiki, y compris celles sans aucune image.
- [x] Un seul écouteur de défilement mutualisé, piloté par
      `requestAnimationFrame` — jamais un écouteur par image. `capture: true`
      est indispensable : `scroll` ne remonte pas depuis un élément qui
      défile, et la coquille fait défiler un conteneur interne, pas `window`.

**Vérifié en navigateur.** Cadre 480 × 320 (3:2), image calculée à 416 px —
soit exactement 320 + 96, la course de 30 % : l'image est plus haute que son
cadre du montant dont elle glissera, donc aucun vide ne peut apparaître. Le
décalage suit le défilement au pixel près : cadre à 558 px du haut → −27 px ;
après 283 px de défilement, cadre à 275 px → −49 px, les deux conformes à la
formule. La règle `prefers-reduced-motion` est bien présente dans la feuille
chargée ; la préférence elle-même n'a pas pu être simulée dans cet
environnement.

**À confirmer avant d'écrire le lot 3** (conséquence de conception, pas
détail d'implémentation) : une image en parallaxe est **nécessairement
rognée**. L'effet suppose un cadre de hauteur fixe (`overflow: hidden`) et
une image plus grande que lui, qui glisse dedans — c'est déjà la mécanique du
fond de page (`transform: scale(1.08)`, `app/globals.css`). Sans ce cadre,
l'image dérive par rapport au texte et chevauche ses voisins. Conséquence :
la parallaxe convient à une illustration d'ambiance, jamais à une carte ni à
un plan, où l'on veut voir l'image entière.

Le **fond de page n'est pas concerné** par ce curseur : il est déjà en
`position: fixed`, c'est-à-dire déjà la forme maximale de l'effet — il ne
défile pas du tout. Y ajouter un réglage d'intensité ne ferait que le rendre
*moins* parallaxe. À rouvrir seulement si l'auteur veut précisément ça.

### Critères

Vérifiés en navigateur le 14 septembre, sur trois blocs de contrôle créés
puis supprimés dans « Faerûn (copie) ». **Pas sur l'entrée de journal
d'origine** : elle vit dans le monde `valdoria`, et la session ouverte dans
le navigateur de travail est un compte invité qui n'y a pas accès. Les trois
cas rejouent la configuration d'origine à l'identique (ancien `wrapMode`
seul, ancrage explicite en milieu de bloc, ancrage en fin de bloc).

- [x] Plus aucune ligne de séparation sans contenu au-dessus d'une image qui
      contourne. Mesuré dans le DOM, pas à l'œil : aucun `div.border-b` sans
      contenu sur la page, là où l'ancien rendu en produisait un par image.
- [x] Une image ancrée démarre au niveau du segment choisi, jamais avant le
      titre de son bloc hôte. Les deux `<figure>` ont `.rich-text-content`
      pour parent — elles sont donc DANS le bloc, plus à côté de lui.
- [x] Réordonner les blocs d'une fiche ne change plus quel texte enrobe
      l'image : la cible est un identifiant, plus une position. Couvert par
      les tests du noyau, pas par un déplacement en navigateur.
- [x] Les blocs image existants (`wrapMode` seul, sans `anchor`) rendent
      exactement comme avant, sans écriture en base — cas de contrôle A.
- [x] La légende s'affiche sous l'image dans les trois modes.
- [x] Sous 640 px, les deux images flottantes passent en `float: none` et
      reprennent toute la largeur.
- [x] `npm run typecheck && npm run lint && npm run test` passent (1017 tests,
      116 fichiers).

---

## V2.1-12 — Une seule peau de wiki, dans les layouts · `L` — fait

### Constat

Il existe **deux implémentations de la même page de wiki**, et elles ont déjà
divergé.

`BookSkin.tsx` (sommaire à gauche, colonne de lecture à `max-w-[70ch]` à
droite) sert `/partage/[token]/**` et `/m/[worldSlug]/apercu/**`. L'onglet Wiki
de la coquille joueur fait la même chose avec `TwoPaneReaderLayout` +
`PlayerWikiSidebar` — et le dit lui-même en commentaire : « reprend exactement
la présentation du wiki public […] même disposition que `BookSkin.tsx` ».

La divergence est visible : **le fond de page wiki (V2-G13) n'existe que du
côté `BookSkin`**. `WikiBackgroundProvider` n'est monté que dans les layouts de
`/partage` et `/apercu`, et `getPlayerEntityDetail` omet `wikiBackground` —
« la coquille joueur n'a pas (encore) de fond de page animé », dit le fichier.
Conséquence sur la route que la table utilise : une image en « seulement en
fond » disparaît du corps de la fiche **sans qu'aucun fond ne soit peint à la
place**. Elle n'est nulle part.

Ce n'est pas une régression de V2.1-11 : le report est écrit depuis l'origine.
Ce que V2.1-11 a changé, c'est la probabilité de tomber dessus — un réglage
discret est devenu un choix explicite entre trois états, et deux de ces trois
ne produisent rien là où on les pose.

### Ce qui empêche la fusion naïve

`BookSkin` est rendu **dans les pages** (4 appels : les index et les fiches de
`/partage` et `/apercu`), alors que le sommaire joueur vit **dans le layout**.
Ce n'est pas un hasard : « `layout.tsx` (pas juste une page) : le sommaire
reste monté d'une fiche à l'autre, jamais reconstruit ».

Mesuré avant de trancher : le repli des groupes est mémorisé en `localStorage`
et survit donc à un remontage, mais trois choses n'y survivent pas — la
recherche tapée, la position de défilement, et **un scintillement d'une image**
(le hook lit `localStorage` dans un effet, après le premier rendu, comme son
propre commentaire l'indique). Brancher la vue joueur sur `BookSkin`-dans-la-
page lui offrirait donc ce scintillement à chaque fiche, sur la route où l'on
enchaîne le plus les fiches.

### Décision

**Recomposer `BookSkin` en deux morceaux**, selon ce que chacun suit :

- la **coquille** (sommaire + colonne de lecture) est par MONDE → elle monte
  dans les `layout.tsx`, où elle cesse de se reconstruire ;
- l'**enregistrement du fond** est par FICHE → il reste dans la page, sous la
  forme d'un composant client minuscule qui n'affiche rien.

Les trois routes y gagnent, pas seulement la vue joueur : `/partage` et
`/apercu` perdent le même scintillement, qu'elles subissent aujourd'hui.

Deux points tranchés avec l'auteur avant d'écrire :

- **Sommaire à 256 px partout** (`md:w-64`, la valeur de `BookSkin`). La vue
  joueur abandonne ses 176 px : un seul gabarit, et aucune prop à ajouter au
  composant.
- **`BookSkin` gagne une fente** au-dessus du contenu, pour
  `SessionJournalBanner` — qui vit aujourd'hui dans le layout joueur et n'a
  nulle part où aller autrement.

### Étapes

1. `WikiBackgroundProvider` : séparer lire et enregistrer. Un hook de lecture
   seule pour la coquille (qui applique `--h`/`--c`/`data-mode`), et un
   composant `WikiBackgroundRegistrar` que la page rend pour déclarer SON fond.
2. `BookSkin` : ne prend plus `wikiBackground`, lit le fond affiché ; gagne la
   fente `banner`.
3. Les quatre pages de `/partage` et `/apercu` : rendent le registrar au lieu
   de `BookSkin`. **Les pages d'index doivent enregistrer `null`** — sans ça, le
   fond de la fiche précédente resterait affiché en revenant au sommaire.
4. Les layouts de `/partage` et `/apercu` : montent `BookSkin` (titre et arbre
   sont par monde, ils y ont leur place).
5. `getPlayerEntityDetail` renvoie `wikiBackground`, résolu par la même règle
   que la version publique — **client RLS, jamais `service_role`** : ce fichier
   n'est pas `publicShare.ts`, la règle absolue n° 2 reste intacte.
6. Le layout joueur : `WikiBackgroundProvider` + `BookSkin` avec la bannière
   dans la fente, à la place de `TwoPaneReaderLayout` + `PlayerWikiSidebar`.
7. Retirer `TwoPaneReaderLayout`/`PlayerWikiSidebar` s'ils n'ont plus d'autre
   appelant — jamais les laisser en double mort.

La branche d'édition de la page joueur ne bouge pas. Une fiche éditable
continue d'afficher son formulaire dans la colonne de lecture : c'est une autre
question, et elle ne bloque rien ici.

### Critères

- [x] Les trois routes rendent la même coquille. **Deux sur trois la montent
      dans leur layout** ; `/partage` la garde dans sa page — voir la réserve
      ci-dessous, c'est une limite assumée, pas un oubli.
- [x] Le sommaire ne se reconstruit plus en changeant de fiche, **mesuré** : un
      attribut posé sur le nœud `<aside>` avant de cliquer une autre fiche s'y
      retrouve après. Même nœud DOM, donc aucun remontage — et donc ni
      scintillement du repli, ni recherche vidée, ni défilement perdu.
- [x] Les trois états du fond se comportent dans la vue joueur comme sur
      `/apercu` : « seulement en fond » peint le fond et retire l'image du
      corps ; « en plus » fait les deux à la fois ; sans bloc de fond, aucun
      `.wiki-bg-backdrop`.
- [x] Passer à une fiche sans fond retire le fond précédent.
- [x] `getPlayerEntityDetail` n'utilise toujours pas `service_role`, et la note
      « pas (encore) de fond de page animé » a disparu.
- [x] La bannière de séance occupe la même position qu'avant — au-dessus du
      contenu, dans la colonne `max-w-[70ch]`. Vérifié par la structure et non
      de visu : elle ne s'affiche que pour une personne à qui une rédaction est
      assignée, ce que la session de travail n'est pas.
- [x] `PlayerWikiSidebar` supprimé, plus aucun appelant. `TwoPaneReaderLayout`
      conservé : les onglets Fiche et Règles s'en servent toujours.
- [x] `npm run typecheck && npm run lint && npm run test` passent (1034 tests).

### Réserve : `/partage` garde sa coquille dans la page

Hisser `BookSkin` dans `app/partage/[token]/layout.tsx` obligerait ce layout à
charger le sommaire **avant** la garde par mot de passe de la page — or celle-ci
est explicite : « jamais de contenu récupéré avant validation, jamais "chargé
puis masqué" ». Faire décider le layout supposerait d'y dupliquer la
vérification, c'est-à-dire d'écrire la même règle de sécurité à deux endroits.

`/partage` conserve donc son sommaire reconstruit à chaque fiche. Ce n'est pas
une régression — c'est ce qu'elle faisait déjà — mais c'est la route qui ne
profite pas de la correction, et c'est délibéré.

### Vérifié en navigateur

L'onglet Wiki joueur et `/apercu` (index et fiche) rendent la coquille montée
par leur layout, sommaire à 256 px, colonne de lecture à 743 px dans une
fenêtre de 1400.

`/partage` a été ouvert par un **vrai lien de partage** de `valdoria`, qui
redirige vers « Des outils, des tartes et une disparition » — la fiche même
qui a déclenché V2.1-11. Elle a permis de fermer au passage le dernier critère
de ce ticket-là, jamais constaté jusqu'ici : **zéro `div.border-b` sans
contenu**, et l'image de l'ancien `wrapMode` a bien `.rich-text-content` pour
parent, flottante à droite. Le correctif tient sur la fiche d'origine, dans le
monde réel, par le chemin réel.

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

V2.1-7 n'était pas prévu : il est né d'un défaut rencontré **en faisant**
V2.1-6, sur lequel il a fallu s'arrêter parce qu'il bloquait la vérification
du ticket en cours (une case cochée qui ne s'enregistrait pas). Les deux
restent liés dans les deux sens : la note de fragilité de V2.1-6 renvoie ici,
et le critère de lecture en boucle de V2.1-6 n'a pu repartir qu'une fois
V2.1-7 livré.

**Les neuf premiers tickets de ce backlog sont clos.** V2.1-6, le dernier ouvert, a
tenu trois jours à lui seul et a rendu quatre défauts que ni les types ni les
tests ne pouvaient voir : le bouton qui mentait, le premier clic qui
s'annulait, le `removeChild` au démontage, et le lien Spotify localisé refusé
en silence. Tous les quatre demandaient un navigateur et un usage réel.

V2.1-8 et V2.1-9 sont deux traînes du même jour, ouvertes ensemble une fois le
backlog relu de bout en bout. Elles ne se ressemblent que par leur origine :
chacune était consignée quelque part — l'une en fin de V2.1-7, l'autre dans une
note de V2.1-6 — sans qu'aucun ticket ne la porte.

Elles se sont révélées de nature opposée, et c'est l'enseignement de la
relecture. **V2.1-8 restait entièrement à faire** : le remplacement mécanique
annoncé par l'ADR 0023. **V2.1-9 était fait depuis le matin même**, et sa trace
périmée disait le contraire — au point de faire annoncer à tort un point
comme ouvert.

D'où la règle qui vaut pour la suite : une note « à traiter à part » n'est pas
un ticket, et c'est au moment où on l'écrit qu'il faut l'ouvrir. Une note ne
sait pas se corriger quand le travail est fait ; un ticket, si.

V2.1-10 est la première application de cette règle : les deux points qu'il
porte ont été **écrits comme ticket le jour même où ils ont été vus**, pendant
l'instruction du quota Vercel dépassé, au lieu d'être laissés en note de bas
de commit comme l'avaient été V2.1-8 et V2.1-9. Aucun des deux n'était urgent
— c'est justement là que la note aurait été tentante, et qu'elle se serait
périmée.

**V2.1-11 est fait** (ouvert le 14 septembre, fini le 15) — mais il ne clôt
pas le backlog : V2.1-10 reste ouvert. Il n'est la traîne de rien : il vient
d'un défaut d'affichage constaté en lisant une entrée du Journal de session,
et il emporte deux demandes d'interface arrivées dans la même conversation.
Ses trois lots étaient ordonnés — le lot 1 refond la structure que les lots 2
et 3 décorent — et seul le premier était indispensable au correctif d'origine.

Les deux tickets se sont ouverts le même jour sans se voir, chacun dans son
fil, et tous deux ont d'abord porté le numéro 10. Celui-ci a été renuméroté
**après coup, au moment de rejoindre `master`** — d'où des messages de commit
qui le citent encore comme V2.1-10. La leçon n'est pas d'éviter le numéro en
double : c'est de le réserver au moment où le ticket s'écrit, pas au moment
où il se pousse.

Ce ticket inaugure une habitude : l'interface a été **esquissée et manipulée
avant** d'écrire la moindre ligne. Trois esquisses successives, et la séance a
déplacé le modèle de données — le curseur en pourcentage envisagé au départ
était impossible à tenir en CSS, et le dernier cran « à la fin du bloc » a
imposé un champ (`anchor.position`) que le premier jet n'avait pas. Une
esquisse coûte moins cher qu'un lot à défaire.

Elle a aussi montré sa limite. L'auteur a dû signaler que le champ de légende
manquait : les esquisses ne dessinaient que la colonne de réglages, et ce
champ vit en dehors. Rien n'avait été retiré du code, mais **une esquisse
partielle se lit comme une esquisse complète** — ce qu'elle ne montre pas, on
le croit disparu.

Trois corrections n'étaient au programme d'aucun lot, et chacune est venue de
l'usage plutôt que d'une relecture : les valeurs d'énumération du lot 1
écrites en français, le libellé centré d'une liste déroulante en pleine
largeur (défaut latent de `Dropdown`, invisible tant qu'aucun appel n'imposait
de largeur), et `npm` absent du PATH qui empêchait le serveur de dev de
démarrer.

**V2.1-12 est né de V2.1-11 une fois celui-ci poussé**, en répondant à la
question « reste-t-il quelque chose à faire ? » — pas en relisant le code. Il
ne corrige aucune régression : le report qu'il porte est écrit dans
`playerEntityDetail.ts` depuis l'origine (« pas (encore) de fond de page
animé »). Ce que V2.1-11 a changé, c'est la probabilité de le rencontrer : un
réglage qui était une case à cocher discrète est devenu un choix explicite
entre trois états, et deux de ces trois états ne produisent rien sur la route
que les joueuses utilisent.

D'où une deuxième règle, jumelle de celle sur les notes : **rendre un réglage
plus visible rend visibles les endroits où il ne s'applique pas.** Le trou
existait, personne ne tombait dessus.

V2.1-12 a été ouvert puis clos le même jour. Il n'était pas prévu : il est né
d'une question de l'auteur — « pourquoi ne pas juste afficher le wiki public
dans l'onglet joueur ? » — répétée trois fois parce que les deux premières
réponses portaient à côté. Elles défendaient le chemin de DONNÉES (quel service
lit la base, avec quelle visibilité, avec quel client) quand la question
portait sur la PRÉSENTATION. C'est en allant vérifier le code pour argumenter
une troisième fois que le vrai défaut est apparu : le layout joueur
réimplémentait `BookSkin`, et le disait lui-même en commentaire.

D'où une règle de plus, et elle vaut pour les deux côtés : **quand une
proposition revient une troisième fois, ce n'est plus la proposition qu'il faut
réexaminer, c'est la réponse.** L'insistance de l'auteur pointait un fait que
le code portait depuis le début.

**V2.1-10 clôt ce backlog**, le 15 septembre comme les trois précédents. Il a
rendu deux enseignements de nature opposée, et c'est ce qui le rend utile à
relire.

**Un volet s'était périmé tout seul.** Le volet A décrivait une erreur `npm ci`
reproduite et citée mot pour mot. Elle ne se reproduit plus : ni le lock ni le
`package.json` n'ont changé, mais npm a cessé de traiter une peer *optionnelle*
non satisfaite comme bloquante. **Un message d'erreur d'outillage date autant
qu'il décrit** — celui-ci a survécu deux jours à sa cause, le temps d'être
consigné. Le réflexe qui a payé : rejouer la mesure avant d'écrire la
correction, plutôt que de faire confiance au ticket.

**L'autre volet était plus grand que son analyse.** Il nommait deux chaînes
vers `sharp` ; il y en avait quatre. Les deux manquantes ont été trouvées en
vérifiant que traiter les deux connues suffirait — vérification que le ticket
rendait obligatoire en posant lui-même que « traiter une seule des deux ne
gagne rien ». Une analyse écrite à chaud borne ce qu'elle a regardé, pas ce qui
existe.

Le chiffre qui se compare sans réserve : **79 fonctions portaient le binaire de
`sharp`, il en reste 4** — exactement les quatre routes qui téléversent.
