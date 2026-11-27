# V3.2 — 8. La fiche allégée des PNJ et les indices

**Décision :** [ADR 0118](../adr/0118-la-fiche-allegee-des-pnj-et-les-indices.md)

Demandé le 26 novembre, après la séance où jauger Mabelle déclenchait une attaque. Chaque PNJ reçoit une fiche tirée d'un PNJ du SRD, son équipement et sa bourse ; la personne qui joue la découvre indice par indice ; le moteur fait les jets du PNJ.

**Ordre :** V3.2-46 ; puis V3.2-47 et 48 (aucune migration) ; puis V3.2-49 (la migration), 50 et 51 ; puis V3.2-54 (le récit nourrit la fiche) ; enfin V3.2-52.

### ☐ V3.2-46 — Jauger quelqu'un n'est pas l'attaquer · `S` · sans modèle IA · Modèle conseillé : Opus — **codé le 26 novembre ; reste à vérifier en jouant**

- Un verbe placé après une hypothèse (« si je », « si j' », « au cas où », « et si »…), dans la même proposition, est ignoré par le lexique : « si je venais à l'attaquer » ne propose plus d'attaque (`hypotheticalMarkers`, `src/core/rules/intent.ts` ; liste dans `src/i18n/fr.ts`).
- « déterminer », « évaluer », « observer », « toiser », « détailler » proposent un jet de Perception.

**Critères d'acceptation**
- [x] « j'essaie de déterminer si Mabelle semble apte à se défendre si je viendrais à l'attaquer » : Perception sur Mabelle (`src/i18n/intentLexicon.test.ts`).
- [x] « et si j'attaque Mabelle ? » : aucun jet ; « j'attaque Mabelle » : une attaque.
- [ ] En jouant : la pastille propose Perception, et le nom de l'arme s'affiche en français. Le libellé « longsword » vient d'une fiche d'arme que la résolution des noms ne trouve pas (`resolveBlockReferences`) : à reproduire sur la partie de l'auteur.

### ☐ V3.2-47 — La fiche de base d'un PNJ, tirée du SRD · `M` · sans modèle IA · Modèle conseillé : Opus — **codé le 26 novembre ; reste à vérifier en jouant**

- Table pure archétype de vie → fiche du SRD 2024 (`src/core`) : personnel de lieu, journalier, enfant, vieillard → Roturier ; garde → Garde ; prêtre → Acolyte de prêtre ; pilier de bar, videur → Gros-bras ; voyageur, messager → Éclaireur… Une fiche inconnue tombe sur Roturier, en le disant.
- Ajustements à graine fixe (`deriveSeed`) : ±2 sur une ou deux caractéristiques selon le métier, PV tirés depuis les dés de vie de la fiche.
- Bloc `statblock` gagne `based_on` facultatif (`{ source: "srd-2024", key }`), sans changer `__v` ; écrit à l'ancrage (`promoteSketch`) et à la création par le générateur, en visibilité `gm`.

**Fait.** `src/core/rules/npcSheet.ts` (table et ajustements : métier, ±1 sur deux caractéristiques, PV tirés sur les dés de vie) ; `giveNpcSheet` (`src/server/services/npcSheet.ts`) lit la fiche de règle du monde, la convertit (`statblockFromMonsterBlocks`) et écrit le bloc « Fiche » en `gm` ; appelé par `promoteSketch` à chaque ancrage. Le générateur du MJ garde son propre choix de créature (« Créer la fiche ») : il n'est pas branché sur cette table.

**Critères d'acceptation**
- [x] Tests du noyau d'abord : même PNJ, même graine, même fiche ; chaque archétype de départ a sa fiche (`npcSheet.test.ts`).
- [x] L'ancrage appelle la fiche avec l'archétype et la graine de la personne calculée, ou un Roturier pour une esquisse tirée à la main (`sceneSketches.test.ts`).
- [x] Rattrapage (retour de l'auteur, 27 novembre) : à chaque tour solo, un présent sans fiche allégée ni fiche de personnage en reçoit une (`ensureNpcSheetsForPresents`, quatre au plus par tour, MJ du monde seulement) — `npcSheet.test.ts`.
- [ ] En jouant : une personne nouvellement ancrée reçoit une fiche Roturier ajustée, visible du seul MJ ; Mabelle reçoit la sienne au premier tour joué au Fanal.

### ☐ V3.2-48 — Équipement probable et bourse · `M` · sans modèle IA · Modèle conseillé : Sonnet — **codé le 27 novembre ; reste à vérifier en jouant**

- Bloc `inventory` tiré à graine fixe : objets probables par archétype (un couteau, un tablier, des outils), bourse selon milieu social et `settlement.wealth`, en pièces du SRD.
- Écrit en même temps que la fiche de V3.2-47, en visibilité `gm`.
- **Porté ou caché** (retour de l'auteur, 27 novembre) : chaque objet tiré dit s'il se voit (armure, arme à la ceinture, objet en main, tablier) ou non (bourse, couteau sous le tablier). Ce qui se voit est découvert d'office dès que le PNJ est vu (V3.2-53) ; le reste attend un indice (V3.2-50).

**Fait.** `src/core/rules/npcGear.ts` (objets par archétype, porté ou caché, bourse en cuivre × richesse de la ville) ; champ facultatif `concealed` des objets d'inventaire ; `giveNpcGear` (bloc « Équipement », `gm`) à l'ancrage et au rattrapage des présents.

**Critères d'acceptation**
- [x] Une aubergiste d'un bourg modeste porte quelques pièces et parfois un couteau caché ; un noble d'une ville réputée, une bourse d'or (`npcGear.test.ts`).
- [x] Un garde porte sa lance et sa chemise de mailles, visibles (`npcGear.test.ts`).
- [ ] Dans la fiche, la part visible apparaît dès que le PNJ est vu ; la bourse reste cachée (dépend de V3.2-49).

### ☐ V3.2-49 — La table des indices découverts et la vue joueur · `M` · sans modèle IA · Modèle conseillé : Opus

- Migration `entity_facet_discoveries` (ADR 0118 §4), RLS refus par défaut, écriture par le moteur signé ou le MJ. `docs/SCHEMA.md` mis à jour.
- Fonction pure : bloc `statblock` ou `inventory` + facettes découvertes → vue joueur ne contenant que celles-ci. Branchée dans la lecture des blocs pour un lecteur joueur.

**Critères d'acceptation**
- [ ] Tests du noyau : aucune facette non découverte ne figure dans la vue, même dans un champ vide.
- [ ] Test d'intégration : un joueur ne lit ni la ligne d'une autre partie, ni le bloc entier.

### ☐ V3.2-50 — Un jet réussi révèle des indices · `M` · sans modèle IA · Modèle conseillé : Opus

- Sur un jet réussi visant un présent, le moteur choisit les facettes révélées selon la compétence et la marge (ADR 0118 §5), les écrit, et les donne au récit comme fait établi.
- Le volet Wiki de l'écran solo les affiche sans recharger toute la fiche (`docs/CABLAGE.md`).

**Critères d'acceptation**
- [ ] Perception réussie sur Mabelle : son couteau et sa Force apparaissent dans sa fiche, rien d'autre.

### ☐ V3.2-51 — En solo, le wiki se lit en vue joueur · `M` · sans modèle IA · Modèle conseillé : Opus

- Dans une partie solo, les pages du monde se lisent avec le lecteur joueur (`genericPlayerViewer`) et les découvertes de la partie, même pour le propriétaire. Un interrupteur « Voir comme le MJ » reste pour corriger le monde.

**Critères d'acceptation**
- [ ] Un paragraphe `gm` d'une fiche ne s'affiche plus dans le wiki de la partie solo, tant qu'il n'est pas découvert.

### ☐ V3.2-52 — Le moteur fait les jets des PNJ · `M` · **avec modèle IA** · Modèle conseillé : Opus

- La narration peut proposer une action de PNJ dans une liste fermée (soulever, courir, résister, esquiver…), validée par Zod ; le moteur lance le dé avec la fiche du PNJ et un DD de règle, l'IA raconte l'issue.

**Critères d'acceptation**
- [ ] Un PNJ qui tente de soulever un tonneau : jet d'Athlétisme du moteur avec sa Force, issue racontée sans être jugée par l'IA.

### ☐ V3.2-54 — Le récit nourrit la fiche du PNJ · `M` · **avec modèle IA** · Modèle conseillé : Opus

Retour de l'auteur, 27 novembre : « en créant la fiche wiki, le moteur doit aussi prendre en considération les récits de l'IA ».

- Toute fiche de PNJ a au moins un bloc texte « Ce qu'on voit » : apparence et équipement porté. Il est lisible par la personne qui joue dès que le PNJ est vu.
- À l'ancrage, puis à chaque tour où le PNJ est décrit, ce que la narration a dit de lui (« elle essuie une chope », « un tablier taché ») arrive comme proposition structurée (`ai_proposals`, règle 9). Le moteur la valide contre la fiche (ADR 0104 : le wiki l'emporte), puis l'ajoute à « Ce qu'on voit ». Un objet nommé par le récit et absent de l'inventaire y entre, avec ses chiffres tirés des règles.
- Les détails cachés (un tatouage sous la manche, une lettre dans la poche) vont dans un paragraphe `gm` de la description ou dans l'inventaire caché, à découvrir par indice (V3.2-50).

**Critères d'acceptation**
- [ ] Après deux tours au Fanal, la fiche de Mabelle décrit ce que le récit a montré d'elle, sans rien contredire de sa fiche.
- [ ] Un détail que le récit présente comme caché n'apparaît pas dans la vue joueur.
