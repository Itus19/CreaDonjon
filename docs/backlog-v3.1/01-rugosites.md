# Backlog V3.1 — Rugosités d'avant la refonte (V3.1-1 à 18)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md), qui tient la feuille de route et l'index des tickets. Les tickets terminés (☑) sont dans [`termines.md`](termines.md).

### ☑ V3.1-1 — `REQUIRED_BLOCKS` trop strict sur les sorts sans effet chiffré · `S` · sans modèle IA — **fait le 9 octobre, vérifié en direct le 17 novembre**

**Modèle conseillé : Sonnet** — assouplir une validation, cas bien décrits.

Constaté le 27 septembre en créant la sous-classe « Serment de vengeance »
(Paladin) et en relisant le ticket V2-N2 : sur les 339 sorts de la base SRD
5.2.1 (2024), seuls 66 portent un bloc `effects`/`scaling` — la grande
majorité des sorts (buffs, utilitaires, mise en scène pure) n'ont
légitimement **aucun** effet chiffré structuré. Le formulaire manuel « Créer
un sort » (`CreateHomebrewSpellForm.tsx`, V2-N2) le sait déjà et n'écrit pas
de bloc `effects` quand la section reste vide — mais `REQUIRED_BLOCKS`
(`src/core/rules/requiredBlocks.ts`), qui liste les blocs attendus par type
d'entrée (`entry-types.ts`), exige `effects` pour **tout** sort sans
distinction. Résultat : une fiche de sort sans effet chiffré affiche à tort
l'avertissement « bloc manquant » — déjà visible aujourd'hui sur Détection de
la magie, et ça vaudrait pour n'importe quel sort maison créé sans effet.

Le ticket V2-N2 l'avait déjà noté en passant, sans ouvrir de ticket dédié :
*« c'est plutôt `REQUIRED_BLOCKS` qui est trop strict pour les sorts, à revoir
à part »*.

**Critères**
- [x] Un sort sans effet chiffré légitime (buff, utilitaire, mise en scène)
  n'affiche plus d'avertissement de bloc manquant.
- [x] Un sort qui devrait porter un effet chiffré (jet d'attaque ou de
  sauvegarde décrit en prose) continue de le signaler s'il n'en a pas —
  la relecture ne doit pas juste supprimer `effects` de la liste sans
  y réfléchir, sous peine de perdre le signal utile sur les 66 sorts qui en
  ont besoin.
- [x] Aucune régression sur les autres types d'entrée qui utilisent
  `REQUIRED_BLOCKS` (sous-classe, don, historique…).
- [x] À vérifier en direct par l'auteur : Détection de la magie n'affiche plus d'avertissement de bloc manquant ; un sort maison à jet de sauvegarde sans effet chiffré, si. *Vérifié en direct le 17 novembre (MJ de test, variante temporaire) : aucune bannière sur Détection de la magie ; « Règle incomplète : bloc manquant — effects » sur un sort maison à JS sans effet.*

**Fait le 9 octobre.** `effects` n'est plus dans `REQUIRED_BLOCKS.spell` ;
`missingRequiredBlocks` (`src/core/rules/requiredBlocks.ts`) l'exige sous
condition : quand la description parle d'un jet de sauvegarde, d'un jet
d'attaque de sort, ou de dés de dégâts ou de soins (anglais et français). Un
bonus de dé sans dégâts ni soins (Assistance) ne le déclenche pas. Le service
(`rules.ts`) passe le texte du bloc `description`. Limite connue : une fiche
de `personal_reference` sans prose (référence de page) n'est jamais signalée.
Tests : `requiredBlocks.test.ts` (13 cas de plus) ; typecheck, lint et tests
verts.

---

### ☑ V3.1-2 — Aucun moyen d'éditer une fiche maison déjà créée · `M` · sans modèle IA — **fait le 9 octobre, vérifié en direct le 17 novembre**

**Modèle conseillé : Sonnet** — réutiliser le formulaire de création en édition, verrous déjà connus.

