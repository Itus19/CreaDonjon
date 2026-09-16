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
| V2.1-5 | Un seul bloc Personnalité/Convictions par fiche | `S` | **Fait** (13 septembre) — index unique partiel `blocks_personality_worldview_uniq` plutôt qu'une simple garde applicative, qui raterait les doubles-clics et les onglets multiples. Deux vrais doublons trouvés en base et nettoyés avant de poser la contrainte |
| V2.1-6 | Bloc musique : ambiance sonore sur le wiki public | `L` | **Fait** (14 septembre) — les deux lots livrés, tous les critères vérifiés en navigateur. Le dernier a trouvé un bug : Spotify localise ses liens de partage (`/intl-fr/track/…`), que le résolveur refusait en silence |
| V2.1-7 | Une modification qui ne s'enregistre pas, et des contrôles anonymes | `M` | **Fait** (14 septembre) — né de V2.1-6 : une case cochée se perdait en silence, deux fois en un jour. Troisième occurrence du même défaut, donc traité à la cause (ADR 0023). Corrige au passage le nom accessible des cases et des listes |
| V2.1-8 | `onSaveNow` rejoint le contexte d'enregistrement | `S` | **Fait** (14 septembre) — la traîne consignée en fin de V2.1-7 : le bloc carte gardait le correctif ponctuel d'avant l'ADR 0023. Remplacement mécanique, comportement mesuré identique avant/après |
| V2.1-9 | Un test d'intégration à la marge trop mince | `S` | **Fait** (14 septembre, avant d'être écrit) — `homebrewWeapon.integration.test.ts` échouait par intermittence sur le délai de 5 s de Vitest. Corrigé dans la foulée de V2.1-6 sans qu'aucun ticket ne le porte ; consigné ici après coup |
| V2.1-10 | Deux traînes du dépassement de quota Vercel | `S` + `M` | **Fait** (15 septembre) — volet A **caduc, mesuré** : `npm ci` passe, npm 11.17 ne traite plus la peer optionnelle comme bloquante. Volet B : **quatre** chaînes vers `sharp` et non deux, les deux autres trouvées en vérifiant avant de coder. Mesuré : 79 fonctions portaient le binaire, il en reste 4 — les quatre routes qui téléversent |
| V2.1-11 | Bloc image : ancrage explicite, fond de page à trois états, parallaxe | `L` | **Fait** (15 septembre) — trois lots. L'ancrage devient explicite et l'image entre DANS son bloc hôte, ce qui fait tomber ensemble la bordure orpheline et le décalage au-dessus du titre. Interface esquissée et manipulée avant d'écrire une ligne : la séance a déplacé le modèle de données |
| V2.1-12 | Une seule peau de wiki, dans les layouts | `L` | **Fait** (15 septembre) — l'onglet Wiki joueur réimplémentait `BookSkin` et la copie n'avait pas emporté le fond de page. La coquille remonte dans les `layout.tsx` (par monde), l'enregistrement du fond reste dans la page (par fiche) : le sommaire cesse de se reconstruire, sur `/apercu` comme chez le joueur. `/partage` garde la sienne dans sa page, sa garde par mot de passe devant précéder tout chargement |
| V2.1-15 | Le droit de l'autrice d'une entrée devient un octroi retirable | `M` | **Fait** (15 septembre) — né de V2.1-14 : le MJ ne pouvait pas reprendre l'édition d'une entrée du Livre de sessions, ce droit étant le 6ᵉ cas en dur de `can_edit_entity`. Il devient une vraie ligne `entity_grants`, donc visible et retirable depuis « Octrois d'édition » (ADR 0024) |
| V2.1-14 | Lettrine et traits de séparation dans le bloc texte | `M` | **Fait** (15 septembre) — la présentation « livre » cesse d'être réservée aux fiches `session_journal` : elle devient deux options du bloc texte, disponibles partout. Le Livre de sessions redevient une catégorie de fiche du point de vue de la présentation, sans que son devoir ni son tri ne bougent |
| V2.1-13 | Centrer le couple sommaire + texte du wiki | `S` | **Fait** (15 septembre) — le vide entre sommaire et texte tombe de ~300 px à 32 px sur un écran de 1920, et cesse de dépendre de la fenêtre : il était un reste, il devient une marge. Une borne exprimée dans les unités du contenu, écrite une seule fois pour les trois routes — premier encaissement de la fusion de V2.1-12 |
| V2.1-16 | Le défilement appartient aux fenêtres, et l'en-tête disparaît | `M` | **Fait** (16 septembre) — deux gênes signalées avec captures, une seule cause : `<body>` n'avait pas de hauteur définie, donc chaque coquille bornait la sienne dans son coin. Mesuré avant/après : la page défilait de 56 px, la hauteur exacte de l'en-tête — lequel a disparu au lot 2, rendant ces 56 px aux fiches |
| V2.1-17 | Deux retouches de rendu au Livre de sessions | `S` | **Fait** (16 septembre) — les deux vues par l'auteur, captures à l'appui : le bloc Séance n'alignait pas ses libellés sur ses valeurs, et un trait posé en tête de bloc tombait entre le titre et le texte, en doublon du filet automatique que chaque bloc porte depuis V2-G11. L'alignement a ensuite été corrigé sur `PublicInfoboxBlock`, l'original d'où le défaut venait |
| V2.1-18 | Aperçu des fiches au survol d'un lien | `L` | **Ouvert** (16 septembre) — quatre lots, le premier autonome. Né d'un lien de règle qui ne mène nulle part sur `/partage` tout en portant la couleur et le souligné d'un vrai lien : trois mentions inertes sur vingt, mesurées sur la page en production. Trois variantes esquissées avec l'auteur avant tout code, la carte flottante retenue pour les entités comme pour les règles. La fluidité est une exigence du ticket, pas une optimisation d'après-coup : elle a une section, des cibles chiffrées, et elle a mis au jour un coût plus ancien, parti en V2.1-19 |
| V2.1-19 | La mémoïsation n'atteignait pas le wiki public | `M` | **Fait** (16 septembre) — né de la section Fluidité de V2.1-18. `React.cache()` ne prend que si le client Supabase est stable par requête ; `createShareLinkServiceClient` est une fabrique nue, et chaque fonction de `publicShare.ts` construit la sienne. Tout le gain de l'audit P-01 était donc inerte sur `/partage`, et seulement là. Second volet : la coquille passe dans le layout, `/partage` était la dernière des trois routes de wiki à la reconstruire à chaque fiche. Mesure : 2 constructions de sommaire pour deux navigations avant, 0 après, et la recherche du sommaire survit désormais à la navigation |
| V2.1-20 | La navigation du wiki public, de bout en bout | `L` | **Tous les lots faits** (16 septembre) — né de l'usage : « un long moment entre le clic et l'arrivée », et « le chargement s'effectue bizarrement quand le fond n'est pas celui par défaut ». **Le lot 0 a déplacé le ticket** : le temps de rendu est le nombre de vagues de requêtes multiplié par la latence, et 41 % sert à préparer des bulles que personne n'a survolées. **Lot 1** : trois `loading.tsx`, les premiers du dépôt, retour visible en 43 ms là où rien ne bougeait. **Lot 2 a trouvé autre chose que ce qu'il cherchait** : le fond n'était pas lent, il n'arrivait jamais — `/api/blocks/[id]/image` répondait 307 vers `/login` pour tout visiteur anonyme. Deux défauts empilés, plus une fuite refermée. **Lot 2.1** : les jetons de teinte passent dans le HTML, sur les trois routes, éditeur compris. **Lot 3** : deux vagues qui n'attendaient que leur tour dans l'ordre d'écriture — le Prologue passe de 873 à 678 ms. **Lot 5** : la chaine de rulesets cesse d attendre les cles de regle — le Prologue passe de 731 a 434 ms, soit -41 % depuis le lot 0. **Lot 4** : l auteur payait 66 ms de plus que ses joueuses a chaque clic, le middleware sort desormais avant de construire le client sur /partage — ecart ramene a -1 ms. **Lot 6** : l A/B tranche — squelette a 18 ms sur une cible prechargee contre 20 ms sur une cible qui ne l est pas, et une navigation coute exactement son rendu serveur. Le prechargement est coupe partout, 18 requetes par page ouverte tombent a 0 |
| V2.1-21 | Le contraste élevé se perd sur une fiche illustrée | `S` | **Fait** (16 septembre) — trouvé en instruisant le lot 2.1 de V2.1-20, pas en le cherchant. `.wiki-bg-scope[data-mode="…"]` redéclare la palette **sur lui-même**, et une déclaration locale l'emporte sur une valeur héritée : ce n'est pas une affaire de spécificité, les deux règles ne visent même pas le même élément. Sur toute fiche portant un fond de page wiki, le contraste élevé était donc écrasé — le lecteur le perdait exactement là où il en a le plus besoin. Mesuré avant correction : fond à 17 % de clarté au lieu de 1,6 %, texte à 95 % au lieu de blanc pur. Corrigé par un garde `:root:not([data-contrast="high"])` sur les quatre portées ; l'auteur a choisi de garder l'image, qui reste affichée mais que le `--scrim` de ce mode voile à 92 % |

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
- [x] Les quatre routes d'upload tracent toujours le binaire natif de la
      plateforme de build. **Non observable depuis cette machine** — un build
      Windows trace `@img/sharp-win32-x64`, jamais le paquet linux — mais la
      chaîne se ferme par lecture, maillon par maillon :
      1. `sharp@0.34.5` déclare `@img/sharp-libvips-linux-x64` et
         `@img/sharp-linux-x64` en **`optionalDependencies`** ;
      2. le lock les enregistre avec `os: ["linux"]`, `cpu: ["x64"]`,
         `optional: true` — donc `npm ci` les installe sur un hôte linux/x64,
         et ne les installe pas ici ;
      3. `outputFileTracingIncludes` englobe `./node_modules/@img/**/*`, sans
         filtre de plateforme : ce que npm a posé, le traceur le prend.
      Le nom du fichier change avec la plateforme, la règle non. Il reste un
      maillon non observé : le `.nft.json` du build Vercel lui-même.
- [ ] Un envoi d'image réel passe sur le déploiement : portrait d'entité,
      image de bloc, image de fond, asset de monde. Les quatre, une fois
      chacune : c'est le seul contrôle qui distingue vraiment un binaire
      présent d'un binaire absent. **Ne peut être fait que par l'auteur** —
      voir la passation ci-dessous.

### Passation — les deux points qui demandent Vercel

Consignés ici plutôt que laissés dans une conversation : ni les journaux de
build ni un envoi réel ne sont atteignables depuis la session de travail (pas
de jeton Vercel, pas de `.vercel`, aucune variable d'environnement — vérifié,
pas supposé).

**1. Les quatre envois, une fois chacun**, sur le déploiement : portrait
d'entité, image de bloc, image de fond personnel, asset de monde (une carte).
C'est le seul contrôle qui distingue un binaire présent d'un binaire absent.
En cas d'échec, le symptôme est précis et reconnaissable : **`ERR_DLOPEN_FAILED`
en production seulement**, jamais en local — et il ne toucherait QUE ces quatre
routes, le reste du site étant indemne par construction.

**2. Les journaux de build** (volet A4) : `npm ci` ou `npm install` ? La
réponse n'a plus de conséquence pratique — les deux passent depuis que la peer
optionnelle n'est plus bloquante — mais elle dirait si le volet A a jamais été
un incident réel ou seulement un risque dormant. À lire une fois, si l'occasion
se présente.
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

## V2.1-13 — Centrer le couple sommaire + texte du wiki · `S` — fait

### Constat

Sur un grand écran, le sommaire est collé au bord gauche pendant que le texte
flotte au milieu : environ **300 px de vide** entre les deux sur un écran de
1920. Le trajet de l'œil est long, et les deux colonnes cessent de se lire
comme un ensemble — l'auteur l'a décrit comme « le sommaire appartient à une
autre page que le texte ».

Ce vide n'est pas une marge choisie, c'est un **reste**. `BookSkin` pose le
sommaire à gauche, puis centre le texte (`mx-auto max-w-[70ch]`) dans tout
l'espace restant. La largeur du vide dépend donc de la fenêtre :

| Fenêtre | Vide à gauche du texte |
|---|---|
| ~1920 px | ~300 px |
| 1280 px | ~100 px |
| < 1000 px | 0 |

### Décision

Borner la largeur du **couple** (sommaire + colonne de lecture) et centrer
l'ensemble, plutôt que centrer le texte seul dans ce qui reste. Le sommaire
reste alors collé au texte à toutes les largeurs, et le vide se répartit des
deux côtés.

Une largeur maximale, pas une règle conditionnelle : quand l'écran devient trop
étroit, elle cesse simplement de mordre et la disposition retombe d'elle-même
sur celle d'aujourd'hui. Aucun cas particulier à écrire, rien à tester sous un
seuil.

La borne est exprimée en **unités du contenu** plutôt qu'en pixels devinés :
`16rem` (le sommaire, `md:w-64`) `+ 70ch` (la colonne de prose) `+ 4rem` (le
rembourrage que `main` pose déjà). Elle suit donc la police si elle change, au
lieu de se périmer.

### Ce qui rend ce ticket petit

V2.1-12 vient de réunir les trois routes sur `BookSkin` : `/partage`,
`/m/[worldSlug]/apercu` et l'onglet Wiki joueur. La règle ne s'écrit donc
qu'**une fois** et vaut pour les trois — c'était précisément le bénéfice
annoncé de la fusion, et c'est son premier encaissement.

Ce ticket aurait dû être ouvert en même temps que V2.1-12 : les deux ont été
proposés ensemble, et seul le premier a été retenu au moment de passer au code.
L'auteur a dû constater lui-même, capture à l'appui, que sa disposition n'avait
pas bougé.

### Critères

- [x] Sur un écran de 1920, le vide entre sommaire et texte tombe de **~300 px
      à 32 px** — exactement le `md:px-8` que `main` posait déjà. Mesuré.
- [x] Le vide restant se répartit également : couple de **1063 px**, marges de
      429 px de chaque côté sur `/apercu`, 426/432 sur `/partage` (l'écart de
      6 px est la barre de défilement). Sur l'onglet joueur, 469/389 — le
      couple est centré dans la zone de contenu, **après** le rail de 80 px,
      qui est de la chrome et non du contenu. C'est la disposition de
      l'esquisse validée.
- [x] Sous le seuil, aucune régression : à 1000 px le couple fait 994 px, le
      sommaire est collé au bord, marge nulle — la disposition est exactement
      celle d'avant. La borne cesse de mordre d'elle-même.
- [x] Le tiroir sous `md` n'est pas affecté : l'`aside` y est `fixed`, donc
      hors du flux du conteneur ajouté.
- [x] Vérifié sur les trois routes, à 1000, 1280 et 1920 px.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

### Mesures

| Fenêtre | Couple | Marge gauche | Marge droite | Vide sommaire↔texte |
|---|---|---|---|---|
| 1920 px | 1063 px | 426 | 432 | 32 px |
| 1280 px | 1063 px | 106 | 112 | 32 px |
| 1000 px | 994 px | 0 | 0 | 32 px |

Le couple garde la même largeur tant que la borne mord, et le vide entre les
deux colonnes ne bouge plus du tout — c'était tout le sujet : il était un
reste, il devient une marge.

---

## V2.1-14 — Lettrine et traits de séparation dans le bloc texte · `M` — fait

Ce backlog se déclarait clos à V2.1-13 (voir « Ordre suivi » plus bas, dont la
phrase a dû être corrigée). Il rouvre le lendemain, sur une demande de l'auteur
qui porte précisément sur le ticket V2.1-3 : il voulait « revoir
l'articulation » du bloc texte et du Livre de sessions.

### Constat

La lettrine et les filets ornementaux existaient déjà — mais en dur dans
`app/globals.css`, sous un sélecteur `.journal-entry …` que
`PublicEntityBody.tsx` ne posait que pour `entity_kind === "session_journal"`.

Une **mise en forme était devenue la propriété d'un genre de fiche**. Un récit
de bataille sur une fiche `event` ne pouvait pas avoir de lettrine ; une entrée
de journal purement factuelle en avait une sans l'avoir demandée. C'est
l'inversion que ce ticket corrige.

### Décision

Deux options, **à deux niveaux différents** — c'est le point de conception du
ticket, et il a été tranché avec l'auteur avant d'écrire une ligne :

- **La lettrine est une propriété du bloc.** Un seul paragraphe est concerné,
  toujours le premier, et le choix vaut pour le bloc entier → `dropCap` dans
  `zTextBlockData`, une case à cocher dans `TextBlockEditor`. Pas dans la bulle
  de mise en forme, qui ne porte que ce qui s'applique à une sélection.
- **Le trait est un élément qu'on écrit.** « Mettre un trait » se fait à un
  endroit choisi → un nouveau `SEGMENT_BLOCK_TYPES` `divider`, inséré depuis un
  bouton de l'éditeur. Il porte donc sa **propre visibilité** comme tout
  segment : un trait qui sépare deux parties dont une est masquée disparaît
  avec elle, ce qu'une option de bloc n'aurait jamais su faire.

**Écarté :** garder le décor automatique des titres H2/H3 (le comportement
actuel) en le passant derrière une seconde case. Avec un trait posé à la main
il fait doublon, et il surprend — il apparaît sans qu'on l'ait demandé.

Le bouton d'insertion vit **hors de la bulle** de mise en forme : la bulle ne
s'ouvre que sur une sélection, or un trait s'insère précisément là où il n'y a
rien à sélectionner, sur une ligne vide entre deux parties.

### Ce que le genre `session_journal` perd, et ce qu'il garde

L'auteur voulait que « journal de session ne soit plus qu'une catégorie de
fiche ». Six choses étaient accrochées à ce genre ; **une seule** était
remplacée par les nouvelles options. La liste a été posée avant de décider :

