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

### ☐ V3.2-49 — La table des indices découverts et la vue joueur · `M` · sans modèle IA · Modèle conseillé : Opus — **codé le 27 novembre ; migration à appliquer, affichage dans V3.2-51**

- Migration `entity_facet_discoveries` (ADR 0118 §4), RLS refus par défaut, écriture par le moteur signé ou le MJ. `docs/SCHEMA.md` mis à jour.
- Fonction pure : bloc `statblock` ou `inventory` + facettes découvertes → vue joueur ne contenant que celles-ci. Branchée dans la lecture des blocs pour un lecteur joueur.

**Fait.** Migration `20261127150000_indices_decouverts.sql` ; `src/core/rules/facets.ts` (forme des facettes, vues joueur construites champ par champ, `seenAtAGlance`) ; repo `entityFacetDiscoveries.ts` ; `revealFacets` et `readNpcPlayerViews` (`src/server/services/facetDiscoveries.ts`). Au tour solo, ce que les PNJ de la pièce portent sans le cacher est découvert d'office (`ensureNpcSheetsForPresents`). Limite : la vue se lit avec les droits de la personne qui joue, donc seulement en solo (propriétaire) ; en partie à table il faudra une fonction `security definer`.

**Critères d'acceptation**
- [x] Tests du noyau : aucune facette non découverte ne figure dans la vue, même dans un champ vide (`facets.test.ts`).
- [ ] Test d'intégration contre la vraie base, une fois la migration appliquée : un joueur ne lit ni la ligne d'une autre partie, ni celle qu'une autre personne a découverte seule.

### ☑ V3.2-50 — Un jet réussi révèle des indices · `M` · sans modèle IA · Modèle conseillé : Opus — **codé le 27 novembre**

- Sur un jet réussi visant un présent, le moteur choisit les facettes révélées selon la compétence et la marge (ADR 0118 §5), les écrit, et les donne au récit comme fait établi.
- Le volet Wiki de l'écran solo les affiche sans recharger toute la fiche (`docs/CABLAGE.md`).

**Fait.** `facetsRevealedByCheck` (`src/core/rules/facetReveal.ts`) : Perception (Force, objets cachés ; à 5 de marge CA et Dextérité ; à 10 les actions), Perspicacité (Sagesse, Charisme ; puis Intelligence), Investigation (bourse, objets cachés ; puis Intelligence), Médecine (PV, Constitution), Athlétisme, et les jets de caractéristique. `revealCluesFromCheck` (`src/server/services/checkClues.ts`), appelé au tour solo après le jet : cible du jet, ou le seul PNJ de la pièce ; facettes écrites pour qui a lancé, liées au tour ; une phrase « Indices découverts sur … » ajoutée aux faits de la narration ; la scène revient dans la réponse pour que le volet Wiki se relise (C5). Retour de l'auteur : un jet raté et une fouille vide disent la même chose (« Rien trouvé », sans dire s'il y avait quelque chose, sans rien inventer) ; un objet caché porte un DD secret, l'effort fait pour le cacher (`conceal_dc`, tiré à la création, 12 à 17 ; 15 par défaut), que le total doit atteindre en plus du DD affiché. Reste : une cible de combat (`participant:`), avec le combat solo (ADR 0121).

**Critères d'acceptation**
- [x] Perception réussie sur Mabelle : son couteau et sa Force apparaissent dans sa fiche, rien d'autre (`facetReveal.test.ts`, `checkClues.test.ts`).

### ☑ V3.2-51 — En solo, le wiki se lit en vue joueur · `M` · sans modèle IA · Modèle conseillé : Opus — **codé le 27 novembre**

- Dans une partie solo, les pages du monde se lisent avec le lecteur joueur (`genericPlayerViewer`) et les découvertes de la partie, même pour le propriétaire. Un interrupteur « Voir comme le MJ » reste pour corriger le monde.

**Fait.** `asSoloPlayer` (`src/core/visibility/soloPlayer.ts`) rabat le propriétaire ou l'éditeur d'un monde solo au rôle joueur de la partie ; `playerEntityDetail` l'applique au wiki joueur (page et route du volet Wiki). Pour un PNJ, `readNpcDisplayView` renvoie la fiche et l'équipement réduits aux facettes découvertes, affichés par `PublicNpcView` (« ? » pour le reste, bourse comprise). Le wiki éditeur du monde reste la vue MJ, qui tient lieu d'interrupteur. Les relations de la fiche se lisent avec le même lecteur (`listVisibleRelations`, lecteur passé par l'appelant).