Constaté le 27 septembre en corrigeant le don « Chanceux » : son texte,
recopié depuis une mauvaise source, s'est révélé faux une fois la bonne page
du manuel sous les yeux. Chaque fiche de règle (`RuleEntryView.tsx`) ne
propose qu'un bouton « Supprimer » (`disable_entry`, via `/api/worlds/[slug]/
regles/[cle]/disable`) — aucun « Modifier ». La seule façon de corriger un
texte a été de supprimer la fiche puis de la recréer entièrement avec le
formulaire d'origine, en resaisissant tous les champs déjà justes. Ça marche
(la clé se libère : `disable_entry` retire la fiche de `existingKeys`, la
recréation reprend le même slug), mais c'est un détour pour ce qui devrait
être une simple correction de coquille ou de texte mal recopié.

Vaut pour les cinq formulaires de la famille « Créer un/une… » (arme,
historique, don/aptitude, sous-classe, sort) : aucun n'a d'équivalent en
édition, contrairement aux entités du wiki (`EditEntityForm`).

**Critères**
- [x] Une fiche maison (`content_origin` `user_created` ou
  `personal_reference`) propose un bouton « Modifier » qui rouvre son
  formulaire de création, pré-rempli avec les valeurs actuelles.
- [x] Valider le formulaire modifie la fiche en place (même `entry_key`,
  mêmes blocs mis à jour) — jamais une nouvelle fiche à côté de l'ancienne.
- [x] Un renvoi existant vers cette fiche (`ruleset_entry_refs`, une classe
  qui la référence comme sous-classe, un personnage qui la porte comme don)
  continue de pointer dessus après modification.
- [x] Une base officielle reste inéditable — même verrou que la création.
- [x] À vérifier en direct par l'auteur : « Modifier » sur une fiche maison de chaque type (sort, sous-classe, don, historique, arme), enregistrer, rouvrir. *Vérifié en direct le 17 novembre : les cinq types s'enregistrent en place et se rouvrent modifiés. Trouvé en chemin et corrigé : un sort maison dont l'effet porte un type de dégâts avec majuscule (« Psychic », ainsi « Piqûre mentale » dans « DnD 2024 ») ne se modifiait plus — la route refusait la valeur ; `spellFormValues` la remet en clé (`homebrewEdit.ts`, test).*

**Fait le 9 octobre.** Le bouton « Modifier » de `RuleEntryView.tsx`
rouvre, en place, le formulaire de création du type (`HomebrewEditForm.tsx`,
cinq types : sort, sous-classe, don, historique, arme ; les autres types n'ont
pas de bouton, faute de formulaire). Chaque formulaire relit la fiche par
`GET /api/rulesets/[id]/entries/[clé]` et se pré-remplit avec les fonctions
pures de `src/core/rules/homebrewEdit.ts`, testées contre les constructeurs
eux-mêmes (ce qu'un formulaire écrit, il le relit à l'identique). Enregistrer
réécrit la même clé : sort et sous-classe par leurs routes habituelles avec
`entryKey`, les trois autres par `PUT` sur la même route
(`replaceHomebrewEntry`), qui pose un `remove_block` pour chaque bloc
disparu. La clé ne change pas, donc les renvois tiennent ; le type ne change
pas (refusé) ; la sous-classe garde sa classe parente. Seule une fiche dont
l'`add_entry` vit dans la variante active est modifiable (404 sinon), et la
RPC refuse toujours une base officielle. Les déclencheurs que le formulaire
ne sait pas représenter (composés en JSON) sont conservés tels quels.
Tests : `homebrewEdit.test.ts`, `draft.test.ts` (`triggerToDraft`) ;
typecheck, lint et tests verts.

---

### ☑ V3.1-4 — Un trait d'espèce qui accorde une maîtrise au choix ne l'accorde jamais · `S`/`M` · sans modèle IA — **fait le 9 octobre, vérifié en direct le 17 novembre**

**Modèle conseillé : Sonnet** — brancher un choix déjà lu par extractSkillChoices.

Constaté le 27 septembre sur « Compétent »/Skillful, trait humain : « Vous
gagnez la maîtrise d'une compétence de votre choix. » Les classes ont déjà ce
mécanisme — `extractSkillChoices` lit `fields.proficiency_choices` et fait
apparaître un choix de compétence dans l'assistant (`resolvedRuleset.ts:435`).
La branche espèce, elle, ne lit que `mapSpeciesModifiers`/`mapProficiencies`/
`extractLanguages` sur les champs de l'espèce elle-même
(`resolvedRuleset.ts:342-351`) — jamais les `proficiency_choices` portés par
un trait individuel de l'espèce (les traits d'espèce ne sont que des
références `{index, name}` côté données SRD, la maîtrise à choisir vit sur la
fiche du trait, jamais rejointe ici). Résultat : choisir Humain n'accorde
aujourd'hui aucune maîtrise de compétence, ni choix ni maîtrise silencieuse.

Plus contenu que V3.1-3 : le mécanisme de choix existe déjà (celui des
classes), il s'agit de l'étendre aux traits d'espèce plutôt que d'en
inventer un nouveau.

**Critères**
- [x] Un trait d'espèce portant un `proficiency_choices` (compétence, langue,
  outil...) présente ce choix dans l'assistant, comme le fait déjà un choix
  de compétence de classe.
- [x] Le choix résolu produit une vraie maîtrise sur la fiche (test de
  compétence concerné, bonus de maîtrise appliqué).
- [x] Aucune régression sur les maîtrises fixes déjà accordées par une
  espèce (celles qui ne portent pas de choix).
- [x] À vérifier en direct par l'auteur : créer un Humain : Compétent propose une compétence ; avec un Guerrier, une compétence de classe déjà prise reste possible pour Compétent. *Vérifié en direct le 17 novembre (assistant de création, MJ de test) : Humain fait naître « Compétent » ; Athlétisme pris par le Guerrier reste choisissable pour Compétent (avec la mention « déjà maîtrisée… ne donnerait rien de plus »).*

**Fait le 9 octobre.** `assembleResolvedRuleset` lit le bloc `species_traits`
de l'espèce, charge ses traits en un second lot, et ajoute un choix de
compétence `<trait>.skills` (« Humain — Compétent ») pour chaque trait qui
porte un `proficiency_choices`. `extractSkillChoices` lit désormais aussi la
forme des traits 2024 : un objet unique et des index nus (« perception »),
acceptés seulement s'ils nomment une vraie compétence. Le choix passe par le
même chemin que celui des classes : grille de l'assistant, puis
`mapChosenSkillModifiers`, donc une vraie maîtrise sur la fiche. Couvre
Compétent (Humain) et Sens aiguisés (Elfe) ; aucun trait du SRD 2024 ne
porte de choix de langue ou d'outil. La grille n'a qu'un rond par
compétence : `routeSkillChoices` (`src/core/rules/skillChoiceRouting.ts`)
envoie une compétence au choix qui l'a déjà retenue, sinon au premier qui a
encore de la place. La classe passe en premier, le trait prend le reste, et
Athlétisme reste possible pour Compétent une fois les choix du Guerrier
remplis. Le mécanisme générique (ADR 0046, V3.1-116) reprendra ces choix
sous sa forme `zChoiceGrant`. Tests : `srdMapping.test.ts` (2 cas),
`skillChoiceRouting.test.ts` (5 cas) ; typecheck, lint et tests verts.

---

### ☑ V3.1-5 — Le Repos long ne déclenche aucun effet lié aux traits (Inspiration héroïque, etc.) · `M` · sans modèle IA — **fait le 9 octobre (ADR 0050), vérifié en direct le 17 novembre**

**Modèle conseillé : Sonnet** — un effet de Repos long sur le vocabulaire de déclencheurs existant.

**4 octobre — ADR 0036 §7** : V3.1-24 fait émettre `long_rest` par `takeLongRest` ; ce ticket n'a plus qu'à donner à « Ingénieux » un déclencheur `long_rest` — l'effet qui accorde l'inspiration manque au vocabulaire fermé des déclencheurs : l'ajouter s'écrit en ADR. **Dépend de** : V3.1-24.

Constaté le 27 septembre sur « Ingénieux »/Resourceful, trait humain : « Vous
gagnez l'Inspiration héroïque lorsque vous terminez un Repos long. »
L'inspiration existe bien comme ressource réelle sur la fiche (`inspiration:
number`, `src/core/schemas/runtimeState.ts:77`, réglable à la main via
`CharacterSheetHeader.tsx:519-540`), et le bouton « Repos long » appelle une
vraie action serveur (`takeLongRest`, `src/server/services/
characterActions.ts:634-693`). Mais cette fonction ne touche que PV, dés de
vie, épuisement, emplacements de sort et ressources nommées — jamais
l'inspiration — et ne vérifie nulle part si le personnage porte le trait
« resourceful ». Un personnage humain qui clique sur Repos long n'obtient
donc jamais son Inspiration héroïque.

Contrairement à V3.1-3/V3.1-4, ce n'est pas un choix à la création : c'est un
effet qui doit se déclencher en jeu, à chaque repos — plus proche des
déclencheurs (V3-A5) que de l'assistant de personnage.

**Critères**
- [x] Terminer un Repos long avec un personnage portant « Ingénieux »
  accorde l'Inspiration héroïque (si elle n'est pas déjà à son maximum,
  selon la règle 2024).
- [x] Un personnage sans ce trait n'est pas affecté.
- [x] Le mécanisme reste ouvert à d'autres effets liés au Repos long portés
  par un trait/don futur, plutôt que câblé en dur pour Ingénieux seul.
- [x] À vérifier en direct par l'auteur : un Humain sans Inspiration fait un repos long : il la gagne (journal « Inspiration héroïque : 0 → 1 ») et ses emplacements de sort reviennent. *Vérifié en direct le 17 novembre, après une correction : l'Inspiration ne venait plus. Depuis V3.1-163, un trait d'espèce n'est une aptitude de la fiche que s'il se joue ; Ingénieux (un simple déclencheur) n'était plus chargé. `loadTriggersForEntries` charge désormais les déclencheurs des traits d'une espèce (`triggerStore.ts`, test d'intégration). Ensuite : Testeuse A passe de 0 à 1 ; un mage humain récupère ses deux emplacements de niveau 1 et gagne l'Inspiration. La ligne du journal n'existe qu'en campagne (repos joué depuis la fiche hors campagne : pas de séance) — non vue.*

**Fait le 9 octobre (ADR 0050).** Le point 4 de V3.1-24 est fait du même
coup : `takeShortRest` / `takeLongRest` émettent `short_rest` / `long_rest`
après leurs effets de base. Un nouvel effet fermé, `grant_inspiration`, a été
ajouté (`triggers.ts`, rapporté « ignoré » par le tour solo). Un repos
applique lui-même les effets rendus par ses déclencheurs, sur l'état d'après
repos et en une seule écriture : `applyRestEffects`
(`src/core/rules/restEffects.ts`) applique l'inspiration (maximum 1 jusqu'à
V3.1-108), les soins et la pose ou le retrait d'une condition. Tout autre
effet, un déclencheur en échec ou rejeté, est consigné dans la note du
changement. « Ingénieux » est une donnée : `resourceful` dans
`data/srd/triggers-2024.json`. `ingest-srd` relancé le 10 octobre : 0 échec,
et `resourceful` porte bien son bloc `triggers` en base.

**Bogue trouvé en passant, corrigé** : le repos long écrivait
`spell_slots_used: {}`, et `mergeRuntimeState` fusionne clé par clé. Aucun
emplacement n'était donc rendu. `clearedSpellSlots` remet chaque niveau
consommé à 0.

Tests : `restEffects.test.ts` (7 cas), `triggers.test.ts` (1 cas). Pas de
test d'intégration ici, faute de base locale dans cette session. Typecheck,
lint et tests verts.

---

### ☑ V3.1-222 — « Rejoindre » un monde solo ouvre le jeu, pas l'atelier · `S` · sans modèle IA — **fait le 18 novembre**

**Constaté par l'auteur en allant jouer** (18 novembre) : « Rejoindre », depuis l'accueil, menait à la liste des fiches du monde — l'atelier du MJ — et non à l'écran de jeu solo.

**Pourquoi.** La carte de l'accueil calculait `href = isPlayer ? …/joueur : /m/<slug>`, et `isPlayer` vaut `myRole === "player"`. Or `getMyRolePerWorld` donne « gm » à qui possède le monde, et dit explicitement de ne jamais écraser ce rôle par celui de la campagne. En solo, l'auteur est **propriétaire du monde ET joueur de la campagne** : il tombait donc toujours côté MJ, alors que la carte affichait « SOLO ». Aucune autre porte n'existait : dans toute l'application, un seul endroit construisait un lien vers `/joueur`, cette carte.

**Fait.** Un monde en mode `solo` mène désormais à `…/joueur/solo` quel que soit le rôle. Et comme ce clic ne mène plus à l'atelier, le rail joueur gagne une entrée **« Atelier »** (vers `/m/<slug>`, règles, fiches et outils du MJ), affichée seulement à qui administre le monde — `isWorldAdmin`, lu dans la même vague que le reste du layout (docs/CABLAGE.md C1), jamais une requête de plus après l'affichage.

**Vérifié au navigateur** (monde solo d'un compte de test, qui en est propriétaire) : « Rejoindre » pointe sur `/m/<slug>/joueur/solo`, l'écran de jeu s'ouvre avec sa scène et sa barre d'intention, et « Atelier » ramène à `/m/<slug>`.

---

### ☐ V3.1-229 — Un test sauté ne se voit pas · `S` · sans modèle IA — **prêt (Opus)**

**Constaté deux fois le 18 novembre, à huit heures d'intervalle.**
- Le matin : trois suites d'intégration (`rollWindowsSelf`, `srdReactions`, `soloReaction`) se sautaient depuis des semaines faute de `ENGINE_SIGNING_KEY`. Personne ne l'avait remarqué — la suite était « verte ».
- Le soir : quatre tests d'IA (`openAiCompatible`, `soloNarration` ×2, `soloGmQuestion`) se sont évanouis d'une exécution à l'autre, parce que le serveur local avait cessé de répondre entre-temps. La suite est restée verte, avec « 5 skipped » dans une ligne de bilan que personne ne lit.

**Le mécanisme est bon, c'est son silence qui ne l'est pas.** Sauter quand le fournisseur est absent est le bon comportement (une suite ne doit pas rougir parce qu'un modèle n'est pas lancé). Mais un test sauté **ne vérifie rien**, et rien ne le rappelle : le `console.warn` de chaque fichier se noie dans quinze minutes de sortie.

**À faire.** Rendre le saut visible là où on le lira : un récapitulatif en fin de suite (« 5 tests sautés : fournisseur d'IA injoignable, seconde clé moteur absente »), ou un script `npm run test:sautes` qui liste les conditions non remplies et ce qu'elles couvrent. Décider aussi si un saut doit **échouer** en intégration continue, où tout devrait être posé.

**Critères d'acceptation**
- [ ] Après une suite, on sait d'un coup d'œil ce qui n'a pas été vérifié, et pourquoi.
- [ ] Le cas « la variable est posée mais le service ne répond pas » se distingue de « rien n'est configuré ».

---

### ☐ V3.1-228 — Le registre des migrations ne dit plus la vérité · `M` · sans modèle IA — **prêt (Opus)**

**Constaté le 18 novembre**, en préparant la table de V3.1-224. `supabase migration list --remote` annonce **dix migrations locales absentes de la production** — or leurs tables et colonnes **existent bel et bien** en base (`save_requests`, `availability_requests`, `combat_participants.pos_x`, vérifiés un par un). Elles ont donc été appliquées **à la main**, par l'éditeur SQL, sans être inscrites au registre `supabase_migrations`.

Les dix : `20260929120000` (availability_requests), `20260929130000` (native_password_accounts), `20261001120000`, `20261001130000`, `20261001140000`, `20261010120000` (combats_gm_only), `20261010130000`, `20261102130000` (session_journal_devoir), `20261107160000`, `20261109150000`.

**Trois conséquences, dont une sérieuse.**
1. **`supabase db push` est inutilisable** : il tenterait de rejouer dix scripts déjà passés. Au mieux des erreurs « already exists », au pire des effets de bord sur ceux qui ne sont pas idempotents.
2. **Un doublon de numéro** : `20261108120000_combat_positions.sql` et `20261108120000_player_save_requests.sql` portent le **même timestamp**. Le registre ne retient que le numéro : l'un est marqué appliqué, l'autre jamais, et la CLI ne pourra jamais distinguer les deux. Le second est passé à la main, lui aussi.
3. **On ne sait plus ce qui est déployé** sans vérifier table par table, ce qui est exactement ce que le registre existe pour éviter.

**À faire.** Décider, puis s'y tenir : soit on réaligne le registre (insérer les dix numéros dans `supabase_migrations.schema_migrations` après avoir vérifié chaque objet en base), soit on assume l'application manuelle et on l'écrit dans `docs/SCHEMA.md` comme procédure. Dans les deux cas, renommer la migration en doublon (règle absolue 14 : une migration appliquée ne se modifie pas — mais celle-ci ne l'a jamais été sous ce nom).

**Critères d'acceptation**
- [ ] `supabase migration list --remote` ne montre plus d'écart, ou la procédure manuelle est écrite et suivie.
- [ ] Plus aucun doublon de numéro dans `supabase/migrations/`.

---

### ☐ V3.1-225 — Le solo ne peut PAS faire apparaître un figurant · `M` · **avec modèle IA** — **prêt (Opus)**

**Constaté en jouant, le 18 novembre.** L'auteur entre dans une auberge ; le modèle décrit « plusieurs silhouettes », « un membre du personnel », « les membres du personnel derrière le comptoir ». Aucun n'existe : la scène ne contient que le PJ, et l'onglet « Présents » le dit. Son mot : « le moteur n'a pas l'air d'être branché ».

**Il a raison, et la cause est précise.** V3-C2 prévoit qu'un personnage incident soit **tiré par le générateur**, jamais inventé par le modèle (`narrateSoloTurn` : `new_character` → `drawSketchForScene`). Or ce tirage passe par le générateur de clé `pnj`, qui vit dans une entité `generateur` que **seule la route des fenêtres d'outils MJ crée** (`ensureGeneratorToolsEntity`, appelée par `app/api/worlds/[slug]/mj/[tool]/window`). En solo, on ne va jamais côté MJ : l'entité n'existe pas, le tirage échoue, et `narrateSoloTurn` « laisse `first` tel quel » — la narration garde ses figurants fantômes. Pire : même créée, l'entité naît avec des blocs `generator` **vides** ; un tirage y rendrait « nom manquant au tirage ».

Vérifié en base le 18 novembre : ni « Solo test Gab » ni le monde de test ne portent d'entité `generateur`.

**Conséquence** : la règle « l'IA narre, le code arbitre » est tenue pour les dés, pas pour le peuplement du monde. Le modèle meuble, et rien ne le rattrape.

**À faire.**
- Garantir le générateur de PNJ là où le solo en dépend : l'entité ET des tables non vides (un jeu de départ, ou un tirage de secours sans table).
- Ne plus avaler l'échec : un tirage impossible se journalise et se voit (lié à V3.1-223).
- Décider ce que fait la narration quand aucun figurant ne peut être tiré : se taire sur les présents plutôt que les inventer.

**Critères d'acceptation**
- [ ] Dans un monde neuf, un tour qui appelle un personnage incident produit une esquisse réelle, visible dans « Présents ».
- [ ] Sans générateur possible, le tour reste joué, l'échec est visible, et la narration n'invente personne.

---

### ☐ V3.1-226 — Une question posée DANS la fiction n'est pas une question au MJ · `S` · sans modèle IA — **prêt (Sonnet)**

**Constaté en jouant, le 18 novembre.** « Y a-t-il quelqu'un qui est responsable du service ? » s'adresse à un PNJ, dans le temps de jeu. L'app met en avant le bouton « MJ », c'est-à-dire la question hors-jeu.

**Cause** : `looksLikeQuestion` (`src/core/rules/intent.ts`) rend `true` dès que le texte finit par « ? », avant même de regarder le lexique. Rien n'est rerouté — les deux boutons restent cliquables, et c'est heureux — mais le bouton mis en avant est le mauvais, et qui s'y fie envoie sa réplique hors du temps de jeu.

**À faire.** Distinguer la parole adressée au monde de la question adressée au MJ : des guillemets, « je demande à … », un verbe de parole à la première personne, un destinataire présent dans la scène → c'est une action. Garder « MJ » devant pour le hors-fiction (« est-ce que je peux… », « que sais-je de… »). Le « ? » seul ne décide de rien.

**Critères d'acceptation**
- [ ] « Je dis : "y a-t-il un responsable ?" » et « je demande à Mabelle si… » mettent « Jouer » devant (tests du noyau).
- [ ] « est-ce que je peux escalader ce mur ? » garde « MJ » devant.

---

### ☐ V3.1-227 — « Présents » doit montrer les inconnus, avec ce qu'on en voit · `M` · sans modèle IA — **à concevoir (Opus)**

**Demandé par l'auteur le 18 novembre**, en voyant la contradiction : le fil parle de gens, l'onglet « Présents » n'affiche que lui.

Sa proposition, à prendre telle quelle : un présent inconnu apparaît comme **« inconnu »**, avec sa fiche de wiki, où seule la **description physique** est lisible — le reste (nom véritable, intentions, mécanique) reste caché jusqu'à ce qu'on le découvre. C'est le prolongement naturel des découvertes (V3-C4) et des esquisses (V3-C2) : on sait qu'il y a quelqu'un, on ne sait pas encore qui.

**À trancher par l'ADR** : ce qu'un présent non découvert montre et cache (la visibilité joue déjà par bloc, règle absolue 5 : le filtrage se fait côté serveur) ; si une esquisse non ancrée a droit à une fiche ; comment on passe d'« inconnu » à son nom ; ce que le contexte du modèle reçoit de lui (règle 11 : borné par l'audience).

**Dépend de** V3.1-225 : tant qu'aucun figurant n'est tiré, il n'y a rien à lister.

**Critères d'acceptation (de la conception)**
- [ ] ADR écrit ; tickets prêts découpés.

---

### ☑ V3.1-224 — L'IA, un réglage du COMPTE : sa machine ou sa clé · `L` · sans modèle IA — **conçu et fait le 18 novembre (ADR 0103)**

**Demandé par l'auteur le 18 novembre**, en découvrant que le site en ligne ne peut pas joindre son LM Studio (V3.1-223). Direction voulue : **chacun joue sur ses propres ressources d'IA**, déclarées sur son compte — soit un **lien vers sa machine** (tunnel vers son fournisseur local), soit une **clé d'API** chez un fournisseur distant (Claude, OpenAI…). Personne ne consomme celles d'un autre, et l'hébergeur ne paie pour personne.

La spec l'annonce déjà à demi-mot : « le choix du modèle est un réglage du monde ou de l'utilisateur, pas une constante » (`specs/cible-locale-et-ia.md`). Ce ticket en fait un réglage de compte, avec ce que cela suppose.

**Ce que l'ADR doit trancher — les trois points durs, aucun n'est cosmétique.**
- **Des secrets par compte.** Une clé d'API est un secret d'utilisateur en base. Règle absolue 1 : jamais derrière `NEXT_PUBLIC_`, jamais renvoyée au client, pas même à son propriétaire après saisie (on affiche « ••••, posée le … », jamais la valeur). Chiffrement au repos, RLS en refus par défaut, et le service seul la déchiffre.
- **Une URL fournie par l'utilisateur, c'est une SSRF.** Un « lien vers ma machine » fait appeler par NOTRE serveur une adresse que l'utilisateur choisit : il faut une liste blanche de schémas, le refus des adresses privées et de `localhost` côté serveur hébergé, aucune redirection suivie, un délai court et une taille de réponse bornée. C'est le point le plus risqué du ticket.
- **Qui paie quoi, et qui le voit.** `ai_usage_log` existe déjà et s'écrit à chaque appel (règle 13) ; il faut le rattacher au fournisseur employé, et montrer à chacun sa consommation. Un compte sans fournisseur joue **sans IA** — le mode solo doit le rester (`docs/backlog-v3/00-cadre.md` §3).

**À prévoir aussi.** L'adaptateur existe (`AiProvider`, `openAiCompatible`, et `AI_LOCAL_API_KEY` depuis le 18 novembre) : brancher un fournisseur par utilisateur ne demande pas de réécrire les appels, qui restent confinés à `src/server/ai/` (règle 12). Le collage assisté sur du contenu d'ouvrage reste réservé à un fournisseur **local** (`specs/cible-locale-et-ia.md` : avec un distant, le texte quitte la machine).

**Critères d'acceptation (de la conception)**
- [x] ADR écrit : forme du réglage, stockage du secret, défense contre la SSRF, rattachement de l'usage, comportement sans fournisseur.
- [x] ~~Tickets prêts découpés~~ — fait d'un bloc le même jour plutôt que découpé.

*Fait le 18 novembre ([ADR 0103](../adr/0103-le-fournisseur-d-ia-de-chaque-compte.md)).*

- **La table** `ai_providers`, une ligne par compte, RLS `user_id = auth.uid()` sur les **quatre** opérations : c'est la seule table du schéma dont aucune politique ne parle d'un monde ni d'une campagne (`docs/SCHEMA.md` §27).
- **Le secret** est chiffré en AES-256-GCM **avant de quitter le processus** (`src/server/ai/secrets.ts`, 7 tests) : la requête SQL ne le voit pas. Il ne redescend **jamais** vers un client, pas même son propriétaire — l'écran dit « une clé est posée depuis le … », le champ reste vide, et la changer veut dire la retaper.
- **La SSRF** : `verifierUrlFournisseur` (noyau pur, 8 tests) refuse les schémas autres que `http(s)`, les identifiants dans l'adresse, le clair hors machine locale, et les plages privées en production — `169.254.169.254` nommément. Revérifiée **avant chaque appel**, pas seulement à l'enregistrement. Limite assumée et écrite : le *DNS rebinding* passerait.
- **La cascade** (`resolveProviderForUser`) : le fournisseur du compte, sinon celui de l'environnement, sinon **aucun** — et le tour reste joué, muet. Les six routes qui construisaient leur fournisseur depuis l'environnement passent désormais par là ; plus aucune ne le fait elle-même (règle absolue 12).
- **L'écran** : une section « Mon fournisseur d'IA » dans la page Compte, qui dit aussi ce qui quitte la machine avec un fournisseur distant.

Vérifié : `aiProviders.integration.test.ts` (6 cas — la RLS dans les deux sens, l'écriture au nom d'un autre refusée, l'adresse devenue invalide et le secret indéchiffrable qui retombent sur « pas de fournisseur »), et au navigateur : `file://` refusé, identifiants dans l'URL refusés, enregistrement accepté, et **le secret illisible en base** (`v1:…`, vérifié ligne par ligne).

