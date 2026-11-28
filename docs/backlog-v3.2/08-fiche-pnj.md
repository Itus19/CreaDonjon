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

### ☐ V3.2-80 — Ce que les PNJ savent du personnage · `L` · **avec modèle IA** · Modèle conseillé : Opus — **codé le 28 novembre ; reste les détails du corps (tatouage)**

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

**Le geste de cacher, 28 novembre.** « je cache ma dague sous ma cape » : le jet de Discrétion ou d'Escamotage que le moteur lance déjà, réussi, cache l'objet nommé du sac ; son total devient le DD secret pour le trouver, comme l'action Se cacher de 2024 (`gesteDeDissimulation`, `src/core/rules/pcConcealment.ts` ; `applyPcConcealment`, `src/server/services/pcConcealment.ts`, avant que les PNJ regardent). « je sors la lettre » la remet en vue, sans jet. « dissimuler » propose un jet d'Escamotage.

**Reste :** les détails du corps sont traités par V3.2-81. « Annuler ce tour » ne retire pas ce qu'un PNJ a appris, comme pour les indices.

**Critères d'acceptation**
- [x] Un PNJ qui a réussi un jet de Perception sur le personnage sait qu'il porte une épée ; un autre ne le sait pas, tant que le premier ne le lui a pas dit (`src/server/services/npcKnowledge.test.ts`).
- [x] Une rumeur fausse circule et se distingue, côté MJ, d'un fait vrai (même fichier).
- [ ] En jouant, après application de la migration.

### ☐ V3.2-81 — Les signes distinctifs dissimulés · `M` · sans modèle IA · Modèle conseillé : Opus — **codé le 28 novembre ; reste à vérifier en jouant**

Proposition de l'auteur, 28 novembre : dans la description d'un personnage, PNJ comme personnage joué, des passages cachés qu'on peut cacher et révéler (un tatouage sous un bandage).

Deux sortes de « caché » à ne pas confondre : la visibilité d'un paragraphe dit **qui lit** le texte (MJ, joueurs) ; la marque nouvelle dit **qui le voit dans l'histoire**. La personne qui joue lit toujours le tatouage de son propre personnage ; ce sont les PNJ qui ne le voient pas.

- Un paragraphe de bloc texte peut porter `concealed: { dc }` (champ optionnel du segment, données du bloc : aucune migration SQL). Facette `mark:<id du segment>`.
- Sur un PNJ : un paragraphe dissimulé n'apparaît pas dans la vue joueur (filtré côté serveur, règle 5) tant que la facette n'est pas découverte ; `facetsRevealedByCheck` le révèle à une fouille ou une Perception dont le total atteint `dc`.
- Sur le personnage joué : toujours lisible par la personne qui joue ; absent de ce qu'un PNJ voit au premier regard ; un jet réussi sur le personnage (V3.2-80) le fait retenir au PNJ, avec son texte.
- Cacher et révéler : le geste de V3.2-80 (`gesteDeDissimulation`) retrouve aussi un paragraphe par ses mots (« je mets un bandage sur mon tatouage ») ; « j'enlève le bandage » le révèle.
- Éditeur : un interrupteur « Dissimulé » et sa difficulté sur le paragraphe.