**Critères d'acceptation**
- [x] Un paragraphe `gm` d'une fiche ne s'affiche plus dans le wiki de la partie solo, tant qu'il n'est pas découvert (`soloPlayer.test.ts` : le lecteur rabattu ne voit plus le niveau `gm`).

### ☐ V3.2-52 — Le moteur fait les jets des PNJ · `M` · **avec modèle IA** · Modèle conseillé : Opus — **codé le 28 novembre ; reste à vérifier en jouant**

- La narration peut proposer une action de PNJ dans une liste fermée (soulever, courir, résister, esquiver…), validée par Zod ; le moteur lance le dé avec la fiche du PNJ et un DD de règle, l'IA raconte l'issue.
- Les attaques et les dégâts des PNJ sont venus avec le combat solo (ADR 0121, `resoudreAttaquePnj`) ; ce ticket ajoute les tests de compétence et les sauvegardes, dans le même `src/core/rules/npcRolls.ts` : `NPC_CHECK_ACTIONS` (23 actions), `modificateurJetPnj` (bonus de la fiche s'il y est, sinon la caractéristique), `resoudreJetPnj` (d20, ni le 20 ni le 1 ne décident seuls, règles 2024).
- Le trajet : la narration propose `npc_check` (PNJ présent, action, palier) et s'arrête sur la tentative ; `jouerJetDePnj` (`src/server/services/npcChecks.ts`) lance le dé du serveur et journalise l'issue (`rule_application`, source `npc_check`) ; la narration suivante la reçoit en tête des faits établis et la raconte. « Raconter autrement » ne relance jamais ce dé.
- Le fait ne dit que l'action, le DD et le verdict : ni le dé ni le total, qui trahiraient la fiche (ADR 0118 §5).
- Limites : une esquisse sans fiche ne fait pas de jet ; le bonus de compétence est celui du SRD, sans suivre l'ajustement de caractéristique de la fiche (V3.2-47) ; les tests opposés (le mensonge du personnage contre la Perspicacité du PNJ) restent à faire, avec V3.2-80.

**Critères d'acceptation**
- [x] Un PNJ qui tente de soulever un tonneau : jet d'Athlétisme du moteur avec sa Force (`npcChecks.test.ts`, `src/server/services/npcChecks.test.ts`).
- [ ] En jouant : l'issue est racontée au tour suivant sans être jugée par l'IA.

### ☐ V3.2-54 — Le récit nourrit la fiche du PNJ · `M` · **avec modèle IA** · Modèle conseillé : Opus — **portrait et rangement des notes codés le 27 novembre**

Retour de l'auteur, 27 novembre : « en créant la fiche wiki, le moteur doit aussi prendre en considération les récits de l'IA ».

- Toute fiche de PNJ a au moins un bloc texte « Ce qu'on voit » : apparence et équipement porté. Il est lisible par la personne qui joue dès que le PNJ est vu.
- À l'ancrage, puis à chaque tour où le PNJ est décrit, ce que la narration a dit de lui (« elle essuie une chope », « un tablier taché ») arrive comme proposition structurée (`ai_proposals`, règle 9). Le moteur la valide contre la fiche (ADR 0104 : le wiki l'emporte), puis l'ajoute à « Ce qu'on voit ». Un objet nommé par le récit et absent de l'inventaire y entre, avec ses chiffres tirés des règles.
- Les détails cachés (un tatouage sous la manche, une lettre dans la poche) vont dans un paragraphe `gm` de la description ou dans l'inventaire caché, à découvrir par indice (V3.2-50).

Second retour, 27 novembre : un premier bloc d'apparence seule, riche, utilisable comme consigne Midjourney ; les secrets à part (ADR 0118, amendement).