*Reste* : `ai_usage_log` ne dit pas encore **quel** fournisseur a servi (prévu par l'ADR) ; et `AI_SECRETS_KEY` doit être posée en production avant que quiconque y enregistre une clé.

---

### ☐ V3.1-223 — Un tour sans narration doit le dire · `S` · sans modèle IA — **prêt (Opus)**

**Constaté par l'auteur le 18 novembre**, en voulant jouer ses séances : ses tours partaient, s'inscrivaient au fil avec leurs faits… et restaient muets. Il jouait sur **le site en ligne**, où `AI_LOCAL_BASE_URL` vaut `http://localhost:1234/v1` : ce « localhost » est celui du serveur Vercel, jamais la machine du joueur. Son LM Studio était donc injoignable, et la narration — best-effort par conception (`specs/cible-locale-et-ia.md` §4) — échouait en silence.

**Le défaut n'est pas l'absence de narration, c'est le silence.** Les trois routes du tour avalent l'échec dans un `catch` qui ne parle qu'à la console du serveur ; le joueur, lui, voit un tour incomplet sans savoir si c'est un bug, une lenteur, ou sa configuration.

**À faire.** Quand `narrerTourSoloSansFaillir` ne rend rien, le dire à l'écran : une mention discrète sous le tour (« narration indisponible — le fournisseur d'IA n'a pas répondu »), jamais une erreur bloquante, jamais un tour perdu. Distinguer si possible « aucun fournisseur configuré » de « appel échoué ». Le mode solo doit rester jouable sans IA (`docs/backlog-v3/00-cadre.md` §3) : cette mention est la preuve visible que c'est le cas, pas un avertissement anxiogène.

**Critères d'acceptation**
- [ ] Un tour joué sans fournisseur joignable affiche sa mention, garde ses faits, et ne casse rien.
- [ ] Vérifié à l'écran, ordinateur et 390 px.

---

### ☐ V3.1-12 — « Voir comme » accessible aux MJ de campagne, pas seulement au superadmin · `M` · sans modèle IA — **fait le 9 octobre (ADR 0051, 0052) ; vérifié en direct en MJ le 19 octobre, reste le superadmin**

**Modèle conseillé : Opus** — « voir comme » : usurpation d'identité, portée de sécurité.

Constaté le 28 septembre, en discutant de V3.1-10 : « voir comme »
(`startViewAs`, `src/server/services/viewAs.ts:24`) est aujourd'hui réservé
au superadmin (`isSuperadmin`), utilisable uniquement depuis la section
Administration (`AdminPanel.tsx`). Demandé : un MJ de campagne doit pouvoir
l'utiliser sur ses propres joueuses, depuis les options MJ du monde —
concrètement la liste « Membres » déjà affichée dans `CampaignDetail.tsx:163`
(Gestion de campagne, déjà gardée par `canManage`), à côté du bouton
« Révoquer » qui y est déjà.

**Décision**
- **Autorisation** : en plus du superadmin (portée globale, inchangée), un
  appelant peut démarrer « voir comme » sur `targetUserId` s'il est MJ de la
  campagne dont la cible est membre — vérifié côté serveur avec le
  `campaignId` transmis (jamais « est-il GM de N'IMPORTE quelle campagne
  contenant cette cible », toujours scopé à la campagne depuis laquelle le
  bouton est cliqué). Même garde que `canManage`/`isWorldAdmin` déjà utilisé
  ailleurs dans cet écran.
- **Garde-fou sur la cible, à redéfinir** : `mintSessionForInvitedAccount`
  (`accountProvisioning.ts:227`) refuse aujourd'hui tout compte qui n'a
  jamais réclamé une ligne `campaign_invites` — invariant qui ne tient plus
  une fois les liens joueur réutilisables et les comptes créés en
  libre-service (V3.1-10). Le vrai invariant à garder : ne jamais permettre
  « voir comme » sur un compte **ordinaire** (email réel, `/signup`/`/login`)
  — seulement sur un compte « tag » (identité interne à l'app, jamais un
  email personnel externe). Peut se coder dès aujourd'hui sur le signal déjà
  disponible (email synthétique), et se réaligne naturellement une fois
  V3.1-10 posé.
- **9 octobre — faille, ADR 0051.** Le raisonnement ci-dessous était faux :
  httpOnly empêche le JavaScript de lire le cookie, pas quelqu'un d'en
  envoyer un forgé. Le cookie portait un identifiant, donc n'importe qui
  connaissant l'identifiant du superadmin pouvait se connecter à son compte,
  et retirer la condition superadmin l'aurait permis pour tout compte.
  Corrigé : le cookie porte désormais le jeton de rafraîchissement de la
  session d'origine, qui ne se forge pas. L'étape 3 est faite par ce
  correctif.
- **Retour (`returnFromViewAs`)** : le contrôle actuel
  (`isSuperadminByIdViaServiceRole`) rejetterait à tort un MJ ordinaire qui
  revient de son propre « voir comme ». La vraie garantie de sécurité est
  déjà le cookie httpOnly posé par le serveur au démarrage (jamais
  falsifiable côté client, jamais lu ni écrit ailleurs) — le contrôle au
  retour se limite à vérifier que le compte d'origine existe toujours, plus
  de condition superadmin.

Indépendant de V3.1-10 : peut se faire avant, pendant ou après.

**Étapes**
1. `startViewAs` : accepte un `campaignId` optionnel ; si fourni et que
   l'appelant est MJ de cette campagne et la cible en est membre, autorise —
   sinon retombe sur la vérification superadmin actuelle.
2. Redéfinir le garde-fou de `mintSessionForInvitedAccount` : refuse un
   compte ordinaire (email réel), plus « jamais réclamé par un lien ».
3. `returnFromViewAs` : retire la condition superadmin, garde uniquement
   l'existence du compte d'origine.
4. Bouton « Voir comme » sur chaque ligne de `data.members` dans
   `CampaignDetail.tsx`, visible seulement si `canManage`.

**Critères**
- [x] Un MJ (non superadmin) peut lancer « voir comme » sur une joueuse de
  sa propre campagne, depuis la liste des membres de « Gestion de
  campagne ».
- [x] Un MJ ne peut pas lancer « voir comme » sur un compte qui n'est pas
  membre d'une campagne qu'il gère.
- [x] « Voir comme » reste impossible sur un compte ordinaire (email réel),
  qu'on soit MJ ou superadmin.
- [x] Le superadmin garde sa portée actuelle (n'importe quel compte « tag »,
  n'importe où).
- [x] Revenir de « voir comme » fonctionne identiquement, que ce soit un MJ
  ou le superadmin qui l'ait démarré.
- [ ] À vérifier en direct par l'auteur : « Voir comme » depuis Gestion de campagne en MJ, puis depuis Administration en superadmin ; revenir à son compte les deux fois.

**Fait le 9 octobre.** En le préparant, deux failles ont été trouvées et
corrigées d'abord, chacune dans son commit :

- **ADR 0051.** Le retour de « voir comme » faisait confiance à un
  identifiant dans un cookie. Il reprend désormais la session d'origine par
  son jeton de rafraîchissement. Cela couvre l'étape 3.
- **ADR 0052.** « Forcer une réinitialisation » marchait sur n'importe quel
  compte pour n'importe quel administrateur de monde. La règle pure
  `canActOnMemberAccount` décide maintenant pour les deux gestes.

Ensuite :

- **Étape 1.** `startViewAs` accepte `campaignId` : un MJ agit sur un compte
  « tag » membre de cette campagne ; sans campagne, superadmin seulement.
- **Étape 2.** `mintSessionForInvitedAccount` refuse un compte ordinaire,
  reconnu à son email réel, au lieu de « jamais réclamé par un lien ».
- **Étape 4.** « Voir comme » apparaît dans le menu ⋮ de chaque membre
  (`CampaignDetail.tsx`) ; planche Navigation mise à jour.

Tests : `memberAccountActions.test.ts` (9 cas). Non vérifié en navigateur
dans cette session, faute de base. **À contrôler par l'auteur** : démarrer et
revenir, en MJ puis en superadmin.

**19 octobre, vérifié en direct en MJ** (avec V3.1-54) : Testeur MJ, depuis
la carte de Testeuse A, démarre « Voir comme », confirme, voit le bandeau
« Vous visualisez comme Testeuse A », revient à son compte (200) et retrouve
la gestion de campagne. **Reste** : le même aller-retour en superadmin,
depuis l'Administration (aucun compte superadmin de test).
Deux constats, **corrigés le jour même** (ADR 0051, complément) :
- abandonner sur la page « Confirmer » puis cliquer « Revenir à mon compte »
  déconnectait : la session courante était encore celle du MJ, le retour la
  fermait, ce qui révoquait le jeton mis de côté. Le retour reconnaît
  désormais la session d'origine (cookie `view_as_return_session`) et ne la
  ferme pas ;
- l'entrée apparaissait sur la ligne du MJ lui-même : le serveur refuse
  « Voir comme » sur soi (`self`), l'écran ne la propose plus (`viewerId`).
Les deux vérifiés en direct (`viewAs.test.ts`, 6 cas).

---

### ☐ V3.1-13 — Sous-classes manquantes pour les classes des 4 joueuses actives · `M` · sans modèle IA

**Modèle conseillé : Sonnet** — saisie de règles d'après les livres de l'auteur.

Différent des autres tickets de ce backlog : pas un trou dans l'outil, un
manque de **contenu** — relevé le 28 septembre en comparant les sous-classes
présentes sur Valdoria à la liste complète du Manuel des joueurs 2024, pour
les classes des 4 joueuses de la table (Roublard, Barde, Druide, Guerrier,
Paladin). Le SRD gratuit n'apporte qu'une seule sous-classe par classe (deux
pour le Roublard) ; le reste vient du livre payant et doit être saisi à la
main, comme « Serment de vengeance ».

| Classe | Déjà présentes | Manquantes |
|---|---|---|
| Roublard | Voleur, Arnaqueur arcanique | Assassin, Sabre-psychique (Soulknife) |
| Barde | Collège du Savoir | Collège de la Danse, Collège du Glamour, Collège de la Vaillance |
| Druide | Cercle de la Terre | Cercle de la Lune, Cercle de la Mer, Cercle des Étoiles |
| Guerrier | Champion | Maître de guerre (Battle Master), Chevalier occulte (Eldritch Knight), Guerrier psi (Psi Warrior) |
| Paladin | Serment de Dévotion, Serment de vengeance | Serment des Anciens, Serment de Gloire |

Soit 11 sous-classes à saisir. Chacune suit le même chemin que Serment de
vengeance : le texte vient du manuel de l'auteur (jamais deviné, jamais
recopié depuis la mémoire d'un modèle), passé par le formulaire « Créer une
sous-classe » de la variante active.

**À savoir avant de saisir, pas un frein** : tant que V3.1-7 n'est pas pris,
ces aptitudes resteront purement descriptives, comme toutes les sous-classes
du jeu aujourd'hui — cohérent, pas un recul propre à ce contenu.

**Critères**
- [ ] Les 11 sous-classes listées existent sur Valdoria, chacune rattachée à
  sa classe parente et sélectionnable à l'assistant de création de
  personnage au bon niveau.
- [ ] Chaque fiche recopie fidèlement le texte du manuel de l'auteur (aucune
  aptitude devinée) — l'auteur fournit le texte, capture ou photo à l'appui,
  comme pour Serment de vengeance.
- [x] Une sous-classe saisie ici n'est pas bloquée par l'avertissement de
  bloc manquant (V3.1-1, si toujours ouvert) ni par un défaut d'édition
  (V3.1-2, si toujours ouvert) — dépendances à vérifier au moment de
  saisir, pas à résoudre avant.

**9 octobre.** Le troisième critère est rempli : V3.1-1 et V3.1-2 sont
faits. Une sous-classe saisie n'affiche plus d'avertissement de bloc, et elle
se corrige en place par « Modifier ». **Attend l'auteur** : le texte des 11
sous-classes, une par une, depuis le manuel. Il passe par le formulaire
« Créer une sous-classe » ou, sur demande, par Claude dans la base, jamais
dans un fichier suivi par Git.

---

### ☐ V3.1-17 — Un catalogue d'interface visuel, et une charte qui y renvoie · `M` · sans modèle IA — **fait le 1ᵉʳ octobre ; reste une vérification en direct**

**Modèle conseillé : Sonnet** — documentation et planches.

**Constat.** Les défauts d'esthétique revenaient sur des éléments que la charte
ne décrivait pas (l'ascenseur de la grille du calendrier, la bulle de date du
navigateur, le sélecteur de PJ qui se chevauchait) ou qu'on réécrivait à la main
sans voir l'original. Une charte en mots ne suffit pas : il faut voir l'élément,
ses états et ses animations, et y puiser pour créer les suivants. L'auteur avait
amorcé `CHARTE-UI-verre-mineral.md` dans une autre session dans ce but.

**Ce qui est fait** (ADR 0033) :
- **Le catalogue** — canevas https://claude.ai/artifact/LcTPxvcvSbg1TdMqyrJD3G,
  sources dans `docs/catalogue/` (neuf planches `.dc.html` + `canvas.json`).
  Deux rangées : les briques (1 Fondations, 2 Boutons et champs, 3 Onglets,
  puces, menus, 4 Surfaces et retours, 5 Éléments d'écran, 6 Fiche de
  personnage, 7 Mode solo), puis les éléments d'écran riches (8 Wiki visuel,
  9 Outils du MJ). Chaque section : la règle, le composant à utiliser, la
  transition réelle, les états qui existent côte à côte, un exemplaire vivant
  (« Rejouer » pour les animations), un sélecteur de mode (sombre, tamisé,
  doux, clair, contraste élevé).