| Accroché au genre | Sort |
|---|---|
| Lettrine + filets (CSS `.journal-entry`) | **Retiré** — remplacé par les options du bloc |
| Badge de type masqué, relations masquées | **Retiré** — purement cosmétique |
| Bloc `session_journal_meta` hors du fil, en pied de page | **Retiré** — devient un bloc normal, ajoutable via « + Bloc » sur n'importe quelle fiche, rendu dans le fil avec son titre |
| Table `session_journal_entries` (le devoir, la bannière, le roster) | **Gardé** — c'est un flux de travail, pas de la présentation |
| Groupe épinglé « Livre de sessions » en tête du sommaire, tri par `written_at` | **Gardé** — c'est de la navigation |
| 6ᵉ cas de `app.can_edit_entity` (l'autrice corrige son entrée) | **Gardé** — c'est un droit, et le retirer demanderait une migration |

Décision explicite : démonter le devoir aurait été un **autre ticket**, avec
son propre coût. On ne retire pas une table et une règle RLS avant d'avoir
vérifié à l'usage que le remplacement rend bien.

### Deux défauts trouvés en chemin

- **Le trait existait déjà, et se perdait en silence.** `StarterKit` était
  configuré sans désactiver `horizontalRule` : taper `---` créait bel et bien un
  trait dans l'éditeur, que `docToSegments` transformait en paragraphe vide à
  l'enregistrement. Le bouton et le type `divider` referment ce trou.
- **Une proposition d'IA acceptée aurait effacé la lettrine.**
  `aiProposals.ts` reconstruisait l'objet du bloc (`{ __v: 1, segments: … }`)
  au lieu de l'étendre. Le champ neuf y serait retombé à `false` à chaque
  acceptation. Passé en `{ ...currentData, segments: … }`.

### Pas de migration

`dropCap` est optionnel, à défaut `false` : tout le contenu antérieur reste
valide tel quel, d'où un `__v` inchangé. Le seul test qui a dû bouger est
celui qui vérifiait l'égalité stricte du texte validé — il affirme désormais
que le défaut est posé, ce qui est justement la garantie recherchée.

### Dépendance ajoutée

`@tiptap/extension-horizontal-rule` (3.29.2, MIT) passe de dépendance
transitive à dépendance directe — elle était déjà installée par
`@tiptap/starter-kit`, donc **zéro octet ajouté** ; c'est l'import qui devient
honnête. Même précédent exact que `extension-paragraph` et
`extension-heading`, déjà déclarées pour la même raison : on étend le nœud
pour lui greffer les attributs de segment.

### Critères

- [x] Une case « Lettrine sur le premier paragraphe » sur tout bloc texte, de
      n'importe quelle fiche.
- [x] La lettrine s'affiche dans l'éditeur comme en lecture (même sélecteur
      CSS, même élément).
- [x] Un bouton insère un trait de séparation à l'endroit du curseur.
- [x] Un trait porte sa propre visibilité et disparaît avec la partie qu'il
      sépare.
- [x] Plus aucune branche `session_journal` dans le rendu du wiki public.
- [x] Le bloc Séance s'ajoute via « + Bloc » et se rend dans le fil.
- [x] Le devoir, le groupe du sommaire et le droit de l'autrice sont intacts.
- [x] Vérifié en navigateur par l'auteur sur son wiki réel (15 septembre).

---

## V2.1-15 — Le droit de l'autrice d'une entrée devient un octroi retirable · `M` — fait

### Constat

Né de V2.1-14, sur une remarque de l'auteur en relisant ce qu'on avait gardé :
« il faudrait que je puisse enlever la permission d'édition du journal depuis
l'outil de gestion de campagne aussi. Je crois que ça n'est pas encore le cas. »

Ce n'était pas le cas. Le droit de l'autrice était le **6ᵉ cas en dur** de
`app.can_edit_entity` (migration 20260913160000) : `entity_kind =
'session_journal' AND created_by = auth.uid()`. L'outil de gestion de campagne
possède pourtant depuis V2-M9 une section « Octrois d'édition » qui liste
`entity_grants` avec un bouton « Retirer » — le droit de l'autrice n'y
figurait pas, et ne figurait nulle part.

Une joueuse qui quitte la table, un texte qu'on veut figer après relecture :
rien ne permettait de fermer la porte.

### Décision

Le raisonnement complet et la règle générale qui en sort sont dans
**`docs/adr/0024-droits-implicites-vs-octrois-explicites.md`**. En résumé : le
droit devient une vraie ligne `entity_grants`, posée à la création de l'entrée,
donc couverte par le 4ᵉ cas — et le bouton « Retirer » existant fonctionne sur
elle comme sur n'importe quel autre octroi.

`entity_grants_write` n'est pas assouplie pour autant. L'insertion passe par
`public.claim_journal_entry_grant`, `security definer`, étroite par
construction : aucun `user_id` en paramètre, une seule ligne, pour l'appelante
elle-même, sur une fiche qu'elle vient de créer, et seulement si un devoir **en
attente** lui est réellement assigné. `granted_by` est le MJ qui a assigné —
ce qui s'est littéralement passé, et ce qui rend la ligne lisible dans la liste.

**Le cas 5 (notes) reste**, et la différence est le critère même de l'ADR : une
fiche de notes privée n'est visible d'aucun autre compte, donc aucun MJ n'a
d'octroi à lui accorder ni à lui reprendre.

### Ce qu'il fallait ne pas rater

- **L'ordre dans `submitJournalEntry`.** `blocks_insert` appelle
  `app.can_edit_entity` : l'octroi doit être posé **entre** la création de la
  fiche et celle des deux blocs. Posé après, l'autrice aurait créé sa fiche puis
  échoué à y écrire une seule ligne.
- **Les entrées déjà rédigées.** La migration les reprend (`insert … select …
  on conflict do nothing`) : sans cela, leurs autrices perdaient leur droit à
  l'instant de l'application.
- **Le schéma de la fonction.** `public` et non `app` — PostgREST n'expose que
  `public`, et c'est le service qui l'appelle par `supabase.rpc()`. Même motif
  exact que `public.soft_delete_entity` (migration 20260902150011), déjà
  documenté à l'époque après un PGRST202 en direct.

### Le test devient plus exigeant

`canEditEntityRls.integration.test.ts` vérifiait le verdict de départ (« son
autrice peut la corriger »). Il vérifie maintenant le **cycle entier** sur la
base réelle : sans octroi l'autrice ne peut rien, avec l'octroi elle peut,
après le retrait elle ne peut plus — le geste exact que déclenche le bouton de
l'outil de gestion de campagne. Le miroir pur (`canEditEntity.test.ts`) garde
de son côté la porte fermée : « avoir créé une fiche ne donne aucun droit par
lui-même ».

### Critères

- [x] Le droit de l'autrice apparaît dans « Octrois d'édition ».
- [x] Le bouton « Retirer » lui reprend réellement l'édition (fiche ET blocs).
- [x] Une autrice qui commence à écrire peut poser ses blocs sans rien de plus.
- [x] Les entrées déjà rédigées gardent leur autrice éditrice.
- [x] `entity_grants_write` reste réservée au MJ ; rien d'autre ne s'est ouvert.
- [x] Migration appliquée sur la base distante (15 septembre, par l'auteur).
- [x] Vérifié en navigateur par l'auteur sur son wiki réel (15 septembre).

`npm run typecheck && npm run lint && npm run test` passent (1 044 tests, 119
fichiers — les tests d'intégration inclus). Avant l'application de la
migration, `canEditEntityRls.integration.test.ts` échouait sur son premier
pas : « sans octroi, l'autrice ne peut rien » alors qu'elle pouvait encore.
Cet échec était la mesure exacte de l'écart entre le code et la base, et il
est tombé à la seconde où la migration est passée — c'est la meilleure preuve
que ce test vaut quelque chose.

---

## V2.1-16 — Le défilement appartient aux fenêtres, et l'en-tête disparaît · `M` — fait

### Constat

Deux gênes signalées le 15 septembre, captures à l'appui, sur l'écran MJ et
sur l'écran Monde :

1. Une fiche ouverte « a beau être tout en haut de l'écran, elle déborde en
   bas » — le bas est inatteignable.
2. En faisant défiler avec une fiche ouverte, « la fenêtre reste stable alors
   que le reste de la page défile ».

Ce sont **deux symptômes de la même cause**. Recherche faite avant d'écrire ce
ticket :

| Ce qu'on voit | Cause | Où |
|---|---|---|
| La page défile d'exactement 56 px, l'en-tête s'en va | Une barre latérale en `md:h-screen` (100vh) posée **sous** un en-tête `h-14` : la page mesure 56 px de plus que l'écran | `components/shell/Sidebar.tsx:47`, `components/rules/RulesSidebar.tsx:243` |
| La fenêtre ne suit pas le défilement | La couche des fenêtres secondaires est `fixed`, donc ancrée à l'écran et non au document — choix correct en soi, mais le document n'était pas censé défiler | `components/shell/AvecWindowsLayer.tsx:130` |
| Le bas d'une fiche est hors de portée | `DEFAULT_HEIGHT = 760` en dur, jamais confronté à la place réelle (~660 px sur l'écran de l'auteur), et aucun plafond à l'affichage | `components/shell/DesktopWindowsProvider.tsx:22`, `components/shell/WindowFrame.tsx:104` |

**La cause de fond est plus ancienne que ces trois lignes.** `<body>` est
`min-h-full` et non `h-full` (`app/layout.tsx:99`) : il n'a
donc **pas de hauteur définie**, et tout `h-full` en dessous se résout en
`auto`. Chaque coquille a contourné le problème dans son coin plutôt qu'à la
racine — `PlayerShell.tsx:68` l'explique en douze lignes de commentaire avant
de poser un `h-dvh`, et `BookSkin.tsx:126` décrit une borne « `h-screen` avec
`overflow-hidden` » d'`AppShell` qui **n'existe pas**. Un contournement par
section signifie que le symptôme revient à chaque section nouvelle.

L'auteur, en regardant les esquisses, a ajouté une demande : il n'utilise pas
la barre d'en-tête, et voudrait la supprimer au profit de la disposition du
wiki public. Les deux sujets se tiennent — l'en-tête est précisément le 56 px
que la barre latérale ignore.

### Mesure faite avant d'écrire

Le point le plus risqué du plan était de passer `<body>` en hauteur définie
sans casser le défilement des pages publiques. Mesuré en navigateur, viewport
de 1200×800, bandeau de 40 px :

| Cas | Hauteur défilable du document | Hauteur de la zone |
|---|---|---|
| Enfant ordinaire (pages hors `/m`) | 2040 px — la page défile | 2000 px, non écrasée |
| Enfant en `min-height: 0` (la coquille) | 800 px — le document ne défile plus | 760 px = 800 − le bandeau |

La taille minimale automatique d'un item flex protège les pages qui doivent
défiler ; `min-height: 0` est ce qui borne celles qui ne doivent pas. Le
bandeau « voir comme » est soustrait tout seul, sans constante à écrire —
c'est ce qui avait fait rejeter `h-dvh` en son temps.

### Décision — deux lots ordonnés

**Lot 1 — le document est borné à l'écran.**

- `<body>` passe en hauteur définie ; la coquille de monde devient
  `overflow-hidden`.
- `md:h-screen` disparaît des deux barres latérales qui le portent.
- `MjSidebar` reçoit la zone défilante qui lui manque (17 outils, aucun
  `overflow-y-auto` aujourd'hui).
- `WindowFrame` plafonne sa hauteur à son conteneur par une règle CSS
  (`max-height` dérivé de sa position), pas par un état à recalculer :
  redimensionner le navigateur reborne les fiches ouvertes sans rien stocker.
- La hauteur par défaut d'une fenêtre se dérive de la place disponible au lieu
  de la constante 760.
- La barre des fiches réduites **réserve sa hauteur** au lieu de se poser
  par-dessus : la zone de travail se raccourcit tant qu'une fiche est réduite,
  comme le Dock. Une fenêtre maximisée s'arrête au-dessus d'elle.
- `PlayerShell` : le `h-dvh` de contournement redevient inutile. **Vérifier,
  pas supposer** — c'est le seul endroit où le retrait peut régresser.

**Lot 2 — l'en-tête disparaît (esquisse A, validée par l'auteur).**

- Un bouton de sortie (icône) suivi du nom du monde cliquable, en tête des
  trois barres latérales, comme `BookSkin` le fait déjà pour le wiki public.
  Le nom de la campagne le suit en seconde ligne sur l'écran MJ.
- Une pastille arrondie en haut à droite porte la radio et l'heure. Elle passe
  **sous** les fenêtres : une fiche maximisée la recouvre, choix explicite de
  l'auteur.
- Le bouton de dés ne bouge pas : en bas à droite, inchangé.
- Tombent avec l'en-tête : son `h-14`, le `top-14` de la couche des fenêtres
  secondaires, les `top-14` et `top-[68px]` des trois barres latérales. Les
  fiches récupèrent 56 px de hauteur.

L'ordre compte : le lot 1 corrige le défaut, le lot 2 retire ce qui le rendait
possible. Fait dans l'autre sens, la correction se réécrirait deux fois.

### Ce que ce ticket ne fait pas

- **Repositionner** une fiche quand l'écran rétrécit. Tranché avec l'auteur,
  esquisses à l'appui (15 septembre) : **elle se comprime, elle ne bouge pas**.
  Une fiche reste là où on l'a posée ; seule sa hauteur cède. C'est une règle
  CSS dérivée de sa position, donc rien à mémoriser, rien à recalculer, et
  elle vaut même pendant qu'on tire le bord du navigateur. Le prix accepté :
  sur un écran très réduit, une fiche posée bas devient un bandeau étroit.
  Déplacer la fiche demandait de réécrire sa géométrie à chaque
  redimensionnement sans jamais la rendre à sa place d'origine.

### Critères

- [x] Les trois sections ne font plus défiler le document : `scrollY` reste à
      0 après un `scrollTo(0, 500)`, sommaire de ClaudeLand déplié. Mesuré à
      1280x800 et 1280x520, Monde, Règles et MJ.
- [x] L'ascenseur est dans la barre latérale (cadre 675, contenu 1060) et
      dans la colonne de lecture joueur (cadre 752, contenu 6335) ; jamais
      sur la page.
- [x] Une fiche tient entièrement dans sa zone de travail, bas compris. Sur
      un écran de 520 px — bien plus dur que celui de l'auteur — la zone fait
      464 px et la fiche s'arrête exactement à 520 : débordement nul.
- [x] Une fiche se comprime au lieu de se déplacer : hauteur demandée 760,
      hauteur utilisée 440 sur un écran de 520, position inchangée (24 px du
      haut). La borne étant une règle CSS, elle vaut à chaque passe de mise en
      page — mesuré à deux tailles d'écran.
- [x] Réduire une fiche raccourcit les DEUX zones de travail, de 744 à 700 :
      la barre occupe 756-800, les zones s'arrêtent à 756. Une fenêtre
      maximisée faisant 100 % de sa zone, elle s'arrête donc au-dessus.
- [x] Plus aucun `top-14` ni `top-[68px]` dans la coquille — `grep` ne rend
      plus que deux commentaires qui racontent leur disparition. Les fiches
      ont récupéré les 56 px : la zone de travail passe de 744 à 800.
- [x] Sortie et nom du monde en tête des trois barres latérales, par un seul
      composant (`WorldSidebarHeader`) ; « Faerûn (copie) » sous « ClaudeLand »
      sur l'écran MJ, nulle part ailleurs. Bouton de sortie de 30x30, nom
      accessible « Mes mondes ».
- [x] Pastille radio + heure en haut à droite, recouverte par une fiche
      maximisée (`elementFromPoint` rend la barre de titre) et cliquable
      sinon : son panneau s'ouvre entier dans l'écran. Il a fallu la poser
      DANS la zone de travail pour cela — voir le constat ci-dessous.
- [x] Bouton de dés inchangé en bas à droite : aucun fichier du volet de dés
      n'est touché par le lot.
- [x] Une page hors coquille défile toujours : sonde de 2000 px posée dans
      l'application réelle, document porté à 2000 px, contenu non écrasé.
      **`/partage` lui-même non ouvert** — aucun lien de partage sous la main.
- [x] La coquille joueur ne régresse pas, `h-dvh` retiré : le rail fait toute
      la hauteur (800), la colonne de lecture défile dans son cadre, la page
      ne défile pas.
- [x] `npm run typecheck && npm run lint && npm run test` passent — 1044 tests.
- [x] `docs/adr/0025-le-defilement-appartient-aux-fenetres.md` écrit : pourquoi
      la borne vit à la racine et non par section, et ce que coûtait le
      contournement précédent.
- [x] La liste des outils MJ défile dans la barre latérale au lieu d'allonger
      la page : à 1280x520, cadre de 398 pour 536 de contenu, `scrollTop`
      atteint 138. Elle n'avait aucune zone défilante avant ce lot.

### Méthode

Interface esquissée avant d'écrire une ligne, comme V2.1-11 : trois esquisses
de l'état actuel et de la cible, puis quatre dispositions de coquille sans
en-tête. C'est l'esquisse qui a fait apparaître la demande de supprimer
l'en-tête — elle n'était dans aucun constat de départ.

---

### Mesures du lot 1

Écran de 1280x800, section Monde, sommaire de ClaudeLand déplié.

| | Avant | Après |
|---|---|---|
| Hauteur de `<body>` | 856 px | 800 px |
| `scrollY` après un `scrollTo(0, 500)` | **56 px** | **0** |
| Barre latérale | 800 px, posée sous 56 px d'en-tête | 744 px, du bas de l'en-tête au bas de l'écran |
| Sommaire | pousse la page | défile dans son cadre : 675 pour 1060 de contenu |

Les 56 px de l'avant ne sont pas une coïncidence : c'est la hauteur exacte de
l'en-tête, celle dont un `100vh` posé dessous dépasse. C'est ce défilement-là
que l'auteur faisait, et sous lequel la fenêtre — ancrée à l'écran — ne
bougeait pas.

Fiche ouverte, écran ramené à 1280x520 :

| | Valeur |
|---|---|
| Zone de travail | 464 px (520 − 56) |
| Hauteur demandée par la fiche | 760 px |
| Hauteur utilisée | 440 px |
| Débordement sous l'écran | 0 |
| Position | inchangée, 24 px du haut |

Une fiche réduite, enfin : la barre occupe 756-800 et les deux zones de
travail passent de 744 à 700. Elles s'arrêtent donc au-dessus d'elle, y
compris une fenêtre maximisée, qui fait 100 % de sa zone.

---

Section MJ, écran de 1280x520, fenêtre « Gestion de campagne » ouverte —
la copie exacte de la capture d'origine :

| | Valeur |
|---|---|
| Défilement de la page | 0 |
| Barre latérale | 464 px (520 − 56) |
| Liste des dix-sept outils | cadre 398, contenu 536, défile de 138 dans la barre |
| Fiche ouverte | de 80 à 520 — elle s'arrête au bas de l'écran |

---

### Ce que le lot 2 a appris

**« Sous les fenêtres » ne s'obtient pas depuis l'extérieur.** La pastille a
d'abord été posée à côté de la zone de travail, avec un `z-index` plus bas que
les deux couches de fenêtres. Elle s'affichait au bon endroit, avec la bonne
apparence — et elle était morte : `elementFromPoint` rendait le fond de la zone
de travail, jamais le bouton. Le conteneur de cette zone porte un `z-index`,
donc il forme une pile d'empilement : « sous les fenêtres » y voulait dire
« sous toute la zone », fond compris.

La pastille vit donc DANS la zone de travail, entre son fond et ses fenêtres
(`z-10` contre `z-20`/`z-30`). C'est la seule position qui tienne les deux
moitiés de la demande à la fois.

Le défaut ne se voyait sur aucune capture : le rendu était exact. Il a fallu
cliquer. Un élément qui s'affiche correctement peut n'être atteignable par
personne, et aucune relecture de code ne le dit.

---

---

## V2.1-17 — Deux retouches de rendu au Livre de sessions · `S` — fait

### Constat

Deux défauts vus par l'auteur en lisant sa propre entrée, captures à l'appui,
le lendemain de V2.1-14. Ni les types ni les tests ne pouvaient en dire quoi
que ce soit : les deux sont des questions de pixels.

**Le bloc Séance n'alignait rien.** Ses libellés (10 px) et ses valeurs (14 px)
vivent dans une grille laissée en `align-items: stretch`, l'alignement par défaut.
Chacun se pose donc en haut de SA cellule ; comme les deux tailles n'ont pas la
même hauteur de ligne, leurs lignes de base divergent. Le défaut vient du
balisage de `PublicInfoboxBlock`, dont ce bloc est copié, et dormait donc là
depuis longtemps — il n'est devenu voyant qu'en V2.1-14, quand le bloc a quitté
le pied de page discret pour entrer dans le fil avec des valeurs longues.

**Un trait posé en tête de bloc tombait au mauvais endroit.** Il se rendait
entre le titre du bloc et le texte que ce titre annonce — alors qu'un
séparateur sépare deux parties, il ne s'insère pas entre une partie et son nom.
Et il s'ajoutait au filet automatique que **chaque** bloc porte depuis V2-G11
(`border-b border-edge/60`) : deux traits à la même jonction, l'un choisi et
l'autre subi. L'auteur avait vu juste en soupçonnant un reste codé en dur.

### Décision

**Ligne de base** pour le bloc Séance (`items-baseline`) — le seul alignement qui
tienne entre deux textes de tailles différentes.

Corrigé d'abord sur ce bloc seul, puis **sur `PublicInfoboxBlock` aussi**, à la
demande de l'auteur dans la foulée : c'est l'original dont le bloc Séance était
copié, il portait donc le même défaut sur toutes les autres fiches du wiki
depuis V0. Le bloc Séance n'a rien cassé, il a rendu voyant ce qui était déjà
là — le genre de correction qu'on ne fait que parce qu'un cas particulier a
attiré l'œil sur le cas général.

**Un trait en PREMIER segment d'un bloc texte remonte au-dessus du titre**
(`hasLeadRule`), et le bloc précédent éteint son propre filet : le trait choisi
**remplace** le filet subi au lieu de s'y ajouter. Un trait au milieu du texte,
lui, ne bouge pas — seule la position de tête change de sens.

Le calcul vit dans `PublicEntityBody` et non dans `PublicBlockView` : il faut voir le
bloc SUIVANT pour savoir si le filet courant doit s'éteindre, et un bloc ne se
voit pas lui-même. Un sélecteur CSS `:has(+ …)` aurait suffi entre blocs frères,
mais le premier bloc est rendu ailleurs dans le DOM (dans le `flow-root` du
portrait) et aucun sélecteur ne les relie — d'où une vraie prop plutôt qu'une
règle implicite qui aurait marché partout sauf à un endroit.

### Vérification

En navigateur, sur des blocs de contrôle posés dans `faerun-copie-3` puis
supprimés (fiche repassée en `is_public = false`, état d'origine revérifié après
coup). Mesuré plutôt que jugé à l'œil :

| Mesure | Valeur |
|---|---|
| Écart de ligne de base libellé/valeur | 1,2 px (descendantes) — les bases coïncident |
| Idem sur `PublicInfoboxBlock`, valeur sur deux lignes | 1,2 px — le libellé suit la PREMIÈRE ligne |
| Trait de tête rendu avant le titre | oui |
| Filet du bloc précédent | `0px` |
| Trait au milieu du texte | resté en place |
| Largeur du trait | 279 px sur 698 (40 %), centré |
| À 375 px | aucun débordement, Séance toujours sur deux colonnes |

### Critères

- [x] Les libellés du bloc Séance sont sur la ligne de base de leurs valeurs.
- [x] Ceux de l'infobox aussi, y compris quand la valeur passe à la ligne.
- [x] Un trait en tête de bloc se rend au-dessus du titre du bloc.
- [x] Il remplace le filet automatique au lieu de s'y ajouter.
- [x] Un trait au milieu d'un texte reste où il a été posé.
- [x] `npm run typecheck && npm run lint && npm run test` passent (1 044 tests).

---

## V2.1-18 — Aperçu des fiches au survol d'un lien · `L`

### Constat

Deux défauts d'un seul tenant, signalés par l'auteur le 16 septembre depuis
son monde en production (`/partage/leschroniquesdesroyaumesoublies/37`).

**Un lien de règle ne mène nulle part, et ne le dit pas.** `renderNode`
(`PublicBlockView.tsx`) ne rend un nœud `ref` de kind `"rule"` comme lien que
si `ruleHrefBase` lui est fourni. Cette prop n'existe qu'aux deux endroits
authentifiés qui ont une page de règle à offrir (`joueur/wiki/[entitySlug]/page.tsx`,
`FicheCompanion.tsx`) ; sur `/partage` et `/apercu` elle est absente —
délibérément, aucune page de règle n'existe pour un visiteur anonyme. Le nœud
retombe alors sur un `<span>`.

Mesuré sur la page réelle : des vingt premières mentions du Prologue,
dix-sept sont des `<a>` et trois des `<span>` (« nain », « halfeline » deux
fois). Le défaut n'est pas le repli, c'est **sa classe** : le `<span>` porte
quand même `.rich-ref-mention`, donc la couleur `--link-entity` et le souligné
pointillé d'un vrai lien (`app/globals.css:274`). Rien ne distingue à l'œil
« Brennan », cliquable, de « nain », inerte. Le visiteur clique dans le vide.

**Et rien ne se lit sans quitter la page.** Même quand le lien fonctionne,
vérifier qui est Brennan coûte une navigation puis un retour. Sur un Livre de
sessions dont un paragraphe cite cinq fiches, la lecture se paie en
allers-retours. C'est la demande d'origine de l'auteur : un aperçu sur place.

### Décision

**Une carte flottante au survol, la même forme pour les entités et pour les
règles.** Trois variantes ont été esquissées et manipulées avant d'écrire une
ligne (habitude prise en V2.1-11) : carte flottante, bulle mécanique dense,
volet latéral épinglé. L'auteur a retenu la première pour tout. Le volet
épinglé reste une bonne idée et n'est pas ce ticket.

La carte porte quatre choses : une vignette, le nom, la catégorie, un extrait.

**La catégorie est le libellé de la fiche, pris aux tables existantes** —
`ENTITY_KIND_LABELS` (`character` → « Personnage ») et `regles.entryTypes` de
`messages/fr.json` (`species` → « Espèce »). Jamais un libellé réécrit pour
l'occasion : la première esquisse affichait « Personnage non-joueur » sous
Brennan, qui n'existe nulle part dans le projet, et l'auteur l'a relevé. Une
esquisse qui invente un libellé fait croire qu'il existe.

**Pour une entité, l'extrait est le premier paragraphe visible.** Pour une
règle, c'est le bloc `description` **seul** — jamais une valeur mécanique, ni
CA, ni dé, ni table de progression. Le bloc est taillé pour ça : `segments:
[{ text }]`, du texte simple sans lien ni visibilité propre
(`src/core/schemas/rule-blocks/blocks.ts:52`). Décision de l'auteur, et elle a
deux effets qui vont dans le même sens — le wiki public reste orienté lore, et
aucune donnée de règle ne franchit la frontière du partage anonyme.

**Note de licence, consignée sans trancher à la place de l'auteur.** Interrogé
sur la provenance de cette prose, l'auteur indique qu'elle vient d'aidedd.org,
« prose de fan et libre ». Vérification faite : le pied de page du site dit
« contenu de fan non officiel autorisé dans le cadre de la Politique des
contenus de fans […] Certaines parties des matériaux utilisés sont la
propriété de Wizards of the Coast ». Le site ne se déclare donc pas
réutilisable — toléré n'est pas libre, et une traduction est elle-même une
œuvre. Ce que l'auteur décrit, en revanche, ne pose pas ce problème : une
description réécrite pour son univers est la sienne. Le seul cas exposé serait
le report mot pour mot, que `page_ref` existe déjà pour éviter
(`specs/ruleset-personnel.md` §1). Outil personnel, liens non listés, décision
prise en connaissance de cause : écrit ici pour que personne ne la « corrige »
plus tard sans savoir qu'elle a été examinée.

**Sans prose, pas de lien.** Une fiche de règle dont le bloc `description` ne
porte que `page_ref` — le cas prévu pour `personal_reference` — n'a rien à
montrer à un visiteur. Son lien redevient du texte ordinaire plutôt que
d'ouvrir une carte vide. Ce choix règle du même coup le lien mort du constat,
et donne dans le texte un signal visible de ce qu'il reste à rédiger.

**La vignette n'apparaît que si le portrait existe.** Rien de nouveau à
transporter : le portrait est public dès qu'on voit le nom de la fiche
(`publicShare.ts:635`), il se sert par `/api/entities/[id]/portrait`, et
`textRefs` est déjà indexé **par identifiant** — la clé est l'id. Même repli
que `PublicPortrait` sur un 404. Aucune fiche de règle n'a d'illustration
(`RuleEntryView.tsx` le dit), la carte s'y resserre donc sur le nom et la
prose.

**Ce que ça coûte au serveur, et qui n'existait pas.** Aujourd'hui un lien de
règle ne demande aucune résolution : le lien se construit depuis la clé portée
par le nœud, et `publicShare.ts:276` l'écrit noir sur blanc. Ce commentaire
devient faux et se corrige avec le lot 2. L'extrait, lui, oblige à lire le
premier bloc texte de **chaque fiche citée** — une douzaine sur le Prologue.
En une requête groupée, jamais une par lien.

**La visibilité se résout avant l'envoi, comme partout.** L'extrait passe par
`filterTextBlockSegments`, comme le corps de la fiche : il ne peut donc jamais
venir d'un segment masqué. Ce n'est que la règle absolue n°5 — mais un extrait
est un chemin de lecture **de plus** vers la même donnée, et c'est exactement
le genre d'ajout par lequel une fuite entre.

### Fluidité

Demande explicite de l'auteur, formulée avant le code : que l'aperçu soit
instantané et que le wiki devienne fluide. Traitée ici plutôt qu'en
optimisation d'après-coup — la moitié des décisions ci-dessous ne serait plus
rattrapable une fois le lot 3 écrit.

**Rien ne part sur le réseau au survol.** C'est la raison pour laquelle le lot
2 résout côté serveur au lieu d'exposer une route d'aperçu : la carte se peint
avec ce qui est déjà dans le HTML de la page, en une image. Une route aurait
été plus simple à écrire et aurait mis 80 à 200 ms entre l'intention et la
carte — soit exactement la latence qu'on cherche à supprimer.

**La catégorie est gratuite.** `listEntitiesForWorld` sélectionne déjà
`entity_kind` (`ENTITY_COLUMNS`, `repos/entities.ts`) ; la construction
d'`entityLookup` le jette au passage (`publicShare.ts:556`). Il suffit de ne
plus le jeter : aucune requête, aucune colonne de plus.

**L'extrait est le seul vrai coût, et il se borne côté serveur.** Une requête
groupée sur les blocs `text` des seules fiches citées, lancée *dans* le
`Promise.all` existant et non après lui. La coupe à ~240 caractères se fait
**sur le serveur** : envoyer le paragraphe entier pour le tronquer en CSS
ferait grossir le HTML avec la longueur des fiches citées, et laisserait
partir du texte que personne ne lira — deux fois tort.

**Un seul nœud de carte pour toute la page, pas un par lien.** Le Prologue
porte plus de vingt mentions ; vingt composants avec chacun leur minuteur et
leurs écouteurs seraient du gaspillage pur. Délégation d'événements sur le
conteneur de texte, une seule instance en portail. Positionnée par
`transform`, mesurée une fois à l'ouverture — jamais `left`/`top` animés, qui
repassent par la mise en page à chaque image.

**~~Le délai d'intention sert deux fois.~~ Écrit avant la mesure, et la mesure
l'a démenti.** L'idée : les 250 ms qui précèdent l'ouverture de la carte sont
le meilleur signal disponible qu'un lecteur va cliquer, donc le même minuteur
déclenche `router.prefetch(href)` et la fiche est chaude au clic.

Elle ne paie rien sur cette route, et le mesurer a demandé une construction de
production — Next **désactive le préchargement en développement**, ce que dit
sa propre source (`client/components/links.js` : *« Prefetching on viewport is
disabled in development »*). Trois constats, dans cet ordre :

1. `<Link>` seul ne prépare rien ici : cible laissée 2 s dans le viewport,
   **zéro** requête. `/partage/[token]/[entitySlug]` est entièrement dynamique
   et n'a pas de `loading.tsx`, donc le préchargement « auto » n'a aucune
   frontière à préparer. Le survol était bien le seul déclencheur.
2. Mais la charge préchargée n'est jamais réutilisée : le survol produisait
   deux requêtes, **et le clic en faisait une troisième**. C'est
   `staleTimes.dynamic`, qui vaut 0 par défaut — une route dynamique
   préchargée est écartée aussitôt.
3. Chronométré : **448 ms à froid contre 428 ms après un survol appuyé**, soit
   l'écart de mesure.

Donc deux rendus serveur par lien survolé, pour rien — l'inverse exact de la
fluidité recherchée. Retiré, avec la mesure écrite dans le composant pour que
personne ne le remette sans refaire le calcul. À rouvrir seulement si
`staleTimes` change, ce qui est une décision de portée applicative et pas de
composant.

C'était la plus jolie idée de ce ticket. Elle n'a pas survécu à un
chronomètre, et la garder aurait coûté à chaque lecteur.

**La vignette ne doit pas faire sauter la carte.** `/api/entities/[id]/portrait`
répond par une redirection vers une URL signée : deux allers-retours au
premier survol. Sa boîte est donc réservée en dur (rapport 3/4, comme
`PublicPortrait`), l'image apparaît dedans quand elle arrive. Pas de carte qui
grandit sous le curseur, et le repli sur 404 reste celui qui existe déjà.

**Ce que ce ticket ne fera pas, et qui pèse plus lourd que lui.** En mesurant
ce qui précède, un coût plus ancien est apparu — il n'appartient pas à ce
ticket, mais il est écrit ici parce que c'est en cherchant la fluidité qu'on
l'a trouvé :

`/partage/[token]/[entitySlug]` rend `BookSkin` depuis la **page** et non
depuis le layout, seule des trois routes de wiki dans ce cas (V2.1-12 a hissé
les deux autres ; la garde par mot de passe l'a interdit ici). Chaque
navigation refait donc `getPublicEntityTree` — cinq requêtes — pour
reconstruire un sommaire identique. Et `listEntitiesForWorld(worldId)` part
deux fois par fiche, une fois pour l'arbre (`publicShare.ts:168`), une fois
pour `entityLookup` (`publicShare.ts:556`).

Ce second point a d'abord été noté ici comme un simple doublon d'appel. Il ne
l'est pas : la fonction **est** mémoïsée par `React.cache()`, et la
mémoïsation est défaite par l'identité du client Supabase. Le vrai défaut est
plus large que le symptôme qui l'a fait voir, et il est parti en **V2.1-19**
avec le hissage de la coquille. Rien de tout cela n'appartient au présent
ticket — mais c'est en cherchant la fluidité de l'aperçu qu'on l'a trouvé, et
c'est la raison pour laquelle ces lignes restent ici.

### Lots

Ordonnés, et le premier est autonome.

**Lot 1 — le lien mort.** Un `ref` de kind `"rule"` sans destination cesse de
porter `.rich-ref-mention`. Corrige le défaut d'aujourd'hui même si les trois
autres lots ne se font jamais.

**Lot 2 — résolution serveur.** `textRefs` enrichi (catégorie + extrait),
nouvelle table `ruleRefs` (nom, type d'entrée, extrait de `description`),
requête groupée dans le `Promise.all` existant, coupe de l'extrait côté
serveur, et le commentaire de `publicShare.ts:276` réécrit puisqu'il ne dira
plus vrai.

**Lot 3 — la carte.** Une seule instance pour toute la page, délégation
d'événements, délai d'intention ≈ 250 ms, survol de la carte elle-même qui la
maintient ouverte, position par `transform`, vignette à boîte réservée. Le clic
navigue comme aujourd'hui : l'aperçu ne remplace jamais la fiche. Le clavier
ouvre la carte au focus et `Échap` la ferme.

**Lot 4 — tactile.** Sous `(pointer: coarse)` il n'y a pas de survol : le tap
sur un lien de règle ouvre une feuille basse, le tap sur une entité navigue
comme aujourd'hui.

### Ce que le code portait déjà, et qu'il ne fallait pas réécrire

Trois pièces trouvées en cherchant où brancher le lot 2, chacune évitant du
code neuf :

**`chipSummaryFromDescription`** (`src/core/rules/chipSummary.ts`) fait déjà
exactement l'extrait de règle décrit ici : premier segment non vide de la
description, espaces normalisés, coupe à 240 caractères sur une frontière de
mot, `null` quand il n'y a rien. Écrit pour les chips de l'onglet Traits, pur
et testé. Le module d'extrait d'ENTITÉ (`src/core/richtext/excerpt.ts`, neuf)
lui emprunte sa constante plutôt que d'en recopier la valeur — ce que les deux
ont en commun tient dans un nombre, ce qui les sépare est la forme de
l'entrée.

**`resolveRuleChips`** (`referenceChips.ts`) portait déjà la remontée de
chaîne de rulesets, la traduction et le repli sur une fiche maison. Le
résolveur du lot 2 en est le jumeau, à deux différences près, écrites dans son
commentaire : pas de `href` (route authentifiée), et **pas de repli sur
`ai_digest`** — ce résumé est généré à l'import depuis la source anglaise et
reste anglais sous une fiche traduite. Sur un wiki français, faute de prose on
ne rend rien : c'est la décision « sans prose, pas de lien ».

**`listBlocksByTypeForEntities`** (`repos/blocks.ts`) était déjà la requête
groupée nécessaire aux extraits d'entité. Aucun dépôt à écrire.

En revanche, une duplication a été évitée de justesse : `playerEntityDetail.ts`
construit ses `textRefs` comme `publicShare.ts`, et les deux recopient déjà
leurs filtres de visibilité l'un de l'autre. Une troisième copie aurait fini
par diverger sur le seul point où elle ne doit jamais diverger — d'où
`src/server/services/refPreview.ts`, partagé, avec le `viewer` en paramètre.
Le wiki joueur reçoit donc la même carte, filtrée pour SON lecteur.

### Vérification

En navigateur sur `/partage/leschroniquesdesroyaumesoublies/37` (le Prologue,
la page la plus chargée en mentions du monde de l'auteur).

| Mesure | Avant | Après |
|---|---|---|
| Mentions inertes portant le style d'un lien | 3 sur 20 | **0** |
| Nœuds de carte dans le DOM, deux survols successifs | — | **1** |
| Hauteur du document à l'ouverture d'une carte | — | inchangée |
| Écart carte/lien, à trois positions de défilement | — | 8 px, constant |
| Poids HTML de la page | 68 359 o | 76 387 o (**+7,8 Ko**) |
| Requêtes serveur ajoutées par fiche | — | 1, dans le `Promise.all` existant |

Contenu vérifié sur les deux formes : « Nain / ESPÈCE / Peuple des montagnes
et des forges… » pour une règle, sans pied (aucune page à ouvrir sur
`/partage`) ; « Brennan Torram / PERSONNAGE / … / Ouvrir la fiche → » pour une
entité, vignette comprise. Les deux libellés viennent des tables du projet —
`ENTITY_KIND_LABELS` et `regles.entryTypes` — jamais réécrits.

**Trois défauts vus par l'auteur à l'usage, corrigés ensuite.** Aucun des trois
ne se voyait dans les mesures — il fallait ouvrir le wiki et survoler.

**0. Le pied « Ouvrir la fiche → » ne menait nulle part.** Un `<span>` portant
`--link-entity`, jamais un `<a>`. C'est-à-dire, trait pour trait, **le défaut
que le lot 1 de ce ticket corrige dans le texte** — un mot qui a la couleur et
l'allure d'un lien sans en être un — réintroduit par la carte écrite pour le
réparer. Le ticket décrivait ce pied depuis les esquisses ; personne, moi
compris, n'a vérifié qu'il était cliquable, parce qu'il *avait l'air* de
l'être sur toutes les captures.

La leçon vaut d'être notée à côté de celle du pointeur : **une vérification
qui regarde un rendu ne teste que l'apparence.** Les quarante ouvertures de
carte mesurées plus haut n'ont jamais cliqué sur quoi que ce soit.

**1. La carte était coupée par le bas de l'écran** (capture à l'appui). La
position horizontale était bornée, la verticale non : la carte se posait
toujours sous le lien, quitte à sortir de la fenêtre. Corrigé en trois cas —
dessous si elle y tient, **au-dessus sinon**, calée dans la fenêtre en dernier
recours.

Le point qui a demandé de restructurer : ce choix dépend de la HAUTEUR de la
carte, qui n'existe pas avant qu'elle soit rendue. Le placement quitte donc
`open()` pour un `useLayoutEffect` — qui s'exécute après le rendu mais **avant
la peinture**, ce qui est précisément la différence avec `useEffect` : avec ce
dernier, la carte sauterait d'un endroit à l'autre sous les yeux du lecteur.

**2. Le survol était coupé sur les machines tactiles.** Trois versions ont été
nécessaires, et les deux premières ont échoué de la même façon : elles
demandaient à l'appareil ce qu'il *est* au lieu de regarder ce que la personne
*fait*.

- **`pointer: coarse`** (lot 4). Décrit le pointeur **principal** : vrai sur
  toute machine à écran tactile, souris branchée ou non. Découvert en testant
  le correctif précédent, le poste de vérification se déclarant tactile.
- **`any-hover: hover`** (première correction). Devait couvrir le cas « une
  souris existe quelque part ». **Démentie par l'auteur sur sa Surface Pro** :
  la requête répond `false` alors qu'une souris est bien là — avec un écran
  tactile présent, Chrome/Edge sous Windows n'énumèrent pas toujours la
  souris. Déployée, vérifiée dans le JS de production, et toujours aucune
  carte au survol.
- **`PointerEvent.pointerType`** (version retenue). L'événement dit lui-même
  s'il vient d'une souris, d'un stylet ou d'un doigt. Plus aucune prédiction :
  `pointerover` avec `pointerType` `mouse` ou `pen` ouvre la carte, `touch`
  est ignoré (un navigateur tactile émet un `pointerover` synthétique juste
  avant le clic, qui ferait clignoter la carte au moment où la navigation
  part). Le tap est servi par le gestionnaire de clic, à sa place.

**La règle à retenir** — et c'est la vraie leçon de ce ticket : *une requête
média décrit ce qu'un appareil déclare, pas ce que la personne est en train de
faire.* Pour une interaction, interroger l'événement ; la requête média ne
sert plus qu'à choisir une mise en page, et elle porte désormais sur la
largeur (`max-width: 767px`), ce qui est bien une question de largeur.

Deux corrections dans la foulée : le clic sur une règle ouvre sa carte partout
et plus seulement au tactile — c'est sa seule destination — et le clavier
ouvre la carte au focus sans condition.

**Ce que ces trois versions ont coûté, et pourquoi.** Aucune n'aurait été
trouvée par une mesure : la première est passée parce que le poste de
développement n'émulait pas encore le tactile, la deuxième parce qu'il
l'émulait *trop* (`any-hover` y vaut `false`, comme sur une vraie tablette,
mais pas comme sur une Surface Pro avec souris). **Seul du matériel réel entre
les mains de son utilisateur a tranché**, deux fois de suite.

**Une correction d'apparence, trouvée à l'écran et pas dans le code.** La
carte était lisible « à travers » : `--panel-raised` porte un alpha de 0,90,
comme tout panneau flottant du projet. Sur un menu posé sur une surface vide
personne ne le remarque ; sur une carte posée en plein paragraphe, le texte
dessous traverse. Corrigé par un flou d'arrière-plan et non par une couleur —
la charte interdit d'inventer un jeton, un flou n'en est pas un.

### Critères

- [x] Un lien de règle sans destination ni prose ne se distingue plus du texte
      ordinaire — ni couleur de lien, ni souligné pointillé.
- [x] Survoler un lien d'entité ouvre une carte portant son portrait (s'il
      existe), son nom, sa catégorie et son premier paragraphe visible.
- [x] La catégorie affichée est exactement celle de la fiche (« Personnage »,
      « Lieu », « Espèce », « Monstre »…), jamais un libellé inventé.
- [x] Survoler un lien de règle ouvre une carte portant son nom, son type et
      sa description — et **aucune** valeur mécanique.
- [x] Vérifié deux fois : par lecture du HTML envoyé (chaque extrait se
      retrouve mot pour mot dans le corps public de sa propre fiche), et par
      trois tests purs qui composent `filterSegments` et `excerptFromSegments`
      — un paragraphe MJ placé en PREMIER ne sort jamais pour un anonyme.
      La preuve négative est un test permanent, pas un constat d'écran.
- [x] Une page citant une douzaine de fiches ne déclenche pas une requête par
      lien.
- [x] Sur un écran étroit, le tap ouvre une feuille basse au lieu de ne rien
      faire. Le survol au DOIGT n'ouvre rien (pas de carte qui clignote
      pendant la navigation) ; à la souris et au stylet, il ouvre — y compris
      sur une machine qui se déclare tactile.
- [x] Le clavier ouvre la carte au focus, `Échap` la ferme.
- [x] **Ajouté après coup, sur retour de l'auteur (capture) :** une carte n'est
      jamais coupée par un bord de la fenêtre — 20 mentions testées deux fois,
      lien poussé en bas puis en haut de fenêtre, **0 débordement** sur 40
      ouvertures.
- [x] **Ajouté après coup, sur retour de l'auteur :** le pied « Ouvrir la
      fiche → » ouvre réellement la fiche. Il était un `<span>` inerte —
      exactement le défaut que le lot 1 corrige dans le texte, réintroduit par
      la carte censée le réparer. Vérifié par un clic réel : navigation vers
      la bonne fiche en 720 ms, carte refermée.
- [x] `npm run typecheck && npm run lint && npm run test` passent (1 058 tests,
      soit les 1 044 d'avant plus 14 nouveaux sur l'extrait). `npm run build`
      aussi, deux fois — la mesure du préchargement l'exigeait.

Et, la fluidité étant la demande et non un bonus, **mesurée plutôt que jugée à
l'œil** — chiffres à relever avant/après sur le Prologue, la page la plus
chargée en mentions :

| Mesure | Cible |
|---|---|
| Survol → carte peinte | aucune requête réseau, une seule image |
| Requêtes serveur ajoutées par fiche (lot 2) | 1, dans le `Promise.all` existant |
| Poids HTML ajouté sur le Prologue | à relever ; extrait coupé à ~240 caractères côté serveur |
| Nœuds de carte dans le DOM | 1, quel que soit le nombre de mentions |
| Décalage de mise en page à l'ouverture | 0 — portail, hors du flux du paragraphe |
| Saut de la carte à l'arrivée du portrait | 0 — boîte réservée |
| Clic après survol appuyé | ~~fiche préchargée~~ — **abandonné, mesuré sans effet** (448 ms à froid / 428 ms après survol ; voir Fluidité) |

---

## V2.1-19 — La mémoïsation n'atteignait pas le wiki public · `M` — fait

### Constat

Trouvé en instruisant la fluidité de V2.1-18, pas en relisant le code. Deux
causes indépendantes, l'une invisible et l'autre visible, qui font toutes deux
payer une navigation entre deux fiches de `/partage` plus cher qu'elle ne
devrait.

**Le cache existe, il est payé, et il ne prend pas sur cette route.**
`listEntitiesForWorld` est enveloppé dans `React.cache()` depuis l'audit P-01
(`repos/entities.ts:42`), précisément parce qu'il partait deux fois par
navigation. Son commentaire pose lui-même la condition : *« Ne fonctionne que
parce que `supabase` est un objet stable par requête (`createClient` est
lui-même mémoïsé) — `cache()` compare ses arguments par identité. »*

Cette condition est vraie côté authentifié : `createClient`
(`lib/supabase/server.ts:19`) est mémoïsé. Elle est fausse côté partage :
`createShareLinkServiceClient` (`lib/supabase/service.ts`) est une fabrique
nue, et **chaque fonction de `publicShare.ts` construit la sienne** en
première ligne — `getPublicEntityTree` (`:166`), `getPublicEntityDetail`
(`:392`), `listPublicEntities` (`:145`). Un rendu de
`/partage/[token]/[entitySlug]` en appelle trois, donc trois objets
différents, donc trois clés de cache différentes.

Conséquence : **toute** mémoïsation de dépôt est inerte sur `/partage`, et
seulement là. `listEntitiesForWorld` y repart pour de vrai à chaque appel —
la liste complète des entités du monde, transférée et désérialisée deux fois
par fiche. `listCampaignsForWorld`, `walkRulesetChain` et les lectures de
visibilité sont dans le même cas. Le gain de P-01 n'a jamais atteint la seule
route que des visiteurs ouvrent vraiment.

**Et la coquille se reconstruit à chaque fiche.** `/partage` est la seule des
trois routes de wiki à rendre `BookSkin` depuis sa **page** plutôt que depuis
son layout — V2.1-12 a hissé `/apercu` et l'onglet joueur, et a laissé
celle-ci, sa garde par mot de passe devant précéder tout chargement. Chaque
navigation refait donc `getPublicEntityTree`, soit cinq requêtes, pour
reconstruire un sommaire identique.

Les symptômes sont déjà écrits, dans le commentaire de `apercu/layout.tsx` où
V2.1-12 les a consignés en les corrigeant ailleurs : la recherche du sommaire
se vide, son défilement repart de zéro, son repli scintille (lu depuis
`localStorage` dans un effet, après le premier rendu). Les trois sont encore
vivants sur `/partage` aujourd'hui. Ce n'est donc pas un ticket de chiffres :
c'est ce que voit une joueuse qui clique sur trois fiches de suite.

### Décision

Deux volets, indépendants. Le premier tient en deux lignes et rend le plus.

**Volet A — le client de partage rejoint la mémoïsation.**
`createShareLinkServiceClient` passe sous `React.cache()`, comme son
homologue authentifié. Toutes les mémoïsations de dépôt reprennent alors
effet sur `/partage`, sans qu'aucune d'elles ne soit touchée.

Deux points à réaffirmer dans le commentaire, parce qu'il s'agit du client
service-role : `cache()` de React est **borné au rendu courant**, jamais
partagé entre deux requêtes ni entre deux visiteurs — c'est déjà ce que
disent `lib/supabase/server.ts` et `repos/entities.ts`, et ça vaut d'être
répété là où la RLS est contournée. Et le client est sans état
(`persistSession: false`), donc le réemployer dans un même rendu ne
transporte rien d'un appel à l'autre. La règle ESLint qui confine le client
à `publicShare.ts` n'est pas concernée : la fabrique ne bouge pas de
`lib/supabase/service.ts` et garde son unique importateur.

**Volet B — la coquille rejoint le layout**, sur le modèle exact
d'`apercu/layout.tsx`.

Avec une correction à la raison écrite dans la page, qui n'est pas fausse mais
incomplète. Déplacer la garde dans le layout ne suffirait **pas** à empêcher la
page de charger : en rendu serveur React, layout et page s'exécutent
concurremment, et un layout qui ne rend pas ses `children` n'annule pas le
travail que la page a déjà lancé. La garde doit donc rester dans la page —
elle y reste — et le layout pose **la sienne** avant de charger l'arbre.

Ce qui rendait cette duplication coûteuse est précisément ce que le volet A
supprime : `resolveShareLink` passe sous `cache()` à son tour, et
`hasVerifiedSharePassword` ne lit qu'un cookie. Les deux gardes ne coûtent
alors qu'une seule requête pour l'ensemble du rendu. **Le volet A n'est pas
seulement un gain : c'est ce qui rend le volet B écrivable sans le payer.**

D'où l'ordre : A d'abord, mesuré seul, puis B.

### Vérification — volet A

Compteur temporaire posé **dans** le corps mémoïsé de `listEntitiesForWorld`
(donc silencieux quand le cache répond), sur la fiche Prologue du monde
`leschroniquesdesroyaumesoublies`, puis retiré.

Première tentative faussée, et la cause vaut d'être notée : mesurer **depuis le
navigateur** compte aussi les fiches que Next rend pour préparer les liens du
sommaire — une navigation produisait huit appels, dont six n'appartenaient pas
à la page mesurée. Reprise en requêtes uniques (`curl`), sans navigateur. Un
second écart, de 4, n'était que la recompilation à chaud qui suit le
changement de fichier : toute mesure prise dans les secondes qui suivent une
édition mesure le compilateur, pas le code.

| Mesure (une requête sur la même fiche) | Avant | Après |
|---|---|---|
| Exécutions réelles de `listEntitiesForWorld` | 2 | **1** |
| Confirmation sur 3 requêtes consécutives | — | 3 appels, soit 1 par rendu |

- [x] `createShareLinkServiceClient` est mémoïsé par rendu, et son commentaire
      dit pourquoi et jusqu'où.
- [x] Sur un rendu de `/partage/[token]/[entitySlug]`, `listEntitiesForWorld`
      ne part qu'une fois — vérifié par instrumentation, pas déduit.
- [x] Rendu inchangé, vérifié en navigateur sur une entrée du Livre de
      sessions et sur une fiche de personnage (titre, blocs, portrait,
      sommaire). Le seul 404 de la console est celui d'une fiche sans
      portrait, repli documenté dans `PublicPortrait.tsx` et antérieur.

### Vérification — volet B

Même compteur que pour le volet A, posé cette fois dans la construction de
l'arbre, sur le même monde et les deux mêmes navigations de fiche à fiche
(Prologue → Candide Fausset → Fine Lââm).

| Mesure | Avant | Après |
|---|---|---|
| Constructions du sommaire, deux navigations | 2 | **0** |
| Recherche du sommaire après navigation | vidée | **conservée** (« Cand », filtrage inclus) |

**Un correctif né d'une phrase écrite trop vite.** Le premier jet du
commentaire de `page.tsx` affirmait que `getPublicEntityTree` était déjà
mémoïsé par les dépôts qu'il appelle. Vérification faite avant de le
commiter : **quatre de ses cinq requêtes ne l'étaient pas**
(`listPartOfRelationsForWorld`, `listPlayerCharacterEntityIds`,
`getWorldEntityKindOrder`, `getSessionJournalTreeGroup`). L'arbre est donc
mémoïsé au niveau de l'arbre, et pas de ses morceaux. Une affirmation de
commentaire se vérifie comme une mesure.

**La garde, exercée pour de vrai.** Le lien de l'auteur n'a pas de mot de
passe : le cas a été forcé localement (`password_hash` imposé dans
`resolveShareLinkUncached`), avec un compteur sur le chargement de l'arbre ET
sur celui de la fiche. Sur deux requêtes, **zéro** de l'un comme de l'autre —
la porte s'affiche, rien d'autre ne part. C'est la justification concrète de
la double garde : sans celle de la page, le layout aurait beau refuser de
rendre ses `children`, la fiche aurait déjà été chargée.

### Critères

- [x] `BookSkin` est rendu par `app/partage/[token]/layout.tsx`, la page ne
      rendant plus que le corps de la fiche.
- [x] La garde par mot de passe reste dans la page **et** précède le
      chargement de l'arbre dans le layout. Aucun contenu, aucun sommaire, ne
      quitte le serveur avant vérification — mesuré, cas forcé, compteur à 0.
- [x] Naviguer entre deux fiches conserve la recherche du sommaire, son
      défilement et son repli.
- [x] Requêtes par navigation relevées avant et après, sur le même monde.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

---

## V2.1-20 — La navigation du wiki public, de bout en bout · `L`

### Constat

Demande de l'auteur (16 septembre), formulée depuis l'usage et non depuis le
code : « le chargement d'une page s'effectue bizarrement lorsque le fond est
paramétré autrement que celui par défaut », et « il y a un long moment entre un
clic dans le menu du wiki et l'arrivée sur la page ».

Les deux phrases décrivent deux choses différentes, et c'est le premier acquis
de ce ticket. La seconde est une attente : quelque chose met du temps. La
première est une **séquence** : ce n'est pas que le fond soit lent, c'est qu'il
arrive après la page, et que son arrivée repeint tout. Un fond par défaut ne
produit pas ce symptôme parce qu'il n'arrive jamais après — il est déjà là.

V2.1-19 a retiré le coût le plus gros de cette route (le sommaire reconstruit à
chaque fiche, et toute la mémoïsation de dépôt rendue inerte par l'identité du
client Supabase). Ce qui reste n'est pas un défaut unique qu'on corrige : c'est
une file d'attente d'une dizaine d'étapes dont aucune n'est scandaleuse prise
seule. D'où la taille `L`, et d'où la section « Mesure d'abord » : la moitié de
ce qui suit ne vaut d'être écrite que si le chronomètre la confirme.

### Ce que la lecture du code a trouvé, avant toute mesure

Lecture du chemin complet d'une navigation `/partage/[token]/[entitySlug]` — et
de son jumeau `/m/[worldSlug]/apercu/**`, qui partage la même peau et le même
service. Rien ci-dessous n'est chronométré ; c'est l'objet du lot 0.

| # | Constat | Fichier | Effet supposé |
|---|---|---|---|
| A | Aucun `loading.tsx` dans tout `app/`, aucun `useLinkStatus`, aucun état d'attente | — | Le clic ne produit **aucun signal** : l'ancienne fiche reste immobile jusqu'à la réponse du serveur. Seul point de cette liste qui n'est pas de la performance mais de la perception |
| B | Le fond n'est déclaré que par un `useEffect`, donc après l'hydratation | `WikiBackgroundProvider.tsx:120` | Le navigateur ne découvre l'URL de l'image qu'après le bundle JS ; et `--h`/`--c`/`data-mode` changent à ce moment-là, donc **toute la page bascule de couleur** une fois déjà peinte |
| C | L'image de fond part vers `/api/blocks/[id]/image` : fonction serveur, lecture, re-filtrage de visibilité, signature, puis **307** vers Storage | `app/api/blocks/[blockId]/image/route.ts:19` | Deux allers-retours avant le premier octet d'image, après tout ce qui précède |
| D | Le flou est appliqué à l'exécution, en plein écran, sur une image jusqu'à 1600 px | `app/globals.css:152`, `blockImageUpload.ts:29` | Coût de peinture à l'instant exact où la page vient d'apparaître |
| E | `getPublicEntityDetail` enchaîne au moins **sept vagues séquentielles** de requêtes | `publicShare.ts:449` | Détail ci-dessous |
| F | Deux de ces vagues — `getCalendar` et `listEntitiesForWorld` — ne dépendent que de `worldId`, connu dès la première | `publicShare.ts:604`, `publicShare.ts:628` | Elles sont séquentielles par ordre d'écriture, pas par dépendance |
| G | `listEntitiesForWorld` est bien mémoïsé, mais le layout ne rejoue pas lors d'une navigation client : la mémoïsation de V2.1-19 ne joue qu'au **premier** chargement | `repos/entities.ts:42` | Le gain mesuré en V2.1-19 ne couvre pas le geste dont l'auteur se plaint |
| H | `resolveRuleRefPreviews` est lui-même une chaîne séquentielle : ruleset par défaut, remontée de chaîne, puis **une requête par maillon** en boucle, puis **une requête par clé maison restante** en boucle | `refPreview.ts:142` | Sur un monde à ruleset personnel hérité, peut à lui seul ajouter plusieurs allers-retours — sur le chemin critique de toute fiche qui cite une règle |
| I | Le middleware appelle `auth.getUser()` sur `/partage/*`, y compris sur les requêtes RSC d'un clic | `lib/supabase/middleware.ts:30` | Sans effet pour un visiteur anonyme (pas de cookie, pas d'appel réseau) — mais **l'auteur qui teste son propre lien est connecté**, donc c'est exactement la situation où la lenteur est constatée |
| J | `app/layout.tsx` refait un `getAuthUser()` juste après le middleware, plus le profil et le fond d'écran de l'application | `app/layout.tsx:55` | Inutile sur une page publique. Premier chargement seulement : le layout racine ne rejoue pas au clic |
| K | `/partage/[token]` charge sommaire et nom de campagne **puis** redirige vers le dernier Livre de sessions | `app/partage/[token]/page.tsx:41` | L'entrée dans un lien de partage rend le layout deux fois |
| L | `<img>` de portrait sans `width`/`height` | `PublicPortrait.tsx:37` | Décalage de mise en page pendant le chargement, qui se lit comme de la lenteur |
| M | Le paquet client de la route pèse **227 ko non compressés** (mesuré sur le build présent dans `.next` : modules client de la route et leurs entrées) | — | Raisonnable. `dnd-kit` y entre inutilement via `EntityTree` alors que `editable` est faux sur le wiki public, mais **ce n'est pas là qu'est le problème** — même conclusion que V3-R5 |

Le détail du point E, en **vagues** (un `Promise.all` = une vague), pour une
fiche ordinaire avec du texte et un fond :

| Vague | Appel | Dépend réellement de |
|---|---|---|
| 1 | `resolve_share_link` (RPC) | le jeton |
| 2 | `getEntityBySlug` | `worldId` |
| 3 | blocs + relations + portrait + campagne | `entity.id` |
| 4 | `getBackgroundMetaForBlock` | la liste des blocs |
| 5 | `getCalendar` | **`worldId` seul** |
| 6 | `listEntitiesForWorld` | **`worldId` seul** |
| 7 | extraits d'entités + aperçus de règles | les blocs `text` |

### Mesure d'abord

Demande explicite de l'auteur, et bonne demande : deux causes très différentes
produisent la même phrase. Si le rendu prend 800 ms, il faut le raccourcir ; si
le rendu prend 300 ms et que rien ne bouge à l'écran pendant ce temps, il faut
un `loading.tsx` et le reste ne se verra pas. Les remèdes n'ont rien à voir, et
la liste ci-dessus en propose autant des deux côtés.

Trois choses à chiffrer, dans cet ordre :

1. **Combien d'allers-retours Supabase par navigation, et lequel coûte.**
   Compté au plus près : une enveloppe temporaire autour de `fetch` pendant un
   rendu de `getPublicEntityDetail`, sur un vrai monde et un vrai jeton. C'est
   ce qui départage les points E, F et H — H reste une hypothèse tant qu'on n'a
   pas vu la longueur réelle de la chaîne de rulesets du monde mesuré.
2. **Le temps jusqu'au premier octet de la réponse RSC d'un clic**, en
   production. V2.1-18 a déjà relevé **448 ms à froid** sur cette route ; c'est
   le point de départ, et il date d'avant V2.1-19.
3. **La chronologie du fond** : instant où le HTML est peint, instant où la
   requête d'image part, instant où le fond apparaît. C'est la mesure qui
   valide ou tue le point B, le seul symptôme que l'auteur décrit précisément.

Sans ces trois chiffres, l'ordre des lots ci-dessous est une conjecture.

### Lot 0 — relevé 1 : les allers-retours d'une navigation

Fait le 16 septembre, sur **Faerûn (`valdoria`)**, 33 fiches publiques, chaîne
de rulesets à deux maillons (`DnD 2024` → `SRD 5.2.1 (2024)`). Sonde
temporaire : une enveloppe autour de `fetch` pendant un appel réel de
`getPublicEntityTree` puis de `getPublicEntityDetail`, contre la vraie base.
Supprimée après la mesure — aucune trace laissée dans le dépôt.

| Geste mesuré | Allers-retours | **Vagues** | Total |
|---|---|---|---|
| Layout : `resolveShareLink` + `getPublicEntityTree` | 7 | 2 | 248 ms |
| Fiche « Prologue » — 4 blocs, avec fond | **18** | **11** | **940 ms** |
| Fiche « Clan Oorvarsh » — 1 bloc, sans fond | 8 | 4 | 318 ms |

Chaque aller-retour coûte entre 51 et 111 ms, médiane ≈ 68 ms. **Le temps de
rendu est le nombre de vagues multiplié par la latence**, et rien d'autre :
11 × 68 ≈ 750 ms des 940 mesurées. L'hypothèse du point E est donc confirmée,
et elle est la seule qui compte — les dix autres constats ne pèsent qu'à
travers elle.

**Deux précautions de lecture, toutes deux vérifiées.**

*Les millisecondes sont celles du poste de l'auteur, pas celles de Vercel.* La
latence vers Supabase y est plus élevée qu'entre `dub1` et la base. Le chiffre
portable est le **nombre de vagues** ; l'ancre de production reste les 448 ms
de premier octet relevées en V2.1-18, cohérentes avec 11 vagues à ~30 ms.

*`React.cache()` est inerte hors d'un rendu React* — vérifié explicitement :
deux appels successifs à `createShareLinkServiceClient()` rendent deux objets
différents dans la sonde, donc deux `listEntitiesForWorld` identiques font deux
requêtes. **Cela ne fausse pourtant pas ce relevé**, et c'est le second
résultat de la mesure : aucune des 18 requêtes du Prologue n'aurait été
déduplíquée en production lors d'une navigation client, parce que
`repos/worlds.ts` ne porte **aucune** mémoïsation et que `listEntitiesForWorld`
n'est appelé qu'une fois dans ce chemin. Le relevé est fidèle au geste dont
l'auteur se plaint. Il ne l'est pas pour un premier chargement complet, où le
layout aurait déjà chargé la liste des entités.

#### Où passent les 940 ms du Prologue

| Vagues | Ce qui s'y passe | Coût | Part |
|---|---|---|---|
| 1 → 4 | jeton, fiche, blocs/relations/portrait/campagne, méta du fond | ~300 ms | 32 % |
| **5** | `getCalendar` — **ne dépend que de `worldId`** | 65 ms | 7 % |
| **6** | `listEntitiesForWorld` — **ne dépend que de `worldId`** | 93 ms | 10 % |
| **7 → 11** | **résolution des règles citées** (deux clés : `dwarf`, `halfling`) | **~390 ms** | **41 %** |

**Le point H était l'hypothèse la plus incertaine du ticket. C'est la plus
grosse.** Cinq vagues séquentielles pour deux clés de règle :
`getWorldDefaultRulesetId`, puis la remontée de chaîne **un maillon par vague**
(`walkRulesetChain`), puis l'interrogation des entrées **un maillon par vague**
(`listRulesetEntryChipsByKeys` en boucle), puis blocs et traductions. Deux
maillons produisent quatre vagues là où deux suffiraient : la remontée de
chaîne est séquentielle par nature, l'interrogation des entrées ne l'est pas —
c'est une boucle qui pourrait être une requête `ruleset_id=in.(…)`.

**Quarante et un pour cent du temps de chargement d'une fiche sert à préparer
des bulles que personne n'a encore survolées.** La question de l'auteur sur le
chargement différé n'était donc pas un détail de confort : c'est le premier
poste de dépense de la page.

#### Trouvé en mesurant, pas en lisant

**La même ligne `worlds` est lue plusieurs fois, dans des vagues différentes.**
Quatre fonctions de `repos/worlds.ts` lisent chacune la ligne du monde avec un
`select` différent — `getWorldById`, `getWorldEntityKindOrder`,
`getWorldCalendar` (vague 5), `getWorldDefaultRulesetId` (vague 7) — et
**aucune n'est mémoïsée**. Sur le Prologue, deux d'entre elles partent, à deux
moments séparés par 150 ms. V2.1-19 avait rendu la mémoïsation de dépôt
effective sur `/partage` ; il reste à la poser là où elle manque.

### Lot 0 — relevé 2 : le fond de page

L'image de fond du Prologue, telle qu'elle est réellement servie :

| | |
|---|---|
| Format | WebP, 1600 × 900 |
| Poids | **356 ko** |
| Flou demandé | 10 px |
| Fondu | 600 ms |
| Chemin | `/api/blocks/…/image?v=1` → fonction serveur → **307** → URL signée Storage |

Le flou vaut 10 px : à cette intensité, l'image n'a besoin ni de ses 1600 px ni
de ses 356 ko. Une version réduite et **déjà floutée** produirait la même
apparence pour quelques kilo-octets, et supprimerait en plus le coût de
peinture du `filter: blur()` plein écran. Le lot 2 reste donc entier, et sa
partie la moins chère à écrire est aussi la plus rentable.


### Lot 0 — relevé 3 : en navigateur, sur un vrai build de production

`next build` puis `next start` — jamais `next dev`, pour la raison établie en
V2.1-18 : Next **désactive le préchargement en développement**, et c'est
précisément ce qu'il fallait observer. Une configuration `creadonjon-prod` a
été ajoutée à `.claude/launch.json` pour que ce relevé soit rejouable.

Serveur local, base distante : les millisecondes restent celles du poste de
l'auteur, pas celles de Vercel.

#### Ce que coûte une fiche, médiane sur cinq appels à chaud

| Fiche | Réponse RSC |
|---|---|
| **« Prologue »** — fond + deux règles citées | **731 ms** |
| « Clan Oorvarsh » — un bloc | 215 ms |
| Fiche moyenne (`/13`) | 229 ms |
| Racine du lien de partage | 203 ms |

**Une fiche ordinaire coûte 215 ms ; celle qui porte un fond et cite deux
règles en coûte 731.** Le facteur est de 3,4, et il tient entièrement aux
vagues 5 à 11 du relevé 1. Ce n'est donc pas « le wiki qui est lent » : ce sont
deux fonctionnalités précises qui coûtent trois fois le prix de la page.

#### Chronologie du fond de page

| Instant | Événement |
|---|---|
| 936 ms | HTML entièrement reçu — la page est lisible |
| 993 ms | dernier module JS reçu |
| **1263 ms** | **la requête de l'image de fond part enfin** |
| 1402 ms | image reçue (après la redirection 307) |
| ~2000 ms | fin du fondu de 600 ms |

**Le fond commence à être demandé 327 ms après que la page soit lisible, et
finit d'apparaître une seconde plus tard.** Le point B est confirmé, et le
symptôme décrit par l'auteur est exactement cette séquence : la page s'affiche,
puis quelque chose arrive par-dessus et la repeint. Avec un fond par défaut, il
n'y a rien à attendre — d'où la différence qu'il constate.

À noter, trouvé en mesurant : le `<div>` de fond n'est monté qu'après un
`requestAnimationFrame`, qui **ne s'exécute pas dans un onglet caché**. Une
fiche ouverte dans un onglet d'arrière-plan n'a donc simplement pas de fond
tant qu'on n'y revient pas. Sans conséquence visible (personne ne regarde un
onglet caché), mais c'est la preuve que le fond dépend du cycle de rendu du
navigateur et non du document.

#### Ce que la mesure a démenti : le préchargement existe, et il ne sert à rien

**Charger UNE fiche déclenche 21 requêtes de préchargement `?_rsc=`** — huit
fiches et la racine du lien, **chacune demandée deux fois**.

C'est l'inverse de ce que la lecture du code laissait croire. `V3-R5` a bien
coupé le préchargement, mais **seulement sur `EntityTree`**. Les liens du
**corps** de la fiche n'ont jamais été couverts : `PublicBlockView.tsx:106`
(mention d'entité), `:123` (mention de règle), `:414` (référence de quête) et
`MentionedIn.tsx:53` (« mentionné dans ») rendent tous un `<Link>` **sans
`prefetch={false}`**, donc au réglage par défaut. La seconde volée s'explique
par `MentionedIn`, qui va chercher sa liste côté client
(`/api/entities/<id>/mentions`, 1126 → 1197 ms) et fait entrer de nouveaux
liens dans le champ de vision une fois la page déjà chargée.

Mesuré séparément, un préchargement rend **21 octets en 15 à 59 ms**, contre
25 ko en 220 ms pour la vraie navigation. Autrement dit : **Next ne prépare
rien.** Sans `loading.tsx`, il n'a aucune frontière à préparer — même constat
que V2.1-18, atteint cette fois par l'autre bout. Vingt et une requêtes, vingt
et une exécutions de middleware, 441 octets utiles.

Deux conséquences pour les lots :

1. Ces 21 requêtes sont **gratuites pour le lecteur** (elles ne bloquent rien)
   mais **pas pour Vercel** : ce sont 21 invocations de fonction par page
   ouverte. C'est le même gaspillage que V3-R5 a corrigé sur le sommaire,
   resté entier sur le corps.
2. Elles deviennent **utiles** dès que le lot 1 existe : avec un `loading.tsx`,
   un préchargement rapporte le squelette de la route au lieu de 21 octets, et
   la navigation part d'un état déjà peint. Le lot 1 ne se contente donc pas de
   masquer l'attente — il rend au préchargement le travail qu'on lui demandait
   déjà sans le savoir. **À vérifier une fois le lot 1 écrit**, pas à supposer :
   c'est exactement le genre d'affirmation que V2.1-18 a vu s'effondrer sous un
   chronomètre.

### Décision — lots ordonnés

**Lot 0 — mesurer.** Les trois relevés ci-dessus, écrits dans ce ticket avant
le premier correctif. Aucun code livré, aucune enveloppe de mesure conservée.

**Lot 1 — le clic répond tout de suite.** Un `loading.tsx` par route de wiki :
la coquille et le sommaire restent (ils vivent dans le layout depuis V2.1-12 et
V2.1-19), seule la colonne de lecture passe en squelette. Et le lien cliqué
prend son état actif immédiatement, via `useLinkStatus` (React 19.2, présent).
Ne raccourcit pas une milliseconde de rendu : supprime la sensation de blocage,
qui est la plainte réelle. **Autonome, et le meilleur rapport gain/risque du
ticket.**

**Lot 2 — le fond cesse d'arriver après la page.** Trois changements qui vont
ensemble :

- le fond est déclaré **côté serveur** (le HTML porte l'URL et les jetons de
  teinte), plus par un effet après hydratation. Supprime du même coup le
  basculement de couleur de la page déjà peinte ;
- une version **pré-floutée et réduite** est produite à l'envoi, comme la
  teinte dominante l'est déjà (`blockImageUpload.ts` appelle déjà `sharp`) : le
  flou est fixe, l'image est floutée de toute façon, donc la stocker floutée
  supprime à la fois le poids et le coût de peinture ;
- la redirection signée est gardée en cache plus longtemps pour ce cas — 240 s
  (`storage.ts:53`) est court pour une image de fond qui ne change jamais.

Le fondu de sortie de V2-G13 doit survivre : il est la raison d'être du
fournisseur, et rendre le fond côté serveur ne doit pas le reprendre.

**Lot 2.1 — le fond passe côté serveur.** Né du lot 2, qui a livré le chemin de
livraison et le préchargement mais laissé les jetons de teinte au client. Section
dédiée plus bas : quatre voies instruites, la première retenue par l'auteur (le
middleware pose la fiche courante en en-tête, le layout la lit). **Avant le lot
3** — il extrait `getPublicWikiBackground` de `getPublicEntityDetail`, qui est
la fonction que le lot 3 réorganise. Il pose aussi une condition sur le lot 4.

**Lot 3 — aplatir les vagues.** Points F et G : lancer `getCalendar` et
`listEntitiesForWorld` dès que `worldId` est connu, quitte à faire parfois une
requête pour rien. Deux vagues en moins sur le chemin critique, correctif local
à `publicShare.ts`. Le point H ne se traite qu'en fonction de ce que le lot 0
montre.

**Lot 4 — `/partage/*` sort du mur d'authentification.** Point I. Le jeton fait
foi sur cette route, la session n'y sert à rien. Attention : `updateSession`
fait deux choses, le rafraîchissement du cookie et la garde `/login`. Seule la
seconde est inutile ici, et la première n'a aucune raison de partir sur le
réseau pour un visiteur qui n'a pas de session. À écrire comme un
court-circuit avant l'appel, jamais comme un trou dans la garde.

**Reformulé par le lot 2.1, et ce n'est plus une nuance de rédaction.** Le
middleware **continue de s'exécuter** sur `/partage/*` ; ce qu'on supprime est
l'appel réseau `auth.getUser()`, jamais le passage. Depuis le lot 2.1, c'est ce
middleware qui pose l'en-tête dont le layout tire la fiche courante : retirer
`/partage` du `matcher` — le raccourci qui vient naturellement à l'esprit en
lisant le titre de ce lot — ferait retomber le fond au comportement d'avant,
sans erreur et sans test rouge. Le critère de rendu serveur du lot 2.1 est
précisément là pour que ce raccourci se fasse voir.

**Chiffré, enfin** (16 septembre, après le lot 3). Le point I était écrit sans
mesure : « sans effet pour un visiteur anonyme, mais l'auteur qui teste son
propre lien est connecté ». Les deux moitiés sont maintenant vérifiées, depuis
le même client, sur la même fiche, requêtes entrelacées pour qu'une dérive
machine touche les deux séries pareil :

| Même URL, même client | Médiane sur 9 |
|---|---|
| sans cookie de session (une joueuse) | **229 ms** |
| avec cookie de session (l'auteur) | **295 ms** |

**+66 ms**, soit exactement un aller-retour au tarif mesuré, et les deux
distributions ne se recouvrent pas (221–258 contre 276–314). L'hypothèse était
juste dans les deux sens : `auth.getUser()` ne part sur le réseau que s'il y a
un cookie, et il coûte une vague entière quand il part.

**Ce que ça dit de la valeur du lot.** Le public d'un lien de partage est
anonyme : les joueuses ne paient rien, et ce lot ne leur rendra rien. Il ne
profite qu'à **l'auteur qui vérifie son propre lien** — 295 → 229 ms, soit 22 %
sur une fiche ordinaire. Ce n'est pas rien : c'est précisément sa situation
quand il a signalé « un long moment entre le clic et l'arrivée ». Mais ce n'est
pas la fluidité du wiki pour ses lectrices.

**Et une contrepartie, trouvée en instruisant le lot.** Le commentaire de
`updateSession` le dit déjà : « Touching auth.getUser() here is what actually
refreshes the session cookie on every request; without it, tokens silently
expire mid-session. » Cet appel fait donc DEUX choses, et seule la garde
`/login` est inutile sur `/partage` — le rafraîchissement, lui, ne l'est pas.
Le sauter là revient à accepter qu'une session ne se rafraîchisse pas tant
qu'on reste sur un lien de partage. Un auteur qui y passerait plus d'une heure
sans toucher au reste de l'application se retrouverait déconnecté ailleurs.

Il n'y a pas de troisième voie : `getSession()` ne valide rien et ne
rafraîchit pas, et un rafraîchissement en arrière-plan ne pourrait pas reposer
ses cookies sur la réponse.

**Conséquence sur l'ordre** : ce lot passe derrière le lot 5, qui vaut 41 % pour
tout le monde. Et sa question n'est plus « comment » mais « est-ce qu'on
échange 66 ms de confort de vérification contre une session qui ne se
rafraîchit plus sur `/partage` » — un arbitrage d'auteur, pas une optimisation
évidente.

**Livré.** Arbitrage tranché par l'auteur en connaissance de la contrepartie.

`updateSession` sort **avant de construire le client Supabase** quand le chemin
commence par `/partage/`. Construire le client ne coûte rien ; c'est
`getUser()` qui part sur le réseau, et il n'y a aucune raison d'arriver
jusqu'à lui sur une route dont le jeton fait foi.

Le middleware, lui, **continue de s'exécuter** — il le doit, c'est lui qui pose
l'en-tête de chemin dont le fond de page dépend depuis le lot 2.1. La
reformulation écrite plus haut n'était donc pas une précaution de style : elle
est ce qui rend ce lot compatible avec le précédent.

| Même URL, même client | Avant | **Après** |
|---|---|---|
| sans cookie de session (une joueuse) | 229 ms | 228 ms |
| avec cookie de session (l'auteur) | 295 ms | **227 ms** |
| écart | +66 ms | **−1 ms** |

L'auteur paie désormais exactement ce que paie une lectrice.

#### Ce que ça garde

`lib/supabase/middleware.test.ts`, six tests, `@supabase/ssr` simulé — ce
fichier ne parle à aucune base. Ce qu'il observe, c'est si le middleware
**cherche** à construire un client.

Les deux défauts que ce lot pouvait créer sont muets, d'où deux familles
d'assertions :

- sur `/partage`, aucun client n'est construit — y compris **avec** un cookie de
  session, qui est précisément le cas qui coûtait 66 ms. Vérifié que ces deux
  tests tombent quand on retire le court-circuit ;
- ailleurs, le client est toujours construit : route authentifiée, image de
  bloc (que `/partage` embarque pourtant, mais dont le chemin n'est pas
  `/partage/*` et dont la route a besoin de savoir qui lit), et un chemin qui
  commence par les mêmes lettres sans être un lien de partage.

`path.startsWith("/partage/")` reste aussi dans `isPublicPage`, devenu
redondant. Gardé volontairement : cette ligne dit ce que la route EST, et si le
court-circuit disparaissait un jour, son retrait silencieux derrière lui
renverrait les visiteurs vers `/login`.

#### Vérifié que le lot 2.1 n'a pas été cassé au passage

C'était le risque réel de ce lot, et il ne se serait pas vu tout seul : le HTML
servi de la fiche porte toujours `wiki-bg-scope`, `data-mode` et
`--h:90;--c:1.03e-8`, et la div de fond avec. Une session ouverte reste valable
sur les routes authentifiées (200, aucune redirection vers `/login`).

#### Ce qu'on a accepté de perdre

Une session ne se rafraîchit plus tant qu'on reste sur un lien de partage.
Passer plus d'une heure à lire son propre wiki sans toucher au reste de
l'application déconnecte ailleurs. Écrit dans le code, au-dessus de
`estUnLienDePartage`, pour que personne n'ait à redécouvrir pourquoi.

**Lot 5 — les bulles se chargent pendant la lecture.** Voir la section dédiée
ci-dessous : c'est une question de l'auteur, elle a une bonne réponse, et elle
a un piège.

**Lot 6 — les 21 préchargements du corps, une fois le lot 1 posé.** Né du
relevé 3, et volontairement placé APRÈS le lot 1 parce que sa bonne réponse en
dépend. Deux issues, et la mesure tranchera :

- si un `loading.tsx` rend le préchargement utile (le squelette arrive avant le
  clic), les liens du corps restent au réglage par défaut et le ticket n'a rien
  à écrire ;
- s'il reste creux, les quatre endroits concernés (`PublicBlockView.tsx:106`,
  `:123`, `:414`, `MentionedIn.tsx:53`) prennent `prefetch={false}` comme
  `EntityTree` en V3-R5, et le commentaire de V3-R5 est complété pour dire ce
  qu'il ne couvrait pas.

Dans les deux cas, le nombre de requêtes par page ouverte est recompté.

**Livré.** L'A/B que ce lot attendait a tranché : le préchargement ne rapporte
rien, il est coupé partout.

#### L'A/B, sur la même page et le même build

| Cible | Squelette après le clic |
|---|---|
| `/22`, **préchargée** (lien du corps) | 18 ms |
| `/38`, **jamais préchargée** (lien du sommaire) | 20 ms |

Deux millisecondes. Next rend la frontière de chargement sans avoir besoin du
paquet préchargé — c'est le routeur client qui sait qu'il y a un `loading.tsx`,
pas le serveur.

Et le contenu ne va pas mieux : sur `/38`, non préchargée, le clic arrive au
contenu en 443 ms pour un rendu serveur brut mesuré à 452 ms. **Une navigation
coûte exactement son temps serveur.** `staleTimes.dynamic` valant 0, la partie
dynamique d'une route préchargée est écartée aussitôt — déjà mesuré en V2.1-18,
confirmé ici par l'autre bout.

#### La prédiction du relevé 3 était fausse, et c'est la deuxième fois

Le relevé 3 avançait que le lot 1 « rendrait au préchargement le travail qu'on
lui demandait ». Le lot 1 avait déjà corrigé cette phrase à moitié : Next
préparait bien quelque chose, mais sans accélérer quoi que ce soit. L'A/B la
corrige entièrement. **Rien de ce que le préchargement rapportait n'était
réutilisé.**

#### Ce que V3-R5 ne couvrait pas

Sept endroits, pas quatre — les trois derniers trouvés en recomptant après coup,
parce que le Prologue n'a ni relations ni réseau et les cachait :

`PublicBlockView` (mention d'entité, lien de règle, référence de quête),
`MentionedIn`, le titre de `BookSkin`, `PublicRelations`,
`PublicRelationshipBlock`, `FamilyTreeCard`, `RelationsGraphCanvas`.

Le commentaire de V3-R5 dans `EntityTree` est complété : il ne parlait que du
sommaire, et se laissait lire comme s'il couvrait tout.

`MentionedIn` méritait sa propre note : sa liste arrive par un `fetch` **après**
l'hydratation, si bien que ses liens entraient dans le champ de vision une fois
la page déjà chargée et déclenchaient une **seconde** volée, distincte de la
première.

#### Recompte

| | Avant | **Après** |
|---|---|---|
| Requêtes `?_rsc=` à l'ouverture du Prologue | 18 | **0** |
| Sur une fiche de PJ (relations, réseau) | 9 de plus | **0** |

Onglet visible, neuf liens dans le champ de vision, aucun clic émis :
l'`IntersectionObserver` de Next les a bien vus et n'a rien déclenché.

#### Un piège de mesure, corrigé en route

Un premier recompte annonçait « 6 préchargements restants » après six
navigations. C'étaient **les six navigations elles-mêmes** : Next demande la
charge RSC d'une navigation client avec `?_rsc=` dans l'URL, exactement comme un
préchargement. Le filtre attrapait les deux.

Ils se distinguent à la taille — 0,2 à 1,3 ko pour un préchargement, 8 à 12 ko
pour une navigation — mais le compte propre se prend **sans cliquer**. C'est le
troisième instrument de ce ticket à se révéler faux après coup, et le troisième
à ne l'avoir été que sur un détail de méthode.

#### Ce qui reste vrai

Le temps jusqu'au squelette reste sous le critère du lot 1 : médiane 34 ms sur
six navigations enchaînées (24–43 ms), contre les 100 ms exigés. Rien n'a été
perdu en coupant.


Les points J, K, L et M sont consignés et **non retenus** : J et K ne touchent
que le premier chargement, L est un défaut d'affichage sans coût réseau, M est
mesuré et n'est pas le problème. Écrits ici pour qu'on n'ait pas à les
retrouver.

### Lot 1 — livré

Trois `loading.tsx` (un par segment `[entitySlug]` des trois routes de wiki),
un squelette commun `components/entities/public/WikiFicheSkeleton.tsx`, et
l'état d'attente du lien cliqué dans `EntityTree`.

Ce sont les **premiers `loading.tsx` de l'application**. `CHARTE-UI.md` §5 les
comptait à zéro et en faisait le F-01 du rapport d'audit ; le rattrapage de
l'existant reste un chantier à part, mais la règle des quatre états s'applique
désormais à l'écran le plus visité du dépôt.

**Ce que le squelette esquisse, et ce qu'il n'esquisse pas.** Le titre (à la
hauteur exacte d'`.entity-title`, 36 px — vérifié en place), l'étiquette de
genre poussée à droite, puis des lignes de prose de largeurs irrégulières. Pas
de portrait : seules certaines fiches en ont un, et en promettre un qui
disparaît ensuite déplacerait tout le texte au moment de l'arrivée. On
n'esquisse que ce que TOUTE fiche possède.

**Le signal du lien cliqué ne pouvait pas être le fond.** `hover:bg-panel-raised`
le pose déjà : cliquer une ligne survolée n'aurait donc rien changé à l'écran,
précisément dans le cas le plus courant. Il porte sur la couleur du texte
(`text-accent`, celle de la ligne active — ce que cette ligne est sur le point
de devenir) et sur le pouls. Aucun nœud ajouté, aucune largeur modifiée : la
ligne ne bouge pas. `useLinkStatus` se lit depuis un descendant du `<Link>`,
d'où le petit composant `NomDuLien` plutôt qu'un calcul dans `NodeRow`.

Inoffensif dans la coquille d'édition, où le même arbre est monté sans
`hrefBase` : le clic y ouvre une fenêtre et appelle `preventDefault()`
(ADR-0006), donc aucune navigation ne démarre et `pending` y reste faux. Rien à
conditionner.

#### Vérification

Sur un build de production (`creadonjon-prod`), monde Faerûn, mêmes fiches
qu'au lot 0.

| | |
|---|---|
| Squelette visible après le clic | **43 ms** et **52 ms** (deux mesures) |
| Durée d'affichage avant la fiche | 594 ms |
| Coût serveur, Prologue | 750 ms (lot 0 : 731) |
| Coût serveur, Clan Oorvarsh | 216 ms (lot 0 : 215) |
| Coût serveur, fiche `/13` | 215 ms (lot 0 : 229) |

**Le lot 1 ne coûte rien au serveur** — les trois écarts sont dans le bruit de
mesure. C'était attendu : une frontière de chargement ne rend que du balisage
statique.

Les deux mesures de 43 et 52 ms ont été prises sur des liens du **sommaire**,
qui portent `prefetch={false}` depuis V3-R5 et ne sont donc jamais préchargés.
Le point qui suit en dépend.

Les quatre modes vérifiés en place (`dark`, `dim`, `soft`, `light`) : la
hiérarchie titre/prose reste lisible dans les quatre, et les barres suivent la
teinte du fond de la fiche courante, pas celle de l'application — elles héritent
de `.wiki-bg-scope` comme tout le reste de la colonne. Le sommaire, lui, ne
bouge pas : il vit dans le `layout.tsx` depuis V2.1-12/19, et c'est cette
propriété qui rend ce lot possible.

Mesuré sur `/partage` seulement. `/apercu` et l'onglet Wiki joueur rendent le
même composant depuis la même structure de layout, mais les chronométrer
demanderait une session authentifiée dans le navigateur de mesure — non fait,
et écrit ici plutôt que supposé.

#### Ce que le lot 1 a changé au préchargement, et ce qu'il n'a pas changé

Le relevé 3 avançait une prédiction : « le lot 1 rend au préchargement le
travail qu'on lui demandait déjà sans le savoir ». **Elle n'est vraie qu'à
moitié, et la moitié fausse est celle qui comptait.**

| | Avant le lot 1 | Après |
|---|---|---|
| Requêtes `?_rsc=` par page ouverte | 21 | 18 |
| Charge rapportée | 21 octets chacune | 0,2 à 1,3 ko, 13,3 ko au total |
| Durée médiane | ~35 ms | 64 ms |

Next prépare donc bien quelque chose maintenant — la frontière de chargement,
là où il ne rapportait rien. Mais **ce quelque chose n'accélère rien de
mesurable** : le squelette apparaît en 43 ms sur un lien de sommaire qui n'est
jamais préchargé, et `staleTimes.dynamic` valant toujours 0, la partie dynamique
d'une route préchargée reste écartée aussitôt (V2.1-18). Les 18 requêtes coûtent
désormais deux fois plus cher qu'avant pour le même bénéfice : aucun.

Le **lot 6** penche donc vers la coupure. L'A/B décisif — temps jusqu'au
squelette sur une cible préchargée contre une cible qui ne l'est pas — reste à
faire au moment de l'écrire ; c'est exactement le genre d'affirmation que
V2.1-18 a vu s'effondrer sous un chronomètre, et celle-ci vient déjà d'être
corrigée une fois.

### Lot 2 — le chemin du fond était coupé, pas lent

**Ce lot devait rendre le fond plus rapide. En mesurant son chemin de bout en
bout, on a trouvé qu'il n'arrivait jamais.**

`/api/blocks/[blockId]/image` — la route qui sert les images de bloc, et donc
l'image de fond du wiki — répondait **307 vers `/login`** à toute requête sans
session. Sur une page `/partage`, un visiteur anonyme n'avait donc ni fond de
page, ni aucune image dans le corps des fiches. Le lecteur ne voyait pas une
page lente : il voyait une page amputée.

Personne ne l'avait vu parce que **l'auteur est connecté quand il vérifie son
propre lien**. C'est exactement ce que dit son retour, relu après coup : « le
chargement s'effectue bizarrement lorsque le fond est paramétré autrement que
celui par défaut ». Il décrivait la lenteur qu'il voyait, lui ; ses joueuses,
elles, ne voyaient rien du tout.

#### Deux défauts empilés, le second caché par le premier

**1. Le middleware.** `/api/blocks/[id]/image` n'était pas sur la liste des
chemins publics de `lib/supabase/middleware.ts`. C'est la **troisième
occurrence du même défaut** : le commentaire de ce fichier raconte déjà les
deux précédentes (`/api/assets/`, puis `/api/entities/[id]/portrait`), trouvées
chacune en testant un lien de partage avec un vrai client sans session. La
route ajoutée ensuite par V2-G12/V2-L1 n'a pas été ajoutée à la liste, et rien
ne pouvait le signaler — aucun test n'exerçait ce chemin, et la page HTML, elle,
se chargeait très bien.

**2. La signature.** Le middleware corrigé, la route répondait **404**. Elle
résolvait correctement l'identifiant de l'asset avec le client service-role
(`getPublicBlockImageAssetId`, qui revalide `filterBlocks` avec un viewer
anonyme), puis signait l'URL avec le client de la **requête** — anonyme. Or la
RLS `assets_select` (migration `20260902110001`) ne laisse l'anonyme lire une
ligne `assets` que si elle porte `visibility_level = 'public'`, et une image de
bloc est téléversée en `players` (`blockImageUpload.ts`). La lecture échouait
donc systématiquement.

Ce second défaut était **inatteignable** tant que le premier existait. Les deux
sont tombés ensemble, et c'est la seule raison pour laquelle le premier n'a pas
été livré seul en croyant la chose réglée.

#### Une fuite refermée en même temps

Rendre cette route atteignable, c'est rendre atteignable ce qu'elle décide. Or
elle ne regardait que la visibilité du **bloc** — jamais celle de la **fiche**.
`is_public` bascule la fiche entière (V2), et `getPublicEntityDetail` pose bien
ce test avant de rendre quoi que ce soit ; il manquait ici. L'image d'un bloc
public posé sur une fiche **masquée** se serait donc servie à qui connaît
l'identifiant du bloc.

Sans conséquence jusqu'à aujourd'hui, puisque personne ne pouvait atteindre la
route. Ajouté dans le même lot, jamais après.

#### Ce qui garde tout cela, maintenant

Trois tests dans `publicShare.integration.test.ts` — le fichier qui existe
précisément pour ça (V1 D-01 : « le filtrage applicatif est la seule barrière
une fois le jeton résolu »). Un témoin et deux refus :

- l'image d'un bloc public sur une fiche publique **est** servie ;
- l'image d'un bloc `gm` ne l'est jamais ;
- l'image d'un bloc public posé sur une fiche **masquée** ne l'est jamais.

Le témoin n'est pas décoratif : sans lui, les deux refus passeraient aussi bien
si la fonction refusait tout.

**Vérifié que ces tests peuvent tomber.** La garde `is_public` retirée à la
main, le troisième échoue avec le bon message (`expected 'debe7464-…' to be
null`) — il rendait bien l'asset d'une fiche masquée. Un test de fuite qu'on
n'a pas vu échouer ne garde rien.

`getPublicBlockImageAssetId` (la décision) est séparé de
`getPublicBlockImageSignedUrl` (la signature) pour cette raison seule : la
décision se vérifie sans qu'aucun fichier n'existe dans le stockage.

#### Le préchargement de l'image, lui, était bien le sujet prévu

`WikiBackgroundPreload` — composant **serveur**, c'est tout son intérêt. Le fond
reste déclaré par `WikiBackgroundRegistrar`, qui est client et ne peut agir
qu'après l'hydratation ; le navigateur ne découvrait donc l'URL de l'image
qu'à ce moment-là. Un `<link rel="preload">` posé dans le HTML la lui annonce
dès le `<head>`.

| | Lot 0 | Après |
|---|---|---|
| La requête de l'image part | **327 ms après** la fin du HTML | **11 ms avant** |

Rien d'autre ne change : la div, le fondu d'entrée et le fondu de sortie de
V2-G13 restent entièrement au fournisseur. Le téléchargement commence plus tôt,
voilà tout. Pas de `fetchPriority: "high"` : à cet instant le navigateur
télécharge encore le JS de la page, et passer devant lui retarderait
l'hydratation pour gagner sur une image d'ambiance.

#### Ce que ce lot ne fait pas, et pourquoi

Deux des trois changements annoncés ne sont **pas** livrés. Ils ne sont pas
oubliés : chacun engage une décision qui dépasse le lot.

**La version pré-floutée et réduite.** L'image mesurée fait 1600 × 900 et
356 ko pour un flou de 10 px — elle n'a besoin ni de l'un ni de l'autre. Mais
la produire demande un second asset par fond, un champ pour le désigner (dans
la donnée du bloc `image` plutôt qu'une migration), une variante sur la route
d'image, et un repli pour les fonds déjà téléversés. C'est un lot à soi seul, et
son gain est maintenant moindre qu'avant : le préchargement absorbe déjà
l'essentiel de l'attente.

**Les jetons de teinte dans le HTML.** C'est la partie « supprime le
basculement de couleur de la page déjà peinte », et elle bute sur une contrainte
d'architecture : `--h`/`--c`/`data-mode` sont appliqués par `BookSkin`, qui vit
dans le `layout.tsx` — et un layout ne connaît pas le segment enfant rendu sous
lui. Le fond, lui, est par FICHE. Trois voies, toutes structurantes :

1. le middleware pose un en-tête `x-pathname`, le layout en tire l'`entitySlug`
   et charge le fond lui-même — au prix d'une à deux requêtes de plus sur le
   chargement initial ;
2. une route parallèle (`@fond/[entitySlug]`) donne au layout un emplacement
   qui, lui, connaît le segment — idiomatique, mais elle ne peut poser un
   attribut sur un ancêtre, donc `data-mode` resterait client ;
3. ne rien faire : le basculement porte sur la teinte et la chroma, et reste
   discret tant que le mode ne change pas (il ne change que pour une image
   assez claire pour que le mode sombre ne tienne plus).

**Aucune n'est évidente, et le choix engage le reste** (CLAUDE.md, « deux
implémentations raisonnables »). À trancher avec l'auteur, avec un ADR si la
voie 1 ou 2 est retenue.

**Le cache de la redirection signée** n'a pas été touché non plus : l'allonger
revient à allonger la durée de vie d'une URL signée (`SIGNED_URL_TTL_SECONDS`),
donc la fenêtre pendant laquelle une URL copiée reste utilisable. C'est un
paramètre de sécurité, pas un réglage de performance — il se change délibérément
ou pas du tout.

### Lot 2.1 — le fond passe côté serveur

Ce que le lot 2 n'a pas fait, et qui restait ouvert : les jetons de teinte dans
le HTML, donc la fin du basculement de couleur d'une page déjà peinte. Sorti en
lot propre parce qu'il n'est pas une finition du lot 2 — il déplace une
responsabilité d'un côté à l'autre de la frontière serveur/client.

#### Le problème, une fois mesuré

`BookSkin` applique `--h`/`--c`/`data-mode` sur son conteneur, et il les tient
du contexte, que `WikiBackgroundRegistrar` alimente dans un `useEffect`. Or
`BookSkin` vit dans le `layout.tsx` (V2.1-12/19) et **un layout ne connaît pas
le segment enfant rendu sous lui**, alors que le fond est par FICHE. Rien dans
le rendu serveur ne peut donc porter ces jetons : ils n'apparaissent qu'après
l'hydratation, et toute la colonne se repeint à ce moment-là.

Mesuré sur le Prologue : racine à `--h: 249, --c: 0.037`, portée du wiki à
`--h: 90, --c: ≈0` — **les deux en mode sombre**. Le basculement porte donc sur
la teinte et la saturation d'un fond sombre. L'exception est `mode`, qui vaut
`availableModes[0]` (liste ordonnée sombre→tamisé→doux→clair) : une image assez
claire pour que le sombre ne tienne plus sélectionne `light`, et la colonne
entière bascule alors du sombre au clair après l'hydratation.

#### Quatre voies instruites, une retenue

| | Corrige la teinte | Corrige `data-mode` | Coût | Nouveau mécanisme |
|---|---|---|---|---|
| **1. en-tête `x-pathname`** | oui | oui | 3 vagues, annulables | oui |
| 2. route parallèle `@fond` | non | non | idem | non |
| 3. ne rien faire | non | non | zéro | non |
| 4. portée toujours posée + `<style>` | oui | non | zéro | non |

**Voie 2 écartée** : un emplacement parallèle rend À L'INTÉRIEUR du layout, il
ne peut donc poser ni attribut ni style sur `BookSkin`, qui est son ancêtre. Il
pourrait émettre un `<style>` pour `--h`/`--c`, mais `--bg`, `--panel`… sont
résolus sur `:root` et ne se recalculent que dans le bloc
`.wiki-bg-scope[data-mode="…"]` — il faudrait recopier toute la palette de
`tokens.css`. Elle sert l'image tôt, et l'image est déjà réglée par le lot 2.

**Voie 4 écartée pour l'instant**, et pour une raison qui vaut d'être notée :
elle ferait matcher `.wiki-bg-scope[data-mode="…"]` sur TOUTES les fiches. Or ce
sélecteur écrase `:root[data-contrast="high"]` (tokens.css:255), qui repose la
palette en valeurs neutres. Le mode contraste élevé est donc déjà perdu sur
toute fiche portant un fond — défaut réel, trouvé en instruisant ce lot, qui ne
relève pas de la performance et part dans son propre ticket. La voie 4
étendrait ce défaut de « les fiches illustrées » à « tout le wiki ». Elle ne
redeviendra envisageable qu'une fois le garde posé.

**Voie 1 retenue par l'auteur.** C'est la seule qui règle la teinte ET le mode :
le layout connaît la fiche, donc la classe, l'attribut, les jetons et la div de
fond partent dans le HTML.

#### Les deux objections, et ce qui les lève

**« Le layout deviendrait le chemin critique. »** Charger le fond coûte trois
vagues (`getEntityBySlug` → `listBlocksForEntity` → `getBackgroundMetaForBlock`).
Le layout en fait deux aujourd'hui (248 ms, relevé 1) ; à cinq, il dépasserait
une fiche ordinaire, qui n'en coûte que quatre.

La parade n'est PAS de mémoïser `listBlocksForEntity` : ce dépôt a dix appelants
dans des chemins d'ÉCRITURE (`characterActions`, `characterCreator`,
`generators`, `notebook`, `entities.duplicate`), et `React.cache` étant borné à
la requête, une action serveur qui insère un bloc puis relit la liste recevrait
la version d'avant l'écriture. On s'installerait un bug pour en éviter un autre.

La parade est une fonction de SERVICE mémoïsée, confinée au chemin de lecture
publique — `getPublicWikiBackground(worldId, entitySlug)` — appelée par le
layout ET par `getPublicEntityDetail`. Lecture seule, jamais dans un chemin
d'écriture, donc `cache()` y est sans danger. Et comme `cache()` mémoïse la
PROMESSE, le layout et la page qui partent en parallèle attendent le même
appel : le surcoût est nul, pas « faible ».

**« Le mode d'échec est muet. »** C'était l'objection décisive : le lot 4 veut
sortir `/partage/*` du middleware, et sans l'en-tête le fond retombe au
comportement d'aujourd'hui, sans erreur et sans test rouge. Deux réponses, et il
faut les deux :

1. le lot 4 est reformulé (voir sa description) : le middleware continue de
   s'exécuter, seul l'appel réseau disparaît ;
2. un test lit le HTML **rendu** et vérifie que la portée y porte bien les
   jetons de la fiche. C'est ce test qui transforme le raccourci muet en échec
   visible — la discipline seule ne l'aurait pas fait, la règle de V2.1-15 le
   dit déjà : un test qui échoue pour la raison qu'on attend vaut mieux qu'une
   intention.

#### Pourquoi AVANT le lot 3

Pas parce que les deux touchent le même fichier : parce que l'extraction de
`getPublicWikiBackground` **découpe `getPublicEntityDetail`**, qui est
exactement la fonction que le lot 3 réorganise. Fait après, le lot 3 devrait
défaire une partie de son propre travail ; fait avant, il travaille sur la
forme définitive.

#### Livré

Le HTML servi porte désormais la portée, son mode et ses jetons — vérifié sur
le HTML brut, avant qu'une ligne de JavaScript ne s'exécute :

```
class="flex w-full h-full wiki-bg-scope" data-mode="dark" style="--h:90;--c:1.0319238653556492e-8"
```

et la div `wiki-bg-backdrop` avec son `--wiki-bg-image`. Après hydratation, les
trois valeurs sont **identiques** à celles du HTML : il n'y a plus rien à
basculer.

`BookSkin` n'a pas été touché. Il lisait déjà le contexte ; il suffisait que le
contexte ne soit plus vide au rendu serveur. C'est le seul endroit de ce lot où
« ne rien changer » était le bon geste.

#### Le partage de travail, mesuré

| Geste | Avant (lot 0/1) | Après |
|---|---|---|
| Chargement complet, fiche ordinaire | — | **266 ms** |
| Chargement complet, Prologue | — | **807 ms** |
| Navigation client, fiche ordinaire | 215 ms | 237 ms |
| Navigation client, Prologue | 731 ms | 873 ms |

**Le layout n'est pas devenu le chemin critique**, et c'était l'objection à
lever : un chargement complet d'une fiche ordinaire coûte 266 ms quand la page
seule en coûte 237. Le layout n'ajoute donc qu'une trentaine de millisecondes,
pas les trois vagues qu'il aurait payées sans partage — `cache()` mémoïse la
promesse, layout et page attendent la même résolution.

Reste un écart d'une quinzaine de millisecondes sur la navigation client,
relevé sur trois séries successives (médianes 243, 230, 228 contre 215). Il est
**sous le seuil d'une vague** (68 ms au tarif mesuré) et n'a donc pas de cause
structurelle ; il est écrit ici plutôt que passé sous silence, et il faudra le
regarder si un autre lot le fait grandir.

#### Le fondu de V2-G13 a survécu

Vérifié en navigateur, trois captures : le fond du Prologue, puis le squelette
du lot 1 **avec le fond encore présent**, puis la fiche suivante sans fond. La
sortie se joue à l'arrivée de la nouvelle fiche, pas au départ de l'ancienne —
exactement le comportement d'avant.

`visible` démarre à `true` quand un fond initial est fourni, et c'est voulu :
un fondu d'entrée sur un fond déjà présent dans le HTML rejouerait l'attente
qu'on vient de supprimer. `register` reconnaît ensuite la même valeur comme
inchangée et ne déclenche aucune transition — la page reste la seule à DÉCLARER
le fond, le layout ne fait que l'avoir déjà sous la main.

#### Le garde anti-échec-muet

`lib/wikiPath.test.ts`, onze tests. Le découpage du chemin, et surtout :
**le `matcher` du middleware couvre bien `/partage`**. Si quelqu'un l'en
retirait — c'est le raccourci qui vient à l'esprit en lisant le titre du lot 4 —
l'en-tête disparaîtrait, le fond retomberait au comportement d'avant sans
erreur ni test rouge. Ce test-là tombe. Avec un témoin, parce qu'une assertion
de couverture qui rend `true` pour tout ne garde rien.

#### Ce que ce lot ne fait pas : l'onglet Wiki du joueur

Deux routes sur trois. `/partage` et `/apercu` passent par le même
`getPublicEntityDetail` et partagent donc `getPublicWikiBackground` sans un
octet de code en plus. La troisième, non, et pour deux raisons qui se cumulent :

1. elle résout son fond par `getPlayerEntityDetail` — autre service, client
   authentifié, RLS. Il faudrait y refaire la même extraction ;
2. surtout, **sa page a deux rendus possibles** : le corps de fiche, ou
   l'éditeur complet quand `canEditEntity` autorise ce joueur. Un layout qui
   poserait un fond initial l'afficherait aussi derrière l'éditeur, où
   aujourd'hui il n'y en a pas. Pour l'éviter, le layout devrait rejouer la
   vérification de droits de la page — c'est-à-dire dupliquer sa décision de
   branche.

Et la raison qui tranche : **cette route ne peut pas être vérifiée ici**. Elle
demande une session authentifiée dans le navigateur de mesure, que ce lot n'a
pas mise en place. Livrer sans vérifier vaudrait moins que ne pas livrer.

Aucune régression pour autant : `initialBackground` est optionnel, ce layout ne
le passe pas, son fond part de `null` comme avant. Le critère « les trois
routes se comportent pareil » reste donc ouvert, et il est le seul.

#### Ce qu'une session de test a appris (16 septembre)

L'auteur a fourni un lien d'invitation, ce qui a permis d'atteindre pour la
première fois les deux routes authentifiées sur le build local. Le flux
`/rejoindre` n'utilise ni email ni mot de passe — le jeton est la clé, et
`/entrer` rétablit la session par `verifyOtp` — et l'invitation était déjà
réclamée : rien n'a été créé ni consommé.

**Le squelette du lot 1 fonctionne aussi sur l'onglet Wiki du joueur**, y
compris dans le cas le plus contraint : cette route est imbriquée dans
`AppShell`, qui borne la hauteur de la coquille (V2.1-16). C'était la seule
différence structurelle avec `/partage` ; `/apercu` partage exactement la même
imbrication, et son découpage de chemin est couvert par `lib/wikiPath.test.ts`.
Aucune fiche publique dans le monde de test, donc pas de clic à y faire — noté
plutôt que coché.

**Un piège de mesure, deux fois rencontré et qui vaut d'être écrit** : dans un
onglet non peint, `requestAnimationFrame` ne s'exécute pas. Une frontière de
chargement reste alors indéfiniment sur son squelette, et le fond de page
n'est jamais demandé. Les deux ont d'abord été pris pour des défauts. Toute
vérification en navigateur de ce ticket doit forcer une peinture (une capture
suffit) avant de conclure quoi que ce soit.

#### Une incohérence trouvée en regardant l'éditeur

La branche éditable de `app/m/[worldSlug]/joueur/wiki/[entitySlug]/page.tsx`
rend `EditEntityForm` **sans** `WikiBackgroundRegistrar`. Vu à l'écran avec la
session : l'éditeur s'affiche dans la colonne de lecture de `BookSkin`, sommaire
compris.

Conséquence, lue dans le code et non mesurée (le monde de test n'a aucun fond) :
`register` n'étant jamais appelé sur cette branche, `displayed` garde sa valeur.
Une navigation client depuis une fiche AVEC fond vers une fiche éditable
**conserve le fond de la fiche précédente**, alors qu'un chargement à froid de
la même fiche éditable n'en a aucun. Les deux chemins ne donnent pas le même
écran.

Ce n'est pas une régression de ce ticket — c'est vrai depuis V2-M7b. Mais c'est
exactement la zone que le lot 2.1 devait traiter, et ça change la question.

#### La question qui reste, et elle n'est pas technique

Poser un fond initial depuis le layout de cette route demande de savoir si la
page rendra le corps de fiche ou l'éditeur — donc d'appeler `canUserEditEntity`
dans le layout. C'est faisable sans surcoût (`createClient` est mémoïsé, il
suffit d'une enveloppe à arguments primitifs pour que `cache()` morde), mais ça
fait rejouer au layout la décision de branche de la page.

Avant d'écrire ça, il faut trancher ce qu'on veut voir :

1. **L'éditeur n'a pas de fond** (comportement d'un chargement à froid
   aujourd'hui) — le layout doit alors connaître `canEditEntity`, et la branche
   éditable doit en plus enregistrer `null` pour corriger l'incohérence
   ci-dessus ;
2. **L'éditeur a le fond de sa fiche**, comme la lecture — le layout n'a rien à
   savoir, une ligne suffit, et l'incohérence disparaît d'elle-même. Mais on
   pose une photographie floutée derrière des champs de saisie.

La 2 est plus simple et plus cohérente ; la 1 respecte ce que l'écran fait
aujourd'hui. **C'est un choix d'auteur, pas une évidence technique**, et il
décide à lui seul de la taille du travail restant.

#### La troisième route, et la décision qui la débloque

**Décision de l'auteur : une fiche éditable porte le fond de sa fiche, comme en
lecture.** C'est la voie 2 des deux proposées — le layout n'a pas à savoir ce
que la page rendra, et l'incohérence décrite plus haut disparaît d'elle-même
plutôt que d'être contournée.

`getPlayerWikiBackground` est le jumeau exact de `getPublicWikiBackground` :
même extraction, mêmes mémoïsations à arguments primitifs (`viewerFor`,
`entityFor`, `getPlayerVisibleBlocks`), même partage entre le `layout.tsx` et la
page. Le client authentifié vient de `createClient`, déjà mémoïsé — sans quoi
`cache()` serait inerte, la leçon de V2.1-19.

La branche éditable rend désormais `WikiBackgroundPreload` et
`WikiBackgroundRegistrar` comme la branche de lecture. Elle n'enregistrait rien
du tout : à froid la fiche n'avait aucun fond, en navigation client depuis une
fiche illustrée elle gardait celui de la fiche PRÉCÉDENTE. Les deux écarts se
referment d'un coup.

#### Vérifié à l'écran, avec une session

Un bloc de contrôle temporaire posé dans le monde de test (teinte 30, orange —
impossible à confondre avec les 152 par défaut ou les 90/249 de Faerûn),
supprimé juste après ; le monde est revenu à zéro bloc image, vérifié.

Sur la fiche éditable, HTML servi :

```
class="flex w-full h-full wiki-bg-scope" data-mode="dark" style="--h:30;--c:0.05"
```

et la div de fond avec. Après hydratation : `--h: 30`, `--c: 0.05`,
`data-mode: dark`, backdrop monté à l'opacité 1, et la page rend bien
**l'éditeur**. Les valeurs de contrôle traversent donc tout le chemin, layout
compris, sur la branche qui n'avait jamais rien porté.

**Le critère « les trois routes de wiki se comportent pareil » est tenu.**

#### Les fenêtres flottantes ne participent pas, et c'est vérifié

Question de l'auteur : quand plusieurs fiches sont ouvertes avec des fonds
différents, laquelle gagne ?

Elle ne se pose pas. `WikiBackgroundProvider` n'est monté que par les trois
layouts de wiki ; ni `app/m/[worldSlug]/layout.tsx`, ni `mj/layout.tsx`, ni la
fiche d'édition ne le montent. **Dans la coquille MJ à fenêtres, il n'y a aucun
fond de wiki** — le seul fond visible y est celui de l'application, qui est un
réglage personnel sans rapport avec les fiches.

Et là où les deux coexistent (`/apercu` est bien à l'intérieur de la coquille à
fenêtres), `WikiBackgroundRegistrar` n'est rendu que par les `page.tsx` des
routes de wiki — jamais par une fenêtre, qui rend `EditEntityForm`. La règle est
donc : **le fond suit la fiche de l'URL**, jamais une fenêtre. Une fenêtre est
une surcouche, elle n'a pas voix au chapitre.

Écrit ici parce que la question reviendra, et que la réponse n'est évidente
qu'une fois qu'on a cherché où chaque fournisseur est monté.

#### Critères

- [x] `getPublicWikiBackground(worldId, entitySlug)` existe, est mémoïsé, et est
      le seul chemin par lequel le layout comme `getPublicEntityDetail`
      obtiennent le fond d'une fiche.
- [x] Relevé du nombre de vagues du layout et de la page avant/après, sur la
      même fiche qu'au lot 0 : le partage doit se voir, pas se supposer.
- [x] Le HTML servi porte `wiki-bg-scope`, `data-mode` et `--h`/`--c` de la
      fiche — vérifié sur le HTML **brut**, avant qu'une ligne de JavaScript ne
      s'exécute.
      **Critère réécrit après coup, et la nuance compte** : il exigeait « un
      test sur le rendu ». Le dépôt n'a aucune infrastructure de rendu de
      composants (Vitest en environnement `node`, ni jsdom ni bibliothèque de
      rendu), et en ajouter une pour ce seul point aurait été une dépendance
      décidée en passant. La vérification a donc été faite à la main sur le
      HTML servi, et le garde automatique vit ailleurs — voir la ligne
      suivante. Coché pour ce qui a été fait, pas pour ce qui était écrit.
- [x] Le garde anti-échec-muet existe et tombe pour la bonne raison :
      `lib/wikiPath.test.ts` échoue si `/partage` sort du `matcher` du
      middleware, avec un témoin pour qu'une couverture qui rendrait `true`
      partout ne passe pas pour une garantie.
- [x] Aucune bascule de couleur après hydratation, vérifiée en navigateur sur
      un build de production : les trois valeurs lues après hydratation sont
      identiques à celles du HTML. **Réseau non bridé** — la comparaison
      HTML/DOM rend la bride inutile ici, puisqu'elle ne dépend d'aucun délai.
- [x] Le fondu de sortie de V2-G13 fonctionne encore entre deux fiches, et en
      revenant au sommaire.
- [x] Les trois routes de wiki se comportent pareil — `/partage`, `/apercu` et
      l'onglet Wiki du joueur, branche éditeur comprise. Vérifié à l'écran avec
      une session, sur un bloc de contrôle temporaire depuis supprimé.
- [x] La description du lot 4 porte sa reformulation.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

### Lot 3 — livré

`getCalendar` et `listEntitiesForWorld` rejoignent le `Promise.all` du début de
`getPublicEntityDetail`. Elles ne dépendaient que de `worldId`, connu dès la
première ligne ; elles étaient séquentielles par ordre d'écriture, chacune
derrière son `if`, donc chacune dans sa propre vague.

Les gardes n'ont pas bougé : c'est toujours la présence des blocs concernés qui
décide si le résultat est **utilisé**. Seule la demande a été avancée. Aucune
donnée nouvelle ne part vers le client.

#### Mesure

| | lot 0/1 | lot 2.1 | **lot 3** |
|---|---|---|---|
| Prologue, navigation client | 731 ms | 873 ms | **678 ms** |
| Prologue, chargement complet | — | 807 ms | **731 ms** |
| Clan Oorvarsh, navigation | 215 ms | 237 ms | 233 ms |
| Fiche `/13`, navigation | 229 ms | 247 ms | 251 ms |

**−195 ms sur le Prologue**, soit les deux vagues attendues au tarif mesuré, et
le voilà repassé sous sa valeur du lot 0. Les fiches sans bloc `timeline`,
`quest` ni `text` ne bougent pas : la « requête parfois inutile » que ce lot
accepte de payer **ne se mesure pas**, exactement le marché annoncé.

Vagues recomptées : **11 → 9** sur le Prologue, **4 → 3** sur Clan Oorvarsh.

#### La sonde du lot 0 n'est plus fidèle, et c'est nous qui l'avons cassée

Relevé en la relançant : elle annonce des totaux en hausse et des requêtes en
plus, alors que le chronomètre HTTP dit l'inverse. La raison est dans ce que le
lot 2.1 a construit — `React.cache()` ne prend pas hors d'un rendu React, et
`getPublicEntityBySlug`, `getPublicVisibleBlocks` et `getPublicWikiBackground`
sont désormais mémoïsés. La sonde les exécute donc tous plusieurs fois.

Elle était fidèle au lot 0 (rien n'était mémoïsé sur ce chemin, vérifié à
l'époque) et elle ne l'est plus. **Le comptage de vagues qu'elle donne reste
valable** — la structure séquentielle ne dépend pas de la mémoïsation — mais
ses nombres de requêtes et ses totaux sont désormais une borne haute. Les
chiffres du tableau ci-dessus viennent tous du chronomètre HTTP contre un build
de production.

À retenir pour les lots suivants : un instrument se re-valide après chaque
changement qu'il est censé mesurer.

#### Vérifié à l'écran

Les deux lectures déplacées nourrissent du contenu visible, donc le contrôle
porte sur ce contenu et pas sur le fait que la page s'affiche :

- `entityLookup` — **16 liens d'entité** résolus dans le corps du Prologue
  (`Faerûn → 26`, `Terk → 18`, `Fine → 2`, `Candide → 22`…) ;
- `getCalendar` — **« 19 Brumaire 1421 »**, une date en calendrier de monde. Si
  le calendrier n'arrivait plus, elle retomberait sur le calendrier par défaut
  et ce libellé disparaîtrait.

#### Ce que ce lot ne fait pas : le point H

Il reste, et il est le plus gros. Les vagues 5 à 9 du relevé ci-dessus sont
toutes la résolution des règles citées : `getWorldDefaultRulesetId`, puis la
remontée de chaîne **un maillon par vague**, puis l'interrogation des entrées
**un maillon par vague** encore, puis blocs et traductions.

Deux corrections différentes s'offrent, et elles ne s'excluent pas :

1. **l'aplatir** — la remontée de chaîne est séquentielle par nature, mais la
   boucle `listRulesetEntryChipsByKeys` ne l'est pas : elle pourrait être une
   seule requête `ruleset_id=in.(…)`, à condition de reproduire côté code la
   priorité de chaîne que l'ordre des requêtes assure aujourd'hui (il existe un
   test pour ça, `rules.chainPriority.integration.test.ts`) ;
2. **la différer** — c'est le lot 5, et c'est la demande de l'auteur.

Différer ne rend pas le travail gratuit : le serveur le fait toujours, et les
bulles doivent être prêtes avant le premier survol. Les deux gardent donc leur
intérêt. Mais l'ordre compte : le lot 5 décide d'abord **où** ce travail
s'exécute, l'aplatissement décide ensuite **combien** il coûte. Faire le second
avant le premier reviendrait à optimiser un code qu'on s'apprête à déplacer.

### Lot 5 — le piège n'était pas là où ce ticket l'avait placé

Ce lot devait **différer** les bulles. En lisant précisément ce qui décide de
l'apparence d'un lien (`PublicBlockView.tsx`, `renderNode`), la répartition
s'est révélée différente de celle qu'on avait écrite :

- un lien d'**entité** dépend de `textRefs[id]`, dont la présence vient de
  `entityLookup` — résolu tôt depuis le lot 3. **L'extrait, lui, ne décide de
  rien** : il se diffère sans le moindre effet visible ;
- un lien de **règle** sur `/partage` et `/apercu` (où `ruleHrefBase` est
  absent) dépend de `ruleRefs[key]` — présent, c'est un bouton de survol ;
  absent, du texte ordinaire. **La présence EST l'apparence**, et « cette règle
  a-t-elle de la prose ? » ne se sait qu'au bout de toute la résolution.

Et surtout : les extraits d'entité **partagent leur vague** avec le début de la
chaîne de règles. Les différer seuls n'aurait gagné aucune vague. Tout le poids
est dans les règles, et les règles ne se diffèrent pas sans arbitrer une
question d'apparence.

D'où l'ordre inversé par rapport à ce que le lot 3 annonçait : **aplatir
d'abord**, puisque ça ne demande aucun arbitrage, et poser la question du
différé avec les chiffres d'après en main.

#### Trois gestes

1. **La chaîne de rulesets est réchauffée dès la première ligne.** Elle ne
   dépend que du monde, jamais des blocs, et attendait pourtant que les clés de
   règle soient collectées — trois vagues plus loin.
2. **Lancée sans être attendue.** Premier essai : dans le `Promise.all`. Toutes
   les fiches patientaient alors derrière une chaîne de trois lectures
   séquentielles dont la plupart n'ont que faire — 233 → 351 ms sur une fiche
   sans règle. Seule une fiche qui cite une règle la réclame.
3. **Une requête pour toute la chaîne** au lieu d'une par maillon.

#### Ce que le code portait déjà, et qu'il ne fallait pas réécrire

Le troisième geste a d'abord été écrit deux fois : une fonction de dépôt neuve
et une reconstitution maison de la priorité de chaîne. **`entriesFromChainByKeys`
existait déjà** (V3-R7, née du même genre d'audit : 39 871 lectures unitaires
mesurées par `pg_stat_statements`), fait exactement ça, et est gardée par
`rules.chainPriority.integration.test.ts`.

Trouvé en vérifiant que ce test couvrait bien le nouveau code — il ne le
couvrait pas, il couvrait la fonction que je venais de dupliquer. Les deux
ajouts ont été supprimés ; `repos/rules.ts` est revenu à l'identique.

Une seconde implémentation de la priorité de chaîne aurait fini par diverger
sur le seul point où elle ne doit pas : c'est elle qui fait qu'une variante
surcharge correctement une base officielle (règle absolue n° 18).

#### Mesure

| | lot 0 | lot 3 | **lot 5** |
|---|---|---|---|
| Prologue, navigation (2 règles citées) | 731 ms | 678 ms | **434 ms** |
| Prologue, chargement complet | — | 731 ms | **437 ms** |
| Clan Oorvarsh (aucune règle) | 215 ms | 233 ms | 235 ms |
| Fiche `/13` (aucune règle) | 229 ms | 251 ms | 221 ms |

**−41 % sur la fiche qui cite des règles, rien de perdu ailleurs.** Et c'est la
fiche qui compte : le Livre de sessions est la page d'arrivée d'un lien de
partage.

Vérifié à l'écran : les quatre bulles de règle (`dwarf`, `halfling` ×3), les 16
liens d'entité, le fond, la teinte de la fiche et la date ingame « 19 Brumaire
1421 » — tout ce que les vagues déplacées nourrissent.

#### Ce qui reste, et c'est maintenant une question d'apparence

Le différé n'a pas été fait, et la question qu'il pose n'a pas changé de nature
— elle s'est seulement clarifiée. Pour qu'une bulle de règle se charge après la
page, il faut accepter que son lien **se peigne avant qu'on sache s'il en a
une** :

1. **texte ordinaire d'abord, bouton ensuite** — réintroduit visuellement, à
   l'envers, ce que V2.1-18 lot 1 a corrigé ;
2. **bouton d'abord, texte ordinaire ensuite** si la règle n'a pas de prose —
   l'inverse, et une carte promise qui n'arrive pas ;
3. **bouton toujours**, la carte disant ce qu'elle trouve — supprime le
   scintillement en supprimant la dépendance, mais renonce à la décision « sans
   prose, pas de lien » de V2.1-18.

Aucune n'est neutre, et **434 ms rendent la question moins pressante qu'à
41 %**. À rouvrir seulement si l'auteur juge que ça vaut encore le coup.

### Ce que ce ticket ne fera pas, et pourquoi c'est déjà tranché

**Il ne remettra pas le préchargement sur le sommaire.** `EntityTree.tsx:99`
pose `prefetch={false}` sur tous les liens, et le commentaire V3-R5 se termine
pourtant par « Reste juste là où le clic navigue vraiment (peau « livre »,
coquille joueur) » — la phrase se lit comme si le préchargement y était
maintenu. Il ne l'est pas : le drapeau est inconditionnel, et dans `BookSkin` le
clic navigue vraiment (`useOpenEntityLink.ts:20` ne fait pas de
`preventDefault()` quand `hrefBase` est fourni). La phrase parle du **coût**
d'une navigation à froid, pas d'un préchargement conservé ; elle mérite d'être
reformulée au passage du lot 1, parce qu'elle s'est laissé lire de travers une
fois.

Ce paragraphe a été écrit **avant** le relevé 3, et celui-ci l'a corrigé sur un
point : le préchargement n'est coupé que sur le sommaire. Les liens du corps
préchargent, eux, et le font 21 fois par page. Voir le lot 6 — la conclusion
ci-dessous ne change pas pour autant, elle porte sur le sommaire.

L'idée de précharger au survol plutôt qu'à l'entrée dans le champ de vision est
séduisante et **elle a déjà été mesurée, en V2.1-18** : 448 ms à froid contre
428 ms après un survol appuyé, soit l'écart de mesure — parce que
`staleTimes.dynamic` vaut 0 par défaut et qu'une route dynamique préchargée est
écartée aussitôt. Le survol produisait deux rendus serveur, et le clic en
faisait un troisième.

Donc : le levier n'est pas le préchargement, c'est `staleTimes`. Et c'est une
décision de **portée applicative** — garder une réponse dynamique en cache côté
client, c'est accepter qu'une fiche modifiée par le MJ reste affichée telle
qu'elle était pendant la durée choisie. Ça ne se décide pas dans un composant,
et ça demande un ADR si l'auteur veut l'ouvrir. La seule chose que ce ticket
fait dans cette direction est indirecte : un `loading.tsx` (lot 1) donne au
préchargement une frontière à préparer, ce qui lui manquait.

### La question de l'auteur : charger les bulles après la page

> « lors du chargement initial, uniquement le chargement de la page globale, et
> une fois la page globale visible pour l'utilisateur, le chargement des bulles
> — ainsi on profite du temps de lecture de l'utilisateur pour y mettre un
> chargement caché. »

**Oui, et c'est la bonne idée.** Aujourd'hui `getPublicEntityDetail` résout, à
chaque rendu, l'extrait du premier paragraphe de **toutes** les entités citées
et la prose de **toutes** les règles citées (vague 7) — pour des cartes que le
lecteur ne verra que s'il survole, peut-être jamais. Sur une entrée de Livre de
sessions qui cite une douzaine de fiches, c'est un coût fixe payé par tout le
monde pour un usage occasionnel.

**La forme compte, et ce n'est pas une route.** Deux mécanismes répondent à la
demande :

- **`<Suspense>` et diffusion RSC** : la page est rendue et peinte sans les
  extraits ; le serveur garde la réponse ouverte et pousse les extraits quand
  ils sont prêts ; React les raccorde. Même requête, aucun aller-retour de
  plus, aucune route nouvelle, aucun `fetch` côté client. Le lecteur voit la
  page à T, les bulles sont prêtes peu après sans qu'il se passe rien à
  l'écran. C'est exactement le « chargement caché pendant le temps de lecture »
  demandé.
- **Une route appelée après la peinture** : un aller-retour HTTP de plus, du
  code client à écrire, et les données qui arrivent plus tard. Elle n'a qu'un
  avantage — la réponse de navigation se ferme plus tôt — et cet avantage ne
  sert à rien ici.

Donc `<Suspense>`. À noter que ceci ne contredit pas la règle de V2.1-18
(« rien ne part sur le réseau au survol ») : elle est **tenue plus fort**,
puisque la donnée est en mémoire avant le premier survol, sans que le survol
déclenche jamais quoi que ce soit.

**Le piège, et il est réel.** Les deux familles de liens ne se comportent pas
pareil :

- un lien d'**entité** est un lien quoi qu'il arrive : son `href` existe, son
  apparence ne dépend pas de l'extrait. Son extrait se diffère sans aucun effet
  visible ;
- un lien de **règle** n'est un lien **que s'il a de la prose** — c'est la
  décision du lot 1 de V2.1-18, prise pour corriger un lien qui se déguisait en
  lien. Or « a-t-il de la prose ? » est justement ce que
  `resolveRuleRefPreviews` va chercher. Différer cette résolution en bloc, c'est
  différer la décision d'apparence : le lien se peindrait dans un état puis
  changerait. On aurait rendu la page plus rapide en réintroduisant exactement
  le défaut que V2.1-18 a été ouvert pour corriger.

Trois issues possibles, à départager **avec le lot 0 en main** et pas avant :
différer les seuls extraits d'entités ; ou couper la résolution de règle en
deux (l'existence, qui reste sur le chemin critique, et l'extrait, qui part en
`<Suspense>`) ; ou constater que la chaîne de rulesets du monde mesuré est
courte, que le point H ne coûte rien, et qu'il n'y a rien à différer de ce côté.

### Critères

- [x] Lot 0 : nombre d'allers-retours par navigation, temps jusqu'au premier
      octet, chronologie du fond — les trois relevés écrits dans ce ticket,
      avec le monde et la fiche sur lesquels ils ont été pris.
- [x] Un clic dans le sommaire produit un retour visible en moins de 100 ms,
      sur les trois routes de wiki.
- [ ] Le fond d'une fiche est présent dans le HTML initial : aucune bascule de
      couleur de la page après hydratation, vérifiée en navigateur, réseau
      bridé.
- [ ] Le fondu de sortie de V2-G13 fonctionne encore entre deux fiches, et en
      revenant au sommaire.
- [ ] Le nombre d'allers-retours par navigation est relevé après, sur le même
      monde et la même fiche qu'au lot 0.
- [x] Un visiteur anonyme et un auteur connecté ouvrent le même lien de partage
      et voient la même chose — le lot 4 ne doit rien changer d'autre que le
      coût.
- [ ] Les cartes d'aperçu s'ouvrent toujours sans requête au survol, et un lien
      de règle ne change jamais d'apparence après le premier rendu.
- [ ] `npm run typecheck && npm run lint && npm run test` passent.

---

## V2.1-21 — Le contraste élevé se perd sur une fiche illustrée · `S`

### Constat

`src/styles/tokens.css` déclare la palette deux fois, pour deux raisons
différentes, et les deux déclarations se rencontrent sur le wiki :

- `:root[data-contrast="high"]` (tokens.css:255) repose **toute** la palette en
  valeurs neutres littérales — `--c: 0`, `--bg: oklch(0.12 0 0)`, etc. — quel
  que soit le mode choisi. C'est le mode contraste élevé, et il est déclaré sur
  la racine.
- `.wiki-bg-scope[data-mode="…"]` redéclare cette même palette à partir des
  `--h`/`--c` de la fiche courante, pour que le wiki prenne la teinte de son
  image de fond (V2-G13). C'est un `<div>` **à l'intérieur** de la page, et il
  redéclare la palette sur lui-même.

Le second gagne — mais pas pour la raison qu'on croit, voir « Le mécanisme,
corrigé » plus bas. **Sur toute fiche portant un fond de page wiki, le contraste
élevé est écrasé et la palette colorée revient**, sur les trois routes de wiki.

Un lecteur qui a activé le contraste élevé le perd donc précisément là où il en
a le plus besoin : sur les pages dont le fond est une photographie floutée.

### Comment il a été trouvé

En instruisant V2.1-20 lot 2.1, pas en le cherchant. Une des voies envisagées
consistait à poser `.wiki-bg-scope` sur **toutes** les fiches plutôt que sur les
seules fiches illustrées ; en vérifiant ce que ce sélecteur écrase, le défaut
est apparu — et il existe déjà aujourd'hui, sans qu'aucune des quatre voies ne
soit implémentée.

C'est la même leçon que V2.1-18 : on ne trouve pas ce défaut-là en relisant le
code, on le trouve en répondant à autre chose. Il ne relève pas de la
performance et n'a rien à faire dans V2.1-20 — d'où ce ticket.

### Le mécanisme, corrigé

**Ce ticket disait « descendant, donc plus spécifique ». C'est faux**, et la
nuance décide du correctif.

La spécificité départage deux règles qui visent le **même** élément. Ici elles
visent des éléments différents : `:root[data-contrast="high"]` vise `<html>`,
`.wiki-bg-scope` vise un `<div>` à l'intérieur de la page. Il n'y a donc pas de
duel à départager.

Ce qui joue est l'**héritage**. Une variable CSS descend d'ancêtre en
descendant, mais dès qu'un élément la redéclare **sur lui-même**, c'est sa
valeur qui vaut pour lui et tout son sous-arbre. Une déclaration locale
l'emporte toujours sur une valeur héritée, quelle que soit la spécificité de
cette dernière. Le wiki ne gagnait pas un duel : il reposait simplement la
variable plus bas dans l'arbre, et le contraste élevé n'avait aucun moyen de
s'y opposer.

### Chiffré avant de corriger

Contraste élevé actif, sur une fiche illustrée :

| | ce que la racine demande | ce que la portée imposait |
|---|---|---|
| `--bg` | clarté **1,6 %** | clarté **17 %** |
| `--ink` | blanc pur (100 %) | 95 % |

Fond plus clair, texte moins blanc, teinte de retour : les trois réduisent
l'écart que ce mode existe pour maximiser.

### Le correctif

`:root:not([data-contrast="high"])` devant chacune des quatre portées de wiki
(`dark`, `dim`, `soft`, `light`). Sous contraste élevé la portée ne déclare plus
rien, donc elle hérite — et hériter est exactement ce qu'on voulait.

Les jetons `--h`/`--c` que `BookSkin` pose en style **inline** ne sont pas
neutralisés (rien ne neutralise un style inline) : ils deviennent simplement
inertes, puisque la racine pose alors des valeurs littérales qui ne les lisent
jamais. C'est ce qui permet de ne pas toucher au composant.

### Vérifié

Sous contraste élevé, la portée rend désormais **exactement les mêmes valeurs
que la racine** (`lab(1.5609% 0 0)` et `lab(100% 0 0)`), et ce dans les
**quatre** modes — chacun retombe sur la palette neutre.

Sans contraste élevé, rien n'a bougé : la portée garde la teinte de sa fiche
(`--h: 90`) là où la racine porte celle de l'application (`--h: 249`). V2-G13
est intact.

### L'image de fond : choix de l'auteur, et ce qu'il donne vraiment

Décision retenue : **garder l'image, ne corriger que la palette**. Aucune ligne
ne touche `.wiki-bg-backdrop`.

Constaté en vérifiant : l'image reste bien chargée et affichée, mais le voile
`.wiki-bg-backdrop::after` peint `var(--scrim)`, qui passe de **70 %** à **92 %
d'opacité** sous contraste élevé. En pratique l'illustration se lit donc à
peine — non pas à cause de ce ticket, mais parce que la palette de ce mode le
prévoyait déjà ; le garde n'a fait que la laisser s'appliquer à la portée du
wiki.

Écrit ici plutôt que corrigé : rendre l'image réellement visible sous contraste
élevé demanderait d'affaiblir `--scrim` dans ce mode, c'est-à-dire de travailler
contre lui. La décision « garder l'image » est respectée à la lettre ; son effet
observable est qu'elle transparaît à 8 %.

### Critères

- [x] Sur une fiche portant un fond, contraste élevé activé : la palette reste
      celle du contraste élevé — vérifié dans les quatre modes.
- [x] Sur la même fiche, contraste élevé désactivé : la teinte du fond
      s'applique comme avant.
- [x] Les quatre modes (`dark`, `dim`, `soft`, `light`) revérifiés avec et sans
      contraste élevé.
- [x] La question de l'image de fond est tranchée et écrite ici : gardée, et
      voilée à 92 % par le `--scrim` du mode.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

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

**V2.1-10 était le dernier ticket ouvert**, le 15 septembre comme les trois
précédents. Il a
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

**V2.1-13 devait clore ce backlog**, et il n'aurait pas dû exister séparément : il a
été proposé en même temps que V2.1-12, dans la même réponse, et seul le premier
a été retenu au moment de passer au code. L'auteur a dû constater lui-même,
capture à l'appui, que la disposition de son wiki n'avait pas bougé.

D'où la dernière règle de ce backlog, et c'est une règle sur la conduite du
travail plutôt que sur le code : **quand deux travaux sont proposés ensemble et
qu'un seul est retenu, l'autre s'ouvre tout de suite ou il disparaît.** C'est
exactement ce que disait déjà la leçon de V2.1-8/V2.1-9 sur les notes — une
intention qui ne devient pas un ticket ne survit pas à la séance. Elle s'est
vérifiée une fois de plus, sur mon propre fait.

En contrepartie, V2.1-13 a tenu en une règle de conteneur au lieu de trois,
parce que V2.1-12 venait de réunir les trois routes sur une seule peau. La
fusion a rendu ce qu'elle promettait dès le ticket suivant.

## Ce que les deux derniers tickets ont appris

**Un backlog ne se clôt pas parce qu'un ticket le dit.** V2.1-13 se terminait
sur « V2.1-13 clôt ce backlog ». Le lendemain, l'auteur demandait à revoir
l'articulation du bloc texte et du Livre de sessions, et deux tickets de plus
sont nés. La phrase ci-dessus a été corrigée plutôt que retirée : elle disait
quelque chose de vrai au moment où elle a été écrite.

**V2.1-15 est sorti de ce que V2.1-14 avait décidé de NE PAS faire.** V2.1-14
porte un tableau des six choses accrochées au genre `session_journal`, avec pour
chacune « retiré » ou « gardé ». C'est en relisant la colonne « gardé » que
l'auteur a vu ce que personne n'avait formulé : le droit de l'autrice y
figurait comme intact, sans que quiconque se demande s'il était *reprenable*.
Écrire ce qu'on ne fait pas, et pourquoi, est ce qui a rendu le trou visible —
une liste de ce qu'on fait ne l'aurait jamais montré.

**Deux défauts dormaient dans le bloc texte, trouvés en le lisant, pas en le
testant.** Taper `---` créait un trait que l'enregistrement transformait en
paragraphe vide, en silence, depuis toujours. Et une proposition d'IA acceptée
reconstruisait l'objet du bloc, ce qui aurait effacé la lettrine à chaque fois.
Aucun test ne pouvait les voir : le premier parce que rien n'avait jamais
exercé ce chemin, le second parce que le champ qu'il efface venait d'être créé.
Les deux sont apparus en lisant le code autour de ce qu'on ajoutait.

**Un test d'intégration rouge a servi d'instrument de mesure.** V2.1-15 a passé
un moment avec `canEditEntityRls.integration.test.ts` en échec, et c'était la
bonne situation : le code disait « l'autrice n'écrit que par un octroi », la
base distante disait encore le contraire, et le test chiffrait exactement
l'écart entre les deux. Il est passé au vert à la seconde où la migration a été
appliquée. Un test qui échoue pour la raison qu'on attend vaut mieux qu'un
ticket annoncé fini avec une migration en attente.

**Les dix-sept tickets de ce backlog sont clos.** V2.1-16 a été ouvert le
15 septembre, après cette phrase et pour la deuxième fois : elle disait vrai au
moment où elle a été écrite, et la règle de V2.1-14 se vérifie une fois de plus
— un backlog ne se clôt pas parce qu'un ticket le dit. Celui-ci naît de deux
gênes d'affichage dont ni les types ni les tests ne pouvaient rien dire, et sa
vraie cause est plus vieille que les deux symptômes qui l'ont rendue visible.

**Troisième fois, et ce n'est plus une surprise.** V2.1-18 s'ouvre le
16 septembre, après V2.1-17 qui devait lui aussi être le dernier. La règle de
V2.1-14 n'a plus besoin d'être vérifiée : ce backlog est celui des demandes qui
naissent de l'usage, et l'usage ne s'arrête pas. Celui-ci tient d'ailleurs des
deux familles à la fois — une demande d'interface de l'auteur (l'aperçu au
survol) qui, en allant lire le code pour y répondre, a découvert un défaut que
personne ne cherchait : un lien qui se déguise en lien. **On ne trouve pas ce
défaut-là en relisant le code, on le trouve en répondant à autre chose.**