**Fait, 28 novembre.** `src/core/rules/concealedMarks.ts` (lecture selon la marque, texte d'un signe, paragraphe nommé par une phrase) ; facette `mark:` (`facets.ts`, `facetReveal.ts`) ; vue joueur (`playerEntityDetail.ts`, deux lectures seulement si la fiche a un signe dissimulé), partage public, aperçu et choix de personnage sans signes ; indices (`checkClues.ts`) et savoir des PNJ (`learnFromNpcCheckOnPc`) ; geste de cacher (`gesteDeDissimulation`, `applyPcConcealment`) ; éditeur : sélecteur « Dissimulé · DD » dans la bulle du paragraphe. « je cache mon tatouage sous un bandage » passe par « cache » (Discrétion) ; « je mets un bandage » seul ne lance pas de jet.

**Critères d'acceptation**
- [x] Le tatouage de Mabelle, dissimulé DD 15 : absent de la vue joueur ; une fouille à 15 le révèle, une à 14 dit « rien trouvé » (`concealedMarks.test.ts`, `checkClues.test.ts`).
- [x] « je cache mon tatouage sous un bandage », Discrétion 13 : un PNJ qui regarde le personnage ne le voit pas ; une Perception à 13 sur lui le lui apprend (`pcConcealment.test.ts`, `npcKnowledge.test.ts`).
- [ ] En jouant, et dans l'éditeur.


### ☐ V3.2-82 — Les jets opposés · `M` · sans modèle IA · Modèle conseillé : Opus — **codé le 28 novembre ; reste à vérifier en jouant**

Suite de V3.2-80. Quand le personnage ment à un PNJ, se cache de lui ou lui fait les poches, la difficulté n'est pas un palier fixe : c'est le jet du PNJ (règles 2024 : la cible lance, son total devient le DD).

- Correspondance, dans le noyau : Tromperie → Perspicacité ; Discrétion et Escamotage → Perception. Persuasion et Intimidation gardent le palier : les règles 2024 les règlent par l'attitude du PNJ, pas par un jet opposé.
- Seulement si la cible du jet est un PNJ de la scène qui a une fiche (`statblock`), et qu'aucun DD n'a été saisi à la main. Sinon, le palier habituel.
- Le moteur lance le dé du PNJ (`serverRng`, `modificateurJetPnj`) ; le total devient le DD de la demande de jet. Réussite automatique seulement si le pire jet du personnage atteint ce total.
- Le dé et le modificateur du PNJ ne quittent jamais le serveur ; le DD s'affiche ou non selon le réglage habituel. La demande dit « contre la Perspicacité de X », et la narration le reçoit ainsi.

**Fait, 28 novembre.** `jetOppose` et `ddOppose` (`src/core/rules/npcRolls.ts`), `ddOpposeDuPnj` (`src/server/services/npcChecks.ts`), branché dans `proposeIntentRequest` (`turnIntent.ts`). La fiche se lit avec le client de l'appelant : à une table, une joueuse ne la lit pas (RLS) et garde le palier.

**Critères d'acceptation**
- [x] Mentir à un PNJ de Sagesse 14, sans maîtrise : le DD vaut 1d20 + 2, tiré par le serveur (`npcChecks.test.ts`, noyau et service).
- [x] Mentir à quelqu'un qui n'a pas de fiche : le palier habituel (même test).
- [ ] En jouant.

### ☐ V3.2-83 — « Annuler ce tour » efface aussi ce que le tour a appris · `S` · sans modèle IA · Modèle conseillé : Opus — **codé le 28 novembre ; reste à vérifier en jouant**

Aujourd'hui l'annulation retire les découvertes d'entités, mais pas les indices (`entity_facet_discoveries`) ni ce que les PNJ ont appris du personnage (`npc_knowledge`). Les deux tables portent `source_event_id` et une RLS de suppression pour le MJ : l'annulation supprime les lignes nées des événements du tour. Un paragraphe caché pendant le tour revient tel qu'il était.

**Fait, 28 novembre.** Deux suppressions par événement source (`deleteFacetDiscoveriesBySourceEvents`, `deleteNpcKnowledgeBySourceEvents`) dans `undoLastSoloTurn`. Le geste qui cache ou révèle un paragraphe écrit désormais une ligne de journal (`rule_application`, source `pc_concealment`, avec l'état d'avant) ; l'annulation la relit et remet le paragraphe (`restorePcConcealments`). Un objet caché revenait déjà avec l'inventaire du début du tour.

**Critères d'acceptation**
- [x] Un tour où une fouille révèle l'épée d'un PNJ, puis annulé : l'épée n'est plus connue (`src/server/services/turnUndo.test.ts`).
- [x] Un tour où un PNJ apprend la CA du personnage, puis annulé : il ne la sait plus (même test).
- [x] Un tatouage caché pendant le tour revient en vue (`pcConcealment.test.ts`).
- [ ] En jouant.

### ☐ V3.2-84 — Plus de verbes pour cacher · `S` · sans modèle IA · Modèle conseillé : Opus — **codé le 28 novembre ; reste à vérifier en jouant**

« je mets un bandage sur mon tatouage », « je glisse la dague dans ma botte », « je rabats ma capuche sur ma cicatrice » ne déclenchent aujourd'hui aucun jet : seuls « cache », « dissimule », « escamote » le font. Élargir le lexique du geste (`gesteDeDissimulation` et le filtre de `applyPcConcealment`) : couvrir, recouvrir, bander, glisser dans, rabattre, enfouir, planquer, camoufler, emmailloter ; et pour révéler, ôter, défaire, relever. L'intention du tour doit aussi proposer un jet de Discrétion ou d'Escamotage pour ces verbes.

**Fait, 28 novembre.** Lexique (`src/i18n/fr.ts`) : couvrir, recouvrir, camoufler, planquer, enfouir, rabattre (Discrétion) ; « mettre, nouer, enrouler, enfiler » suivis d'un bandage, d'une capuche, d'un foulard… (Discrétion) ; « glisser » suivi d'un article (Escamotage). « mets » et « glisse » seuls restent libres (« je glisse sur la glace »). Le geste (`gesteDeDissimulation`) ne cache plus rien sans un mot qui dit qu'on cache : un verbe de dissimulation, une chose qui couvre, ou glisser DANS ou SOUS. Révéler : ôter, défaire, relever en plus.

**Critères d'acceptation**
- [x] Chacune des trois phrases ci-dessus, avec un jet réussi, cache l'objet ou le paragraphe nommé (`pcConcealment.test.ts`, `intentLexicon.test.ts`).
- [x] « je glisse une dague au marchand » ne cache rien (même test).
- [ ] En jouant.

### ☐ V3.2-85 — Test d'intégration de la RLS des indices et du savoir des PNJ · `S` · sans modèle IA · Modèle conseillé : Opus

Vérifier contre une vraie base, avec les comptes de test (`docs/TESTS.md`), que : un membre d'une partie à table lit les indices de toute la table et les siens, jamais ceux d'une autre personne ; il ne lit, n'écrit ni ne supprime aucune ligne de `npc_knowledge` ; le MJ du monde fait tout. Le test s'écrit maintenant ; il s'exécute là où les clés Supabase existent (il se saute sans elles, comme les autres tests d'intégration).