- **Aucun style recopié** : `scripts/catalogue/build-css.mjs` compile
  `app/globals.css` avec les planches comme source et dérive `.st-hover`,
  `.st-focus`, `.st-active` des vraies règles `:hover`, `:focus-visible`,
  `:active`. `app/globals.css` exclut `docs/` du scan Tailwind
  (`@source not "../docs"`) pour que la feuille de l'application ne gonfle pas.
- **La charte** (`docs/CHARTE-UI.md`) gagne trois sections : §9 l'index des
  planches et les écarts relevés, §10 icônes et glyphes (jamais d'émoji), §11
  la coquille — les sections 0 à 16 de « verre minéral », vérifiées contre le
  code. Deux cases de plus à la vérification du §6. **Un seul fichier fait foi** :
  « verre minéral » n'entre pas dans le dépôt ; ses propositions de refonte
  (§17-18) deviennent V3.1-19.
- **`CLAUDE.md`** : le catalogue dans le tableau des documents, et la règle
  « avant de créer un élément, cherche-le ; un élément nouveau ou modifié met sa
  planche à jour ; jamais d'émoji ».
- **Mode d'emploi** : `docs/catalogue/README.md` (anatomie d'une section,
  reconstruire le CSS, publier, limite de 8 000 px par planche).

**Méthode, et ce qu'elle a appris.** Chaque planche a été écrite à partir des
classes réelles des composants (relevées fichier par fichier), puis vérifiée
dans un rendu local avec le vrai CSS. Deux reprises en route : une première
version tenait sur une seule page et était coupée après 8 000 px (limite du
canevas) ; une première passe n'avait parcouru que les composants partagés et
la coquille — l'auteur a signalé l'oubli du bouclier de CA, des jauges du mode
solo et des boutons de jet. L'inventaire complet a ajouté les planches 6 à 9.