**Fait.** `src/core/ai/npcPortrait.ts` (schéma fermé, consigne, rangement des notes) ; `draftNpcPortrait` (`src/server/ai/npcPortrait.ts`, `generate_npc`) ; `ensureNpcAppearance` et `ensureNpcAppearancesForPresents` (`src/server/services/npcAppearance.ts`), appelés après la narration du tour solo : bloc « Apparence » en tête, détail caché dans « Ce qui ne se voit pas » (`gm`). `world_note` porte un `aspect` ; `proposeWorldNote` range la note dans le bon bloc. Un objet ordinaire que la narration montre chez un PNJ présent (`npc_item`) entre dans son inventaire, visible (`itemFromNarration` : pas de doublon ; jamais une arme, une armure ni un objet caché, car la fiche et l'inventaire sont tirés une fois à la création, retour de l'auteur du 27 novembre), via `addNarratedItem` (`src/server/services/narratedItems.ts`).

**Critères d'acceptation**
- [ ] Après deux tours au Fanal, la fiche de Mabelle décrit ce que le récit a montré d'elle, sans rien contredire de sa fiche (à vérifier en jouant).
- [x] Un détail que le récit présente comme caché n'apparaît pas dans la vue joueur (`soloWorldNotes.test.ts`, `npcAppearance.test.ts` : bloc `gm`).

### ☐ V3.2-80 — Ce que les PNJ savent du personnage · `L` · **avec modèle IA** · Modèle conseillé : Opus — **codé le 28 novembre ; migration à appliquer, geste de cacher à faire**

Demande de l'auteur, 27 novembre : « les PNJ ne connaissent pas non plus mon équipement ou mes stats et peuvent de leur côté faire des jets pour découvrir les différentes choses de mon personnage… gérer, de manière invisible, ce que savent les PNJ de moi… un PNJ peut partager des infos sur moi à d'autres ou faire courir des rumeurs fausses. »

- Le miroir de V3.2-50 : une table (ou une extension de `entity_facet_discoveries`) des facettes du personnage joué connues de chaque PNJ, invisible à la personne qui joue. Les PNJ font leurs jets d'observation (moteur, V3.2-52) quand l'occasion se présente.
- La narration reçoit, dans la partie réservée au MJ (ADR 0117), ce que chaque PNJ présent sait du personnage, et le fait agir en conséquence.
- Transmission : un PNJ peut raconter ce qu'il sait à un autre (proposition structurée, validée par le moteur) ; une rumeur peut être fausse, et garde sa source et sa véracité.
- Le personnage aussi peut cacher (second retour de l'auteur, même jour) : un bandage sur un tatouage, une arme sous la cape. Le moteur en tire un DD de dissimulation, et seule une approche précise (fouiller, défaire le bandage) peut le découvrir. Même règle que pour les PNJ : un échec et une absence se disent pareil.
- Migration à prévoir : à concevoir dans un ADR avant de coder.

**Fait, 28 novembre (ADR 0122).** Table `npc_knowledge` (migration `20261128100000_savoir_des_pnj`, **à appliquer**), réservée au MJ. Noyau : `src/core/rules/npcKnowledge.ts` (ce qui se voit, partage, rumeur, ligne pour la narration). Service : `src/server/services/npcKnowledge.ts`.
- `observePcAtSight`, à chaque tour : les PNJ à fiche de la pièce retiennent ce que le personnage porte à découvert.
- `npc_check` avec `target: pc` (repérer, fouiller, jauger, soigner) : jet secret, sans verdict pour la personne qui joue ; sur une réussite, `learnFromNpcCheckOnPc` choisit ce que le PNJ apprend par `facetsRevealedByCheck` (le DD secret d'un objet caché vaut aussi pour le personnage).
- `npc_share` et `npc_rumour`, proposés par la narration : `shareNpcKnowledge`, `spreadRumour` (toujours fausse).
- `knowledgeSecrets` : la narration reçoit, dans `secrets-du-mj`, ce que chaque présent sait du personnage.

**Reste :** le geste de cacher (« je mets un bandage sur mon tatouage ») : le moteur ne tire pas encore de `conceal_dc` d'un jet du personnage, et un détail du corps n'est pas encore une facette (`mark:<id>`). « Annuler ce tour » ne retire pas ce qu'un PNJ a appris, comme pour les indices.

**Critères d'acceptation**
- [x] Un PNJ qui a réussi un jet de Perception sur le personnage sait qu'il porte une épée ; un autre ne le sait pas, tant que le premier ne le lui a pas dit (`src/server/services/npcKnowledge.test.ts`).
- [x] Une rumeur fausse circule et se distingue, côté MJ, d'un fait vrai (même fichier).
- [ ] En jouant, après application de la migration.