**Critères d'acceptation**
- [ ] Le test existe et se saute proprement sans clés.
- [ ] Il passe sur la base de l'auteur.

### ☐ V3.2-86 — Les indices en combat · `S` · sans modèle IA · Modèle conseillé : Opus — **codé le 28 novembre ; reste à vérifier en jouant**

En combat, la cible d'un jet est un participant (`participant:<id>`), pas une entité : `checkClues` l'ignore, et jauger un ennemi pendant un combat ne révèle rien. Résoudre le participant vers son entité (fiche du PNJ) et appliquer la même règle que hors combat.

**Fait, 28 novembre.** `entityOfParticipant` dans `checkClues.ts` : deux lectures (le participant, son combat), seulement pour une cible de combat ; un participant d'un combat d'une autre partie ne révèle rien.

**Critères d'acceptation**
- [x] Une Perception réussie sur le participant « Bandit » révèle les facettes de sa fiche (`checkClues.test.ts`).
- [x] Un participant sans entité (créature anonyme) ne révèle rien, sans erreur.
- [ ] En jouant.

### ☐ V3.2-87 — Les indices dans le jeu à table · `M` · sans modèle IA · Modèle conseillé : Opus — **migration à valider par l'auteur**

En solo, la personne qui joue est propriétaire du monde : le serveur lit la fiche du PNJ et ne lui envoie que les facettes découvertes. À une table, une joueuse ne peut pas lire le bloc `statblock` d'un PNJ (visibilité MJ, RLS) : le serveur, qui agit en son nom, ne peut donc pas construire sa vue des indices. Il faut une fonction SQL `security definer` qui rend, pour un membre de la partie, seulement les facettes découvertes (par la table ou par elle) d'une fiche, et rien d'autre. Elle se teste comme une route (liste de contrôle de `docs/SECURITE.md`).

**Critères d'acceptation**
- [ ] Une joueuse à table voit la CA d'un PNJ que la table a découverte, et rien d'autre de sa fiche.
- [ ] Une personne hors de la partie n'obtient rien.
- [ ] Migration appliquée par l'auteur ; vérifié à table.