**Écarts relevés** (charte §9) : émojis (→ V3.1-18) ; `MissingBlocksBanner` en
ambre Tailwind en dur ; deux règles de couleur pour une barre qui baisse
(accent/danger sur la fiche, accent/terracotta/danger sur l'initiative et les
rencontres) ; aucun état « appuyé » propre sur les boutons.

**Au passage, sur « verre minéral »** : la radio du rail reste visible quand le
rail se replie (seul le libellé disparaît), avec le point d'activité au centre
de l'icône, vert en lecture, rouge à l'arrêt — corrigé dans l'esquisse (MJ et
joueur, desktop et tablette).

**Critères d'acceptation**
- [x] Chaque élément d'interface réutilisable a sa section, avec les états qui existent dans le code.
- [x] Le style vient du CSS compilé, jamais d'une copie (`build-css.mjs` produit la feuille publiée à l'octet près).
- [x] La charte renvoie au catalogue ; `CLAUDE.md` impose de le tenir à jour.
- [ ] À vérifier par l'auteur : les exemplaires vivants et le sélecteur de mode dans le canevas.

---

### ☑ V3.1-18 — Retirer les émojis de l'interface · `S` · sans modèle IA — **fait le 1ᵉʳ octobre, vérifié en direct le 17 novembre**

**Modèle conseillé : Sonnet** — remplacements mécaniques.

**Constat** (relevé pour V3.1-17) : des émojis en couleur, qui ne suivent ni
les jetons ni les modes et changent d'aspect selon l'appareil.

| Fichier | Émojis | Remplacement proposé |
|---|---|---|
| `components/shell/InitiativeTracker.tsx` | 🎲 (relancer l'initiative) | `DieIcon sides={20}` |
| même fichier | 🧑 ❓ 💀 devant le nom (entité, personnalisé, monstre) | trois icônes au trait du même style que `EyeIcon` |
| `components/blocks/characterCreatorSteps/SpellSelectionStep.tsx` | 👁 | `EyeIcon` |

Les glyphes de texte (`✕ ✓ ☰ ☐ ☑ ✦`, ~20 occurrences) restent : la charte §10
les autorise.

**Correction du relevé** : les trois ⚙ signalés dans les pages MJ
(Personnalisation, Publication, Règles actives) ne sont que dans des
commentaires de code (« gomme le bouton ⚙ ») — rien ne s'affiche. Le premier
relevé ignorait les lignes `//` et `*`, pas celles qui ouvrent un `/**`.

**Ce qui est fait** :
- Initiative : relancer = `DieIcon sides={20}`, avec un `aria-label` qui nomme
  le combattant. Devant le nom, `ParticipantKindIcon` (dans le même fichier :
  un seul usage, pas de composant partagé — règle des trois) : silhouette pour
  une entité du monde, point d'interrogation cerclé pour un combattant
  improvisé, crâne au trait pour un monstre. Trait 1,8, `currentColor`,
  `text-ink-muted`, `role="img"` + `title` pour en dire le sens.
- Sélection des sorts : « En savoir plus » = `EyeIcon` ouvert (▴ quand déplié,
  inchangé).
- Planche 9 du catalogue mise à jour et republiée ; charte §9 mise à jour.

**Le circuit tient** : corriger le composant, reporter les mêmes tracés dans la
planche (aucune classe nouvelle : le CSS du catalogue est resté identique, pas
besoin de le republier), mettre à jour la charte. Le README du catalogue a
suffi.

**Critères d'acceptation**
- [x] Plus aucun émoji affiché dans `components/` ni `app/` (il en reste dans des commentaires).
- [x] Les icônes nouvelles sont au trait, `currentColor`, avec un `aria-label` sur les boutons qui n'ont qu'elles.
- [x] Planche 9 (Suivi d'initiative) mise à jour, la mention « écart à la charte » retirée ; §9 de la charte mis à jour.
- [x] À vérifier en direct : les trois icônes dans un vrai combat, aux quatre modes. *Vérifié en direct le 17 novembre : un combat avec une entité, un combattant improvisé et un bloc de statistiques — les trois icônes au trait (`IconeGenre.tsx`, depuis la refonte de l'initiative) suivent la couleur du texte en sombre, tamisé, doux et clair. Aucun émoji dans `components/` ni `app/` (seul ♪, glyphe de texte). Le dé de relance n'existe plus sous cette forme dans le suivi refait.*

C'est le premier ticket qui suit la règle de V3.1-17 : il sert aussi à vérifier
que le circuit « corriger le composant → mettre à jour la planche → mettre à
jour la charte » tient.
