# Backlog V3.1 — Tickets terminés (☑)

Partie de [`BACKLOG_V3.1.md`](../BACKLOG_V3.1.md). Faits, ou conçus et découpés en tickets d'implémentation. Rarement à relire : les décisions qu'ils portent vivent dans `docs/adr/`.

### ☑ V3.1-3 — Les dons à choix (Initié à la magie, etc.) n'ont aucune UI de choix · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) ; implémentation : V3.1-116 à 119**

**Modèle conseillé : Opus** — mécanisme générique de choix pour les dons, partagé avec V3.1-6 et V3.1-7.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Constaté le 27 septembre en accordant « Initié à la magie » via l'historique
« Guide ». Le don s'affiche sur la fiche en texte descriptif, mais l'assistant
de création de personnage ne propose **aucune étape** pour résoudre ses
choix (classe de sorts, deux sorts mineurs, un sort de 1er niveau) — et ce
n'est pas propre au contenu maison : **aucun don du jeu, même officiel,
n'a cette UI aujourd'hui.** `CharacterCreatorWizard.tsx` ne liste aucune étape
de type « FeatsStep » ; `AsiStep.tsx` (amélioration de caractéristique) ne
contient aucune logique de don ; la résolution des dons
(`resolvedRuleset.ts`) ne gère qu'un bloc `modifiers` générique (bonus fixes),
sans mécanisme de sous-choix comparable à celui déjà construit pour les
langues d'un historique (`RemainingChoice`, `resolvedRuleset.ts`).

Déjà noté comme hors périmètre, sans ticket dédié : *« Hors périmètre, à ne
pas faire ici : choix de don (nécessite une UI de création/montée de niveau,
gros morceau à part)... »* (`docs/BACKLOG_V1.md:619`).

**Taille assumée au-delà du format habituel de ce backlog** (voir l'intro :
`S`/`M` presque toujours) — à traiter comme un signal qu'il migre vers V2 ou
V3 le jour où il est pris, pas comme un ticket à boucler sur une session.

**Critères**
- [ ] Un don qui accorde un choix (classe de sorts, sorts mineurs, sort de
  niveau) présente ce choix dans l'assistant de création de personnage, au
  moment où le don est accordé (historique, don libre, etc.).
- [ ] Le choix résolu est appliqué mécaniquement — les sorts choisis
  deviennent réellement disponibles sur la fiche (onglet Actions), pas
  seulement consignés en texte.
- [ ] Le mécanisme est générique (comme `RemainingChoice` pour les langues),
  pas câblé au cas par cas pour Initié à la magie seul — un deuxième don à
  choix (ex. Chanceux répétable, un futur don maison) doit pouvoir le
  réutiliser sans nouveau code de choix.
- [ ] Un don sans choix (la majorité) continue de s'afficher tel quel, sans
  étape supplémentaire imposée à l'assistant.

**Vaut aussi pour un don accordé par une espèce** (constaté le 27 septembre
sur « Polyvalent »/Versatile, trait humain — don d'origine au choix) : la
branche qui résout l'espèce (`resolvedRuleset.ts:342-351`) ne gère aucun don
du tout, contrairement à l'historique qui en accorde au moins un fixe
(`extractBackgroundFeat`). Un don accordé par une espèce est donc un cran
plus creux que le cas déjà décrit ci-dessus — même critère, pas de ticket
séparé.

---

### ☑ V3.1-6 — Aucun mécanisme générique pour les traits d'espèce à choix · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) ; implémentation : V3.1-116 à 119**

**Modèle conseillé : Opus** — mécanisme générique des traits à choix, cinq formes de choix.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Suite à V3.1-3/V3.1-4 (Humain seulement) : relevé le 27 septembre sur les 9
espèces officielles du SRD 5.2.1, quels traits portent un choix.

| Espèce | Trait à choix | Nature du choix |
|---|---|---|
| Elfe | Lignage elfique (Elven Lineage) | choisir un lignage (Drow / Haut-elfe / Elfe des bois) — chacun accorde un cantrip au niveau 1, un sort de plus aux niveaux 3 et 5, et une caractéristique d'incantation à choisir (Int/Sag/Cha) |
| Elfe | Sens aiguisés (Keen Senses) | choisir une compétence parmi Intuition/Perception/Survie — **même mécanisme que V3.1-4** |
| Gnome | Lignage gnomique (Gnomish Lineage) | choisir Gnome des forêts ou Gnome des roches — chacun accorde des cantrips et un sort/objet différents |
| Goliath | Ascendance de géant (Giant Ancestry) | choisir un des 6 bénéfices (Nuage/Feu/Givre/Colline/Pierre/Tempête) — capacité rechargeable, utilisations = bonus de maîtrise, récupérées au Repos long |
| Humain | Compétent (Skillful) | choisir une compétence — **V3.1-4** |
| Humain | Polyvalent (Versatile) | choisir un don d'origine — **V3.1-3** |
| Tieffelin | Legs infernal (Fiendish Legacy) | choisir un legs (Abyssal / Chthonien / Infernal) — même forme que le lignage elfique (résistance + cantrip niveau 1, sorts niveaux 3/5, caractéristique d'incantation à choisir) |

Aucun choix pour Drakéide, Nain, Halfelin, Orc — vérifié, rien à faire sur ces
quatre.

**Le vrai trou n'est pas seulement Compétent/Polyvalent** (déjà couverts) :
c'est le **lignage/legs à choix qui empaquette plusieurs effets** (un
cantrip immédiat, un sort supplémentaire à deux paliers de niveau, une
caractéristique d'incantation choisie une fois pour tout le lignage) — un
schéma qui revient trois fois (Elfe, Gnome, Tieffelin) sans qu'aucun
mécanisme ne l'accueille aujourd'hui. Traiter ce ticket au cas par cas
(un lignage elfique câblé en dur, puis un legs tieffelin câblé en dur...)
serait exactement l'inverse de ce qui est demandé : un mécanisme **générique**
de « trait d'espèce à choix », pour qu'une espèce maison future avec un trait
du même genre marche sans nouveau code — même esprit que `RemainingChoice`
pour les langues d'historique.

**Critères**
- [ ] Un trait d'espèce à choix simple (compétence, langue, outil) suit
  V3.1-4 — ce ticket n'y ajoute rien de plus.
- [ ] Un trait d'espèce à choix de don suit V3.1-3.
- [ ] Un trait d'espèce à choix de lignage/legs présente les options
  (Drow/Haut-elfe/Elfe des bois, etc.) dans l'assistant, applique le
  bénéfice de niveau 1 immédiatement, et prévoit la montée en puissance aux
  niveaux 3 et 5 (nouveau sort toujours préparé, comme un don à sort fixe).
- [ ] La caractéristique d'incantation du lignage/legs (Int/Sag/Cha, choisie
  une fois) est mémorisée et réutilisée pour tous les sorts qu'il accorde.
- [ ] Un trait d'espèce à choix de capacité rechargeable (Ascendance de
  géant) présente le choix, et la capacité se récupère au Repos long comme
  n'importe quelle ressource nommée (déjà un mécanisme existant, à réutiliser
  plutôt qu'à dupliquer).
- [ ] Une espèce maison créée sans ce genre de trait n'est pas affectée —
  aucune étape supplémentaire imposée quand il n'y a rien à choisir.

---

### ☑ V3.1-7 — Une sous-classe n'apporte jamais d'effet mécanique, choix ou pas · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) ; implémentation : V3.1-116 à 119**

**Modèle conseillé : Opus** — sous-classes mécaniques : touche characterSheet() et les choix rechoisis.

**À concevoir ensemble : V3.1-3, V3.1-6 et V3.1-7.** Les trois demandent le
même mécanisme générique de choix (dons, traits d'espèce, sous-classes) :
le concevoir une fois, avec Opus, avant d'en coder un seul. V3.1-4 se branche
ensuite dessus, avec Sonnet.

Constaté le 28 septembre en vérifiant les 12 sous-classes officielles pour le
même genre de trou que V3.1-3/V3.1-6. Le trou est plus profond que prévu :
ce n'est pas seulement que les *choix* de sous-classe ne sont pas résolus,
c'est qu'**aucune sous-classe n'apporte jamais le moindre effet mécanique**,
choix ou pas.

Cause racine : `CreationSelection.classes` (`resolvedRuleset.ts:72`) est
`{key, level}[]` — **aucun champ pour la sous-classe choisie**. La fonction
qui assemble la fiche résolue (`assembleResolvedRuleset`, même fichier)
résout espèce, historique et classe génériquement, mais n'ajoute jamais la
clé de la sous-classe au lot résolu. Le schéma des blocs de sous-classe
(`zSubclassFeatureEntry`, `src/core/schemas/rule-blocks/blocks.ts:442`) ne
porte que `{name, level, description}` — aucune place pour un modificateur,
une résistance, un type de dégâts ou une liste de sorts. L'écran de la fiche
(`LevelClassesStep.tsx:327-330` → `SubclassFeatures`,
`blockContentRenderer.tsx:930-948`) ne fait que trier par niveau et afficher
le texte. **Ça vaut aussi pour « Serment de vengeance »** (créé le 27
septembre dans cette même session) : ses aptitudes sont dans le même cas,
ce n'est pas un recul propre au contenu maison.

Cinq cas relevés sur les sous-classes officielles, qui couvrent trois formes
différentes de ce qui manque :

| Sous-classe | Aptitude | Ce qui manque |
|---|---|---|
| Cercle de la Terre (Druide) | Sorts du Cercle de la Terre | choix de terrain **rechoisi à chaque Repos long**, change la liste de sorts toujours préparés |
| Sorcellerie draconique (Ensorceleur) | Affinité élémentaire (niv. 6) | choix d'un type de dégâts, **une fois** — résistance + bonus de dégâts |
| Protecteur Fiélon (Occultiste) | Résilience fiélonne (niv. 10) | choix d'un type de dégâts, **rechoisi à chaque repos** — résistance |
| Chasseur (Rôdeur) | Proie du chasseur / Tactiques défensives | choisir une aptitude passive parmi deux, **échangeable à chaque repos** |
| Collège du Savoir (Barde) / Évocateur (Magicien) | Découvertes magiques / Savant en évocation | choisir des sorts à ajouter — **même mécanisme que V3.1-3** (dons à sorts) |

**Aparté positif, à vérifier en direct plutôt qu'à corriger** : le choix de
*lignage* d'espèce (Haut-elfe, Gnome des roches...) existe bien
génériquement (`SpeciesStep.tsx:73-105`, filtre par `parentSpeciesKey`). Les
10 couleurs d'Ascendance draconique du Drakéide semblent suivre la même
forme en base, mais le script d'import standard ne les génère pas
(`scripts/ingest-srd.ts:1992-1995` ne parcourt pas le tableau imbriqué
`Species[].subspecies` du SRD) — impossible de confirmer sans lire la base
réelle si elles portent un vrai modificateur ou seulement un nom.

**Critères**
- [ ] La sous-classe choisie est résolue au même titre que l'espèce,
  l'historique et la classe — sa clé rejoint le lot dont les blocs
  `modifiers` sont appliqués.
- [ ] Un type de dégâts/caractéristique choisi une fois (Affinité
  élémentaire) est mémorisé et appliqué (résistance, bonus de dégâts).
- [ ] Un choix rechoisi à chaque repos (Cercle de la Terre, Résilience
  fiélonne, Chasseur) est présenté à nouveau après un Repos court/long,
  pas seulement à la création — recoupe V3.1-5 sur le déclenchement au
  Repos long.
- [ ] Un choix de sorts accordé par une sous-classe (Découvertes magiques,
  Savant en évocation) réutilise le mécanisme de V3.1-3, pas un nouveau.
- [ ] Une sous-classe purement descriptive (la majorité des niveaux, sur
  toutes les sous-classes) continue de s'afficher telle quelle, sans rien
  d'imposé en plus.

---

### ☑ V3.1-8 — Aucune demande structurée de disponibilités pour la prochaine séance · `L` · sans modèle IA — fait

**Modèle conseillé : Opus** — nouveau flux de demande de disponibilités, schéma et RLS.

Constaté le 27 septembre, captures de crab.fit à l'appui : le Calendrier réel
(V2.1-4, `docs/BACKLOG_V2.1.md:639`) ne connaît qu'un mode — la joueuse
renseigne librement ses disponibilités sur les 12 mois à venir, à tout
moment, sans qu'aucune question précise ne lui ait été posée ; le MJ découvre
ensuite ce qui a été rempli en consultant le classement des jours
(`SchedulingMjPanel.tsx`). Ce n'est pas ce qui se passe à table : le MJ sait
qu'il cherche une date sur une fenêtre donnée (« un des dix prochains
jours », « un mardi ou jeudi soir ») et veut pouvoir le demander
explicitement, comme crab.fit (nommer l'évènement, choisir les dates
candidates au clic-glissé sur un calendrier ou par jour de semaine, choisir
la plage horaire par curseurs) — avec la DA de CreaDonjon, jamais une reprise
visuelle de crab.fit.

Deux volets demandés, imbriqués :
1. **Côté MJ** — un bouton « Demander prochaines disponibilités » dans le
   Calendrier réel, qui ouvre un assistant en plusieurs étapes (nom, dates
   candidates, plage horaire).
2. **Côté joueuse** — une pastille de notification sur le bouton « Prochaine
   session » (voir aussi V3.1-9) dès qu'une demande est ouverte, qui invite à
   répondre sur les dates candidates précises de cette demande, pas sur un
   calendrier ouvert de 12 mois.

**Décision de modèle, actée avec l'auteur avant ce ticket** : le flux guidé
**remplace** le libre-service actuel — une joueuse ne renseigne plus ses
disponibilités sans qu'une demande soit ouverte par le MJ. Ça introduit une
vraie notion de **ronde de demande** : un objet avec ses propres dates
candidates (une liste de dates précises, ou un motif par jour de semaine sur
une fenêtre), sa propre plage horaire candidate, un statut ouvert/fermé, et
ses propres réponses — pas un deuxième calendrier libre, un sondage fermé sur
un choix limité, remis à zéro à chaque nouvelle demande. Ça se rapproche de
la piste C (Doodle) écartée en V2.1-4 au profit de la piste D (dispos
libres), mais seulement pour le tour de la demande — le classement par
chevauchement déjà écrit et testé (`src/core/scheduling/overlap.ts`) reste
réutilisé tel quel une fois les réponses en main, rien à refaire là-dessus.

**Modèle de données**

Nouvelle table `availability_requests` (une ronde par ligne) : `id`,
`campaign_id`, `title` (nullable, généré si vide), les dates candidates
(liste de dates précises, ou motif jour de semaine + fenêtre — à trancher à
l'implémentation selon ce que le schéma existant permet le plus simplement),
`starts_at`/`ends_at` (plage horaire candidate), `status` (`open`/`closed`),
`created_by`, `created_at`. RLS même motif que `real_sessions` (écriture MJ,
lecture ouverte à tout membre du monde).

`real_session_availabilities` gagne une colonne `request_id` (FK vers
`availability_requests`, nullable) — une réponse répond toujours à une ronde
précise. Les lignes déjà en base (saisies en libre-service avant ce ticket,
**en production**, cf. mémoire « migrations appliquées à la main ») restent
lisibles pour l'historique mais ne sont rattachées à aucune ronde — ne pas
les supprimer, ne pas les migrer de force vers une ronde fictive. Nouvelle
migration, jamais de modification d'une migration déjà appliquée (règle
absolue n°14) ; SCHEMA.md ne documente aujourd'hui ni `real_sessions` ni
`real_session_availabilities` (angle mort antérieur à ce ticket, à combler
en même temps qu'on y touche).

**Fait le 29 septembre.** Deux allers-retours en cours de ticket, après
retour utilisateur sur la première version livrée :
- **Formulaire en ligne, jamais dans une fenêtre pop-up** — la toute
  première version ouvrait un assistant en plusieurs étapes dans une boîte
  de dialogue (`RequestAvailabilityWizard.tsx`, supprimé). Refait en une
  seule page qui s'affiche directement dans le Calendrier réel
  (`RequestAvailabilityForm.tsx`), à l'image de la vraie page de crab.fit
  (retour utilisateur : « je voulais un quasi copié-collé de ce que propose
  crab.fit ») — nom, dates candidates, plage horaire empilés et visibles
  d'un coup, pas de Suivant/Précédent.
- **Plage horaire par curseur à deux poignées** (`TimeRangeSlider.tsx`), pas
  deux champs heure — même retour utilisateur, plus proche de crab.fit que
  le motif déjà utilisé pour le réglage manuel.
- `AvailabilityCalendar.tsx` n'a pas été réutilisé pour l'écran de réponse
  joueuse : ce composant naviguait un calendrier libre sur 12 mois, un
  besoin qui n'existe plus une fois la joueuse restreinte à une poignée de
  dates candidates fixes — un nouveau composant plus simple
  (`AvailabilityRequestResponse.tsx`, une ligne par date candidate) l'a
  remplacé, et `AvailabilityCalendar.tsx` a été supprimé (plus aucun appelant
  après ce ticket).

Le clic-glissé pour sélectionner des dates (retour utilisateur en cours de
ticket : « ajoute aussi l'option du cliquer-glisser ») est implémenté et
vérifié directement au niveau des évènements DOM (`mousedown` +
`mouseover`/`relatedTarget`, la façon dont React synthétise réellement
`onMouseEnter` en interne) — le simple clic reste possible en plus.

**Étapes**
1. Fait — Migration `20260929120000_availability_requests.sql` :
   `availability_requests` (dates candidates en `date[]`, résolues côté
   formulaire que l'origine soit un clic ou un motif « jours de semaine »),
   colonne `request_id` sur `real_session_availabilities`, RLS, index partiel
   `availability_requests_one_open_per_campaign`. `docs/SCHEMA.md` complété
   au passage (angle mort antérieur à ce ticket).
2. Fait — Formulaire MJ en ligne (`RequestAvailabilityForm.tsx`), affiché à
   la place du classement tant qu'aucune ronde n'est ouverte : nom, dates
   candidates (onglets « Dates précises » au clic/clic-glissé,
   `expandWeekdayPattern` en pur pour « Jours de la semaine »), plage
   horaire (`TimeRangeSlider.tsx`), bouton Créer — tout sur une page.
3. Fait — Écran de réponse joueuse sur une grille à peindre
   (`AvailabilityPaintGrid.tsx`, refondu — voir plus bas), une colonne par
   date candidate de la ronde ouverte.
4. Fait — `SchedulingMjPanel.tsx` : le classement par chevauchement porte
   sur `request.candidate_dates` (`getRankedDaysForRequest`), plus de
   navigation libre par mois. Une date candidate sans aucune réponse
   apparaît quand même, classée en dernier.
5. Fait — Pastille sur `NextSessionBadge.tsx`, disparaît dès la réponse
   enregistrée (`onResponded`, sans attendre la confirmation MJ).
6. Fait — `createRealSession`/`cancelAvailabilityRequest` ferment la ronde
   ouverte de la campagne.

**Deuxième vague, après retour utilisateur sur la première version livrée**
(mêmes critères, complétés en dessous) :
- **Grille à peindre plutôt que deux champs heure par date**
  (`AvailabilityPaintGrid.tsx`, retour utilisateur : "sélectionner les
  plages horaires par jours" comme sur crab.fit) — clic ou clic-glissé sur
  des cases d'une demi-heure, colonnes = dates candidates, lignes = la
  plage horaire suggérée par le MJ. Peindre reste une **façon de saisir**
  la même plage continue par jour (`rangeFromSlots`,
  `src/core/scheduling/availabilityGrid.ts`, pur/testé) — comble les trous
  plutôt que d'les refuser, aucun changement du modèle de données V2.1-4
  ("jamais deux disponibilités disjointes le même soir").
- **Carte de chaleur côté MJ** (`AvailabilityHeatmap.tsx`, retour
  utilisateur : "des zones de plus en plus foncées... avec une infobulle au
  survol") — complète le classement/bouton Confirmer déjà existant, ne le
  remplace pas : une case par (date, créneau de 30 min), teintée selon le
  nombre de joueuses dont la réponse couvre ce créneau précis, infobulle au
  survol listant qui.
- **Le MJ peut aussi renseigner ses propres disponibilités** (retour
  utilisateur : "le MJ doit aussi pouvoir mettre ses dispos") — section
  « Mes disponibilités » dans `SchedulingMjPanel.tsx`, même
  `AvailabilityPaintGrid.tsx` que côté joueuse, même endpoint
  (`GET`/`POST .../scheduling/availability`, qui a toujours résolu
  « mes propres réponses » depuis l'appelant authentifié — aucun
  changement d'API nécessaire). `totalMembers` compte désormais **tout le
  monde** (MJ inclus), pas seulement les joueuses — renverse le choix
  d'origine V2.1-4 qui excluait le MJ parce qu'il ne répondait jamais ;
  `resolveNamesIncludingGm` (copie locale, jamais `resolvePlayerNames`
  lui-même, réutilisé ailleurs) donne au MJ le nom « MJ » dans les rosters/
  infobulles, faute de PJ associé.
- **Écran joueuse en ligne, jamais en fenêtre pop-up** (retour utilisateur :
  "à l'image de ce que le joueur peut voir pour les autres onglets") —
  nouvelle page `/joueur/prochaine-session` (`app/m/[worldSlug]/joueur/
  prochaine-session/page.tsx`), au même titre que Notes ou Wiki.
  `NextSessionBadge.tsx` n'ouvre plus de `createPortal`/dialogue : c'est
  désormais un lien de navigation, plus léger.
- **Bouton "Prochaine session" invisible sur mobile, corrigé** (retour
  utilisateur : "le bouton de prochaine session disparaît" sur téléphone) —
  il n'existait que pour desktop (`hidden md:block`). Deux présentations
  du même lien dans `NextSessionBadge.tsx` : la bannière verticale habituelle
  à partir de `md:`, une icône + libellé court ("Session") en dessous,
  intégrée à la barre d'onglets du bas comme les six autres destinations.

**Critères**
- [x] Le MJ ouvre une demande avec un nom (ou vide → généré), des dates
  candidates (précises ou par jour de semaine sur une fenêtre), une plage
  horaire.
- [x] Toute joueuse de la campagne voit une pastille sur « Prochaine
  session » tant qu'elle n'a pas répondu à la demande ouverte — visible sur
  mobile comme sur desktop.
- [x] La pastille disparaît dès que la joueuse a répondu, sans attendre que
  le MJ confirme une séance.
- [x] La joueuse (et le MJ) ne répond que sur les dates candidates précises
  de la demande en cours, sur une grille à peindre — plus de calendrier
  ouvert sur 12 mois sans demande, plus de champs heure séparés.
- [x] Le classement des jours et la carte de chaleur côté MJ ne portent que
  sur la demande ouverte en cours, MJ inclus dans l'effectif.
- [x] Confirmer une séance, ou annuler la demande, la ferme : plus de
  pastille, plus d'invite à répondre, pour tout le monde.
- [x] Une seule demande ouverte à la fois par campagne (garanti par l'index
  partiel en base).
- [x] L'écran joueuse ("Prochaine session" et ses trois onglets) est une
  page normale de la coquille, jamais une fenêtre pop-up.

Vérifié en direct sur ClaudeLand (compte de test à la fois MJ et joueuse) :
création d'une ronde par clic (dates précises) et par motif « jours de
semaine sur une fenêtre » (`expandWeekdayPattern` vérifié bout en bout),
glissement des deux poignées du curseur horaire, peinture de cases sur la
grille (glissé réel, pas seulement clic isolé), réponse joueuse **et** MJ,
classement et carte de chaleur mis à jour (« 1/3, session raccourcie » une
fois le MJ compté), confirmation créant la séance et fermant la ronde,
annulation d'une ronde sans séance, page `/joueur/prochaine-session`
atteignable sans pop-up, bouton visible en largeur mobile. `npm run
typecheck && npm run lint && npm run test:core` passent.

---

### ☑ V3.1-9 — Bouton « Prochaine session » mal calibré selon l'écran · `S`/`M` · sans modèle IA — fait

**Modèle conseillé : Sonnet** — ajustement d'affichage.

Constaté le 27 septembre, capture à l'appui : la bannière verticale
(`NextSessionBadge.tsx`), texte tourné à 90°, taille en
`clamp(7px,1.15vh,10px)`, devient illisible/écrasée sur certaines hauteurs
d'écran — le vrai problème étant que tout le texte (« Prochaine session —
dimanche 27 septembre 2026 ») était concaténé en un seul bloc continu. Le
bouton doit aussi donner accès aux dates passées, aux dates à venir, et — si
une demande est ouverte par le MJ (V3.1-8) — au remplissage des
disponibilités : jusque-là il n'ouvrait que la saisie
(`AvailabilityCalendar.tsx`) une fois une séance déjà confirmée, sans aucun
accès à `getPastSessions`/`getUpcomingSessions` (déjà écrits côté service,
`src/server/services/scheduling.ts`, jamais consultés côté joueuse).

Lié à V3.1-8 mais indépendant : ce ticket vaut même si V3.1-8 n'est pas
encore pris (l'onglet « Mes disponibilités » reste alors toujours visible,
faute de demande à conditionner dessus — voir plus bas).

**Fait le 29 septembre.** Première version basculée à l'horizontal (deux
lignes de texte normal) — corrigée après retour utilisateur : l'orientation
verticale devait être **gardée**, seul le texte tout attaché posait
problème. Version finale : le bouton reste vertical
(`writing-mode: vertical-rl`, `rotate(180deg)`), mais scindé en deux blocs
(« Prochaine session » / la date) plutôt qu'une seule chaîne concaténée —
deux blocs sous `vertical-rl` deviennent deux colonnes côte à côte,
chacune bien plus courte que l'ancien texte tout collé, sans changer
l'esthétique voulue.

**Étapes**
- Fait — Bouton normal (contour fin couleur `accent`, sans fond plein, même
  famille que l'ancien bouton « Renseigner mes disponibilités »), texte
  vertical scindé en deux blocs plutôt qu'un seul.
- Fait, puis refondu (V3.1-8, retour utilisateur : "à l'image de ce que le
  joueur peut voir pour les autres onglets") — le clic ouvrait d'abord un
  panneau à onglets en fenêtre pop-up ; il mène désormais à une vraie page
  (`/joueur/prochaine-session`, `NextSessionPanel.tsx`), plus de
  `createPortal`. Trois onglets inchangés (À venir / Passées / Mes
  disponibilités), réutilisant `getUpcomingSessions`/`getPastSessions`.
- Fait, puis complété (retour utilisateur : "le bouton de prochaine session
  disparaît" sur téléphone) — n'existait que pour desktop (`hidden
  md:block`). `NextSessionBadge.tsx` porte désormais deux présentations du
  même lien : la bannière verticale à partir de `md:`, une icône + libellé
  court intégrée à la barre d'onglets du bas en dessous, comme les six
  autres destinations de `PlayerShell.tsx`.
- Fait — Vérifié sur des hauteurs de fenêtre resserrées (jusqu'à 480px) :
  aucun débordement, aucun chevauchement avec les autres destinations de la
  coquille joueuse (`PlayerShell.tsx`).

**Critères**
- [x] Le texte est lisible sur toutes les hauteurs de fenêtre déjà couvertes
  par `PlayerShell.tsx` (desktop) — et visible tout court sur mobile, où il
  n'apparaissait pas du tout.
- [x] Le bouton mène à un écran à onglets (passé/à venir/mes dispos), une
  page normale de la coquille plutôt qu'une fenêtre pop-up ou le seul
  calendrier de saisie.
- [x] L'onglet « Mes disponibilités » affiche la réponse à la ronde ouverte
  (V3.1-8, fait depuis) si une demande est en cours, sinon un message
  explicite plutôt qu'un onglet vide.

---

### ☑ V3.1-10 — Connexion par identifiant/mot de passe plutôt que lien à retrouver · `L` · sans modèle IA — fait

**Modèle conseillé : Opus** — authentification.

Constaté le 27 septembre : les joueuses redemandent systématiquement le lien
d'invitation à l'auteur. Ce n'est pas un oubli isolé, c'est la conséquence
directe d'un choix déjà acté — [docs/adr/0015-provisioning-comptes-invites.md](../adr/0015-provisioning-comptes-invites.md)
: un compte invité (`provisionInviteSession`,
`src/server/services/accountProvisioning.ts:11`) n'a **jamais** d'email réel
ni de mot de passe, seulement une adresse synthétique invisible et une
reconnexion par lien magique. Rien qu'une joueuse puisse retenir ou
retrouver seule.

**Vision retenue, sur plusieurs échanges les 27 et 28 septembre — remplace
toutes les versions précédentes de ce ticket.**

**Comptes et mondes sont découplés.** Un compte peut exister sans être
membre d'aucun monde — au moment de sa création, ou après une révocation.

**Deux familles de comptes, un seul écran de connexion (`/login`,
`app/login/actions.ts`) :**
- **Comptes ordinaires** (email réel + mot de passe) — inchangés, l'auteur
  y compris. `/signup`/`/login` existants ne bougent pas.
- **Comptes « tag »** — un nom affiché (pas unique : deux comptes peuvent
  s'appeler « Julie ») accompagné d'un identifiant à **4 chiffres** généré
  automatiquement (`#0000`–`#9999`, régénéré en cas de collision sur la
  paire nom+chiffres), **invisible partout sauf dans les réglages du compte
  concerné** — jamais dans une liste de membres, jamais dans l'attribution
  publique d'une création. Chaque compte en a un, y compris celui de
  l'auteur (`Gabriel#0000`) : le tag sert à l'attribution interne, pas
  seulement aux comptes invités.
  *Amendé le 1ᵉʳ octobre par V3.1-15 et l'ADR 0032 : le tag devient
  visible du MJ de la campagne, dans la Gestion de campagne, pour distinguer
  deux comptes de même nom. Invisible partout ailleurs, comme avant.*
- **À la connexion, on tape juste un nom et un mot de passe** — jamais le
  tag. La résolution essaie, dans l'ordre, chaque compte « tag » portant ce
  nom contre ce mot de passe (collisions rares à l'échelle d'une table de
  jeu), puis retombe sur un email classique si rien ne correspond.
- **N'importe qui peut créer un compte « tag » sans invitation**, depuis
  `/login` (bascule « créer un compte ») — atteignable aussi par un bouton
  que le MJ pose lui-même sur son wiki public, qui mène au même écran. Un
  tel compte ne donne accès à rien tant que personne ne l'invite dans un
  monde.

**Un lien d'invitation rattache un compte (nouveau ou déjà existant) à un
monde et un rôle — il ne crée plus de mot de passe, la personne le choisit
elle-même en cliquant le lien pour la première fois :**
- **Lien joueur : réutilisable par plusieurs personnes** — un lien = un
  monde, pas une personne. Renverse la décision nominative de V2-M4 (« un
  lien par personne »), volontairement : la nominativité perd son intérêt
  une fois que c'est la personne elle-même, pas le MJ, qui choisit son
  identité et son mot de passe.
- **Lien MJ : reste nominatif, à usage unique**, comme aujourd'hui — rôle
  plus sensible (droits d'édition sur tout le monde), pas de raison de le
  rendre partageable.
- Le mot de passe optionnel déjà existant sur un lien (`password_hash` sur
  `campaign_invites`, `verifyInvitePassword`) reste disponible comme verrou
  de groupe supplémentaire — d'autant plus utile qu'un lien joueur peut
  désormais circuler plus largement qu'à une seule personne.

**Personnage choisi après coup, pas à la création du compte.** Première
visite d'un monde en tant que joueuse sans PJ assigné : écran listant les
PJ ouverts (non réclamés) du monde, plus une option « Nouveau PJ » vers
l'assistant de création existant. Le MJ garde la main pour réassigner qui
joue quel PJ ensuite.

**Révoquer une joueuse = l'expulser du monde**, rien de plus : retire son
adhésion (`campaign_members`), libère le PJ qu'elle jouait
(`campaign_characters.user_id = null`) — même geste que `revokeInvite`
aujourd'hui. Le compte survit, inchangé ailleurs (autres mondes, ou aucun).
Ne touche plus au lien lui-même, qui reste ouvert pour d'autres puisqu'il
est désormais réutilisable.

**Mot de passe oublié — pas de miracle sans email, donc ça reste médié :**
un bouton « Mot de passe oublié » sur l'écran de connexion dépose une
demande plutôt que d'exiger un aller-retour hors de l'app (Discord, SMS...).
Elle apparaît dans le panneau de tout MJ dont ce compte est membre d'un
monde. **Si le compte n'est membre d'aucun monde** (créé en libre-service,
jamais invité, ou révoqué de partout), aucun MJ ordinaire n'a d'autorité
dessus — c'est le superadmin qui la voit et agit (point suivant).

**Le superadmin (compte de l'auteur, `profiles.account_role = 'superadmin'`,
déjà posé par la migration `20260830090001_superadmin_role.sql`) étend ses
pouvoirs déjà existants** (`app/api/admin/*`, `deleteInvitedAccount`, « voir
comme ») avec trois gestes nouveaux, pour couvrir précisément les comptes
qu'aucun MJ particulier ne gère :
- réinitialiser le mot de passe de n'importe quel compte de la plateforme ;
- supprimer n'importe quel compte — généralise `deleteInvitedAccount`
  (`accountProvisioning.ts:192`), dont le garde-fou actuel (« refuse si
  jamais réclamé par un lien d'invitation ») ne tient plus une fois les
  comptes « tag » libre-service possibles, à revoir dans le même geste ;
- transférer un ruleset personnel d'un compte à un autre
  (`rulesets.created_by`) — jamais sur `is_official_base = true`, règle
  absolue n°18, inchangée.

**Corrections par rapport aux versions précédentes de ce ticket :**
- Un mot de passe de **compte** passe par le mécanisme natif de Supabase
  Auth (`admin.auth.admin.createUser({ email, password })`,
  `signInWithPassword`) — jamais par `hashSharePassword`/scrypt
  (`src/core/shareLinks/password.ts`), qui reste réservé aux mots de passe
  de **lien** (partage, invitation), lesquels ne correspondent à aucune
  identité `auth.users`. Une version antérieure de ce ticket proposait à
  tort de réutiliser scrypt pour les mots de passe de compte.
- Le lien magique (`mintSessionForInvitedAccount`/`mintSessionForOwnAccount`,
  `accountProvisioning.ts`) reste exactement ce qu'il est aujourd'hui,
  réservé à « voir comme » côté superadmin — il ne joue plus aucun rôle dans
  la connexion ordinaire, contrairement à ce qu'une version antérieure de ce
  ticket envisageait.
- « Forcer une réinitialisation » (MJ ou superadmin, sur un compte
  existant) ne suppose ni mot de passe temporaire tapé à la main, ni lien
  magique : ça génère un jeton à usage unique — même primitive que les
  liens d'invitation, pas une nouvelle mécanique — qui mène à l'écran de
  choix d'un nouveau mot de passe (jamais de connexion automatique).

**Modèle de données**

- `profiles` gagne `handle_name` (texte) + `handle_tag` (4 chiffres),
  uniques ensemble (pas `handle_name` seul), et `must_change_password`
  (booléen). Aucune colonne de mot de passe applicatif — le mot de passe
  vit dans `auth.users`, géré par Supabase Auth.
- `campaign_invites` : les liens de rôle `player` perdent leur sémantique
  « réclamé une seule fois » — plus de `claimed_by_user_id` singulier pour
  ce rôle, la liste de qui a rejoint via un monde redevient simplement
  `campaign_members` (source de vérité déjà existante, pas de nouvelle
  table de suivi). Les liens de rôle `gm` gardent le comportement actuel à
  l'identique.
- Demande de réinitialisation en attente : petite table ou flag +
  horodatage sur `profiles`, lisible par tout MJ d'un monde dont ce compte
  est membre, et par le superadmin dans tous les cas.

**Étapes**

1. Nouvel ADR actant : mots de passe natifs Supabase (jamais de lien
   magique comme canal de connexion courant), liens joueurs réutilisables
   (renverse V2-M4), comptes utilisables sans monde, réinitialisation
   médiée par jeton à usage unique. L'ADR 0015 et le commentaire « un lien
   par personne » de V2-M4 ne sont jamais réécrits — ce nouvel ADR
   documente la suite, pas une correction de l'ancien.
2. Migration : `handle_name`/`handle_tag`/`must_change_password` sur
   `profiles` (avec attribution d'un tag à chaque compte existant,
   `Gabriel#0000` pour l'auteur), assouplissement de `campaign_invites`
   pour les liens joueur, table/flag de demande de réinitialisation.
3. Écran de connexion unique (`/login`) : « se connecter » (nom + mot de
   passe, ou email pour un compte ordinaire) et bascule « créer un compte »
   (nom, tag généré à la volée, mot de passe) — utilisable avec ou sans
   lien d'invitation en contexte.
4. Un lien d'invitation ouvert dans cet écran attache automatiquement le
   compte (nouveau ou existant) au monde/rôle visé, juste après connexion
   ou création de compte.
5. Première visite d'un monde en tant que joueuse sans PJ assigné : écran
   « Choisis ton personnage » (PJ ouverts + « Nouveau PJ » vers l'assistant
   existant).
6. Panneau MJ (gestion des invitations existante,
   `src/server/services/campaignInvites.ts`) : génération d'un lien joueur
   réutilisable vs un lien MJ nominatif ; « Révoquer » simplifié (retire
   l'adhésion + libère le PJ, ne touche plus au lien) ; bouton « Forcer une
   réinitialisation » par compte ; liste des demandes de réinitialisation
   en attente pour les mondes de ce MJ.
7. Écran de connexion : bouton « Mot de passe oublié » qui dépose une
   demande plutôt que d'exiger un canal externe.
8. Panneau Administration (superadmin) : tous les comptes de la plateforme,
   réinitialisation, suppression généralisée, transfert de ruleset
   personnel, et les demandes de réinitialisation orphelines (compte sans
   aucun monde).

**Critères**

- [x] N'importe qui peut créer un compte (nom + mot de passe, tag généré
  automatiquement) sans invitation, depuis `/login` ou le bouton du wiki
  public — ce compte n'a accès à aucun monde tant que personne ne l'y
  invite.
- [x] Un lien joueur peut être utilisé par plusieurs personnes différentes,
  chacune rejoignant le même monde avec son propre compte.
- [x] Un lien MJ reste utilisable par une seule personne, comme aujourd'hui.
- [x] À la première visite d'un monde comme joueuse, si aucun PJ n'est déjà
  assigné, la joueuse choisit parmi les PJ ouverts ou en crée un nouveau —
  jamais imposé au moment de la création du compte.
- [x] Révoquer une joueuse retire son accès au monde et libère son PJ ; son
  compte reste utilisable ailleurs (autres mondes, ou aucun) ; le lien
  d'invitation, lui, continue de fonctionner pour d'autres.
- [x] Une demande de réinitialisation envoyée sans mot de passe connu arrive
  dans le panneau d'un MJ compétent, ou du superadmin si le compte n'a
  aucun monde.
- [x] Le superadmin peut réinitialiser le mot de passe, supprimer, ou
  transférer un ruleset personnel de n'importe quel compte de la
  plateforme.
- [x] Le tag (`#NNNN`) n'est jamais visible ailleurs que dans les réglages
  du compte concerné.
- [x] Un nouvel ADR documente ce modèle, sans modifier l'ADR 0015 ni le
  commentaire de V2-M4.

Fait le 29 septembre (ADR 0031). Réalisé en six étapes, chacune vérifiée en
navigateur avec des comptes/mondes de test créés puis supprimés :

1. **Migration** (`20260929130000_native_password_accounts.sql`) :
   `profiles.handle_name`/`handle_tag`/`must_change_password`/
   `password_reset_requested_at`, génération de tag avec retry sur
   collision, `app.resolve_login_emails`/`app.request_password_reset_by_name`
   (anon-safe), `app.revoke_campaign_member`, `account_reset_tokens` (RLS
   sans aucune politique).
2. **Écran de connexion unique** (`/login`) : nom-ou-email essaie d'abord
   les comptes "tag", puis retombe sur un email ordinaire ; bascule "Créer
   un compte" (tag, libre-service) ; "mot de passe oublié" par nom.
3. **Liens joueurs réutilisables** : `provisionInviteSession` ne crée plus
   de compte lui-même (déplacé vers `accountAuth.createTagAccount`,
   appelé par `app/rejoindre/[token]/actions.ts` avant la connexion
   directe par mot de passe) ; `campaign_members` fait foi pour un lien
   joueur, `claimed_by_user_id` reste la source pour un lien MJ (nominatif,
   usage unique, inchangé).
4. **Panneau MJ** (`InviteLinkPanel`/`CampaignDetail`) : section "Liens
   joueurs" distincte (jamais "jamais ouvert"), révocation individuelle
   d'un membre (`app.revoke_campaign_member`, sans toucher au lien),
   "Forcer une réinitialisation" par membre avec lien affiché inline,
   indicateur "mot de passe oublié".
5. **Écran "Choisis ton personnage"** (`/joueur`, sans PJ assigné) : PJ
   ouverts de la campagne ou "Nouveau PJ" (même assistant que côté MJ,
   `CharacterCreatorWizard` gagne un prop `onCreate` optionnel pour
   réclamer la fiche immédiatement plutôt que la laisser flottante).
6. **Panneau superadmin** (`AdminPanel`) : section "Comptes — toute la
   plateforme" (jamais le tag), réinitialisation/suppression généralisées à
   tout compte, transfert de ruleset personnel — `deleteInvitedAccount`
   (ancien, borné aux comptes invités) supprimé, devenu mort code une fois
   `adminDeleteAccount` généralisé en place.

**Écarts assumés par rapport au ticket** :
- La demande "mot de passe oublié" par nom (ambigu, plusieurs comptes
  peuvent partager un `handle_name`) pose le drapeau sur TOUS les comptes
  de ce nom plutôt que d'exiger une désambiguïsation — négligeable à
  l'échelle d'une table de jeu personnelle, le MJ/superadmin reconnaît sa
  propre joueuse dans son panneau.
- Le panneau superadmin affiche `password_reset_requested_at` pour TOUS les
  comptes, pas seulement ceux sans monde (le critère garantit un minimum —
  "MJ compétent, ou superadmin si sans monde" — pas un maximum ; le
  superadmin voit de toute façon tout le reste).
- Réglages du compte affichant son propre `handle_tag` : non construit,
  hors des huit étapes listées par le ticket — actuellement aucun endroit
  ne montre jamais le tag à personne, y compris à son propriétaire.
- Bouton "créer un compte" posable par le MJ sur son wiki public : non
  construit (mentionné dans la vision, absent des critères d'acceptation
  et des étapes).
- Réouverture d'un lien MJ déjà réclamé sur un compte créé AVANT V3.1-10
  (sans mot de passe) : ne fonctionne plus pour un lien de rôle `player`
  (le garde-fou par rôle empêche la reconnexion par lien magique) — un tel
  compte a besoin d'une réinitialisation forcée (MJ/superadmin) pour
  obtenir son premier mot de passe. Cas rare (comptes antérieurs à ce
  ticket uniquement), non couvert par une migration de données faute de
  pouvoir deviner un mot de passe à leur place.

---

### ☑ V3.1-11 — Onglet « Solo » visible même avec un MJ humain déjà présent · `S` · sans modèle IA — fait

**Modèle conseillé : Sonnet** — une condition d'affichage.

Constaté le 28 septembre, en discutant de V3.1-10 : la coquille joueuse
(`PlayerShell.tsx:64`) liste « Solo » comme destination fixe, sans condition
— le mode solo (V3, IA locale) n'a de sens que pour une joueuse sans MJ
humain sur ce monde. Aujourd'hui il reste visible même dans un monde qui a
un vrai MJ, alors que `campaign_members` porte déjà un rôle `gm` par
campagne (`src/server/repos/campaigns.ts:138`) — une simple présence de ce
rôle suffit à savoir si ce monde a un MJ humain.

**Critères**
- [x] L'onglet « Solo » n'apparaît dans la coquille joueuse que si la
  campagne du monde consulté ne compte aucun membre de rôle `gm`.
- [x] Un monde sans MJ humain (solo par nature) continue d'afficher l'onglet
  normalement — aucune régression sur l'usage principal de ce mode.

Fait le 29 septembre. `hasHumanGm(supabase, campaignId)` (nouveau, dans
`src/server/services/campaigns.ts`) réutilise `listCampaignMembers` et
cherche un membre `role === "gm"` — même motif que `resolveNamesIncludingGm`
dans `scheduling.ts`. `app/m/[worldSlug]/joueur/layout.tsx` résout la
campagne du monde (`resolveCampaignId`, `null` traité comme « pas de MJ »)
et passe le résultat à `PlayerShell` en prop `hasHumanGm`, qui filtre
l'entrée « Solo » de son tableau `destinations` quand elle vaut `true`.

Vérifié en navigateur sur ClaudeLand/Faerûn (copie), qui a un MJ humain :
l'onglet Solo est bien absent de la coquille joueuse. Le cas inverse (monde
sans MJ humain) n'a pas pu être rejoué en direct — la création de monde
n'offre aujourd'hui que le mode « Campagne (MJ humain) », aucun moyen
d'obtenir un monde solo depuis cet écran — mais découle directement du code :
`createCampaign`/`insertCampaignMember` (`campaigns.ts:120`) n'insère un
membre `role: "gm"` que pour `mode: "campaign"`, jamais pour `mode: "solo"`
ni quand `resolveCampaignId` renvoie `null` (monde sans campagne).

---

### ☑ V3.1-14 — Aucun moyen pour une joueuse de créer elle-même son PJ sans personnage déjà assigné · `M` · sans modèle IA — **repris par V3.1-82, 83 et 100 (9 octobre)**

**Fermé le 9 octobre, repris ailleurs** (décision de l'auteur) : « Créer mon
personnage » depuis l'onglet Personnage → V3.1-83 (carte « Nouveau
personnage » du carrousel, V3.1-82) ; rejoindre une table sans choisir de PJ,
et le lien qui vise un PJ précis → **V3.1-100**. Le texte ci-dessous reste
pour mémoire.

**Modèle conseillé : Opus** — une joueuse crée sa fiche : propriété, RLS, canEditEntity.

Constaté le 29 septembre, en vérifiant V3.1-9 : le lien de test donné par
l'auteur menait à l'écran « Bienvenue » (`app/rejoindre/[token]/JoinForm.tsx`)
avec « Aucun personnage disponible pour l'instant » — le rôle joueur exige
aujourd'hui qu'un PJ non réclamé existe déjà (sinon `missing_entity`,
`accountProvisioning.ts:69`), et la seule façon d'en créer un est que le MJ
le fasse à la main au préalable (nouvelle fiche, puis dropdown « PNJ (sans
joueur) » dans Gestion de campagne pour la laisser ouverte).

Même trou côté onglet Personnage (`ParticipantCharacterSheet.tsx:37`) : le
bouton « Créer mon personnage » n'amorce l'assistant (`CharacterCreatorWizard`)
qu'en `entityMode` — sur une entité **déjà assignée** (`entityId`/
`entityVersion` transmis par la page appelante) — jamais pour une joueuse qui
n'a encore aucun PJ du tout.

Pourtant `CharacterCreatorWizard` sait déjà créer une entité de zéro (mode
hors `entityMode`, ligne 116 : « Requis seulement hors `entityMode` (création
d'une nouvelle entité) », utilisé aujourd'hui seulement côté MJ via
`EditEntityForm.tsx`) — la brique existe, elle n'est simplement jamais
proposée à une joueuse sans PJ.

**Décision** : une joueuse sans PJ assigné peut lancer l'assistant en mode
création (pas seulement édition d'une entité existante), qui crée directement
une fiche marquée PJ (`is_pc: true`) et attribuée à elle
(`campaign_characters.user_id`) — éditable ensuite par elle-même et par le MJ
comme n'importe quel PJ (`canEditEntity`, aucun mécanisme nouveau à écrire
pour ça).

Deux points d'entrée à couvrir :
- Le bouton « Créer mon personnage » du menu Personnage
  (`ParticipantCharacterSheet.tsx`), quand la joueuse n'a aucun PJ du tout —
  pas seulement « PJ sans fiche », le cas déjà couvert aujourd'hui.
- L'écran « Bienvenue » (`JoinForm.tsx`) — remplacer « Aucun personnage
  disponible pour l'instant » par une option « Créer mon personnage » quand
  la liste des PJ ouverts est vide.

Recoupe l'étape « Nouveau PJ » prévue par V3.1-10 (choix du PJ à la première
visite d'un monde, une fois le nouveau système de connexion en place) — même
mécanisme, à ne construire qu'une fois : ce ticket peut se faire
indépendamment et avant, V3.1-10 le réutilise plutôt que d'en réécrire un
second.

**Étapes**
1. Identifier où « aucun PJ du tout » atteint aujourd'hui
   `ParticipantCharacterSheet.tsx` (actuellement ce composant n'est monté
   qu'avec un `entityId` déjà connu — la page appelante doit d'abord
   accepter ce cas).
2. Proposer l'assistant en mode création (hors `entityMode`) à cet endroit ;
   à la validation, marquer la nouvelle entité PJ et l'attribuer à l'auteure
   de la création (`campaign_characters` upsert, `is_pc: true`, `user_id`) —
   un seul geste, pas une création suivie d'une attribution manuelle séparée
   par le MJ.
3. `JoinForm.tsx`/`actions.ts` : quand `characters.length === 0` (rôle
   joueur), remplacer le message bloquant par une option « Créer mon
   personnage » qui ouvre le même assistant avant de finaliser la connexion.
4. Le MJ garde la main ensuite : la fiche reste réassignable/révocable comme
   n'importe quel PJ (`CampaignDetail.tsx`, déjà existant) — rien de nouveau
   à construire ici.

**Critères**
- [ ] Une joueuse sans aucun PJ assigné peut créer le sien elle-même via
  l'assistant, depuis le menu Personnage.
- [ ] La fiche créée est immédiatement un PJ attribué à elle — éditable par
  elle et par le MJ, sans étape manuelle supplémentaire du MJ.
- [ ] L'écran « Bienvenue » (rejoindre un monde) propose la création d'un PJ
  quand aucun n'est disponible, au lieu d'un message bloquant sans issue.
- [ ] Une joueuse qui a déjà un PJ (avec ou sans fiche) n'est pas affectée —
  comportement actuel inchangé pour ce cas.

---

### ☑ V3.1-15 — La Gestion de campagne illisible : invitations en haut, une carte par personne · `M` · sans modèle IA — **fait, vérifié en direct le 9 octobre**

**Modèle conseillé : Sonnet** — interface d'après l'esquisse ; reste la vérification en direct.

Constaté le 1ᵉʳ octobre par l'auteur, captures à l'appui : la fenêtre « Gestion
de campagne » (`CampaignDetail.tsx` + `InviteLinkPanel.tsx`) est « assez
illisible, avec une interface peu claire ». Elle empile cinq listes sans lien
visible entre elles — Membres, À la table, Liens joueurs, Liens MJ en attente,
Personnages attribués, Octrois d'édition — et c'est au MJ de recouper de tête
qui joue quoi et qui peut modifier quoi.

**Esquisse retenue : la piste A**, sur le canevas
[Gestion de campagne — esquisses](https://claude.ai/artifact/KvM1bxgB61kUaJT2n1CxT2)
(artboard « A — Invitations en haut, une fiche par personne », fichier
`Main.dc.html`). Quatre pistes y ont été comparées le 1ᵉʳ octobre : A (cartes
par personne), B (liste à gauche, détail à droite), C (tableau fiches ×
joueurs), D (onglets). **A l'emporte** : elle répond d'un coup d'œil à « qui
est à la table, et qu'est-ce que chacun peut toucher » — et sa seule faiblesse,
s'allonger avec le nombre de joueurs, ne joue pas ici : une table dépasse
rarement 4-5 joueuses (auteur). Comme pour V2.1-24/25, **l'esquisse fait foi**
pour la disposition ; le code fait foi pour tout le reste (jetons, `Dropdown`,
`ActionsMenu`, `ConfirmDialog`).

**Ce que l'écran actuel cache, et que le ticket corrige** — relevé sur les
captures, chacun vérifié dans le code :

1. **« Révoquer » veut dire deux choses.** Dans « Membres », il retire la
   personne de la campagne et libère son personnage (`revokeMember`,
   `ConfirmDialog` « Révoquer ce membre ? ») ; dans « Personnages attribués »,
   il libère seulement le PJ (`revokeCharacterClaim`). Même mot, même couleur,
   deux portées. Deux libellés distincts : **« Retirer de la campagne »** et
   **« Libérer le personnage »**.
2. **« Forcer une réinitialisation » est répété sur chaque ligne** comme un
   lien de texte, alors que c'est un geste rare. Il descend dans le menu ⋮ de
   la carte, avec « Retirer de la campagne ». Une **demande de
   réinitialisation en attente** (`passwordResetRequests`) reste en revanche
   visible sur la carte, sous forme d'étiquette — c'est la seule raison
   d'aller chercher ce geste.
3. **Une même personne est dispersée** entre « Membres » (son compte),
   « Personnages attribués » (son PJ) et « Octrois d'édition » (ses fiches).
   La carte les réunit.
4. **« Personnages attribués » mélange PJ et PNJ sans joueur.** Les PJ
   passent sur les cartes ; les PNJ de la campagne (`is_pc: false`, sans
   `user_id`) vont dans un encart à part, en bas.
5. **Deux comptes portent le même nom** (« Tamara » deux fois, l'un sans
   personnage ni fiche). Rien à l'écran ne permet de les distinguer. **Tranché
   le 1ᵉʳ octobre : le tag à 4 chiffres** — voir « Le tag, visible du MJ »
   ci-dessous.

**La disposition (piste A)**

- **En haut, un panneau « Invitations »** : la création d'une invitation sur
  une ligne (courriel *ou* lien, rôle, mot de passe optionnel, un seul bouton
  principal), puis les liens actifs en lignes calmes — rôle, date de création,
  étiquette « protégé », `Copier` visible, le reste dans ⋮ (`InviteRow`
  existant, déjà ainsi depuis V2.1-25). Le compte des liens dans l'en-tête du
  panneau (« 5 liens joueurs actifs · 0 lien MJ en attente »). L'état vide
  « Aucun lien MJ en attente » se réduit à cette mention : il n'a pas à
  occuper un grand cadre pointillé.
- **« À la table » : les MJ sur une ligne** (nom, étiquette MJ, et ce qu'ils
  ont en plus — ex. « Peut éditer : Prologue »). Un MJ peut déjà tout
  modifier : une carte entière pour lui serait du bruit.
- **Une carte par compte joueur**, en grille (3 colonnes sur grand écran,
  1 sur téléphone) :
  - en-tête : initiale, nom **suivi de son tag** (`Tamara#4821`, le tag en
    `text-ink-muted` et en chiffres tabulaires, plus discret que le nom),
    rôle, menu ⋮ du compte (« Forcer une réinitialisation », « Retirer de la
    campagne », tous deux confirmés) ;
  - **le PJ joué**, mis en avant (fond d'accent), avec son propre ⋮ («
    Ouvrir la fiche », « Libérer le personnage ») — ou, sans PJ, une zone
    pointillée « Aucun personnage — attribuer un PJ » qui ouvre le choix ;
  - **« Peut aussi modifier »** : les fiches octroyées en étiquettes, chacune
    retirable par ×, puis « + Partager une fiche » (le `Dropdown` de fiches
    existant, à l'endroit de la personne — on ne choisit plus le joueur dans
    un second menu, il est déjà donné par la carte).
- **En bas, « PNJ de la campagne · sans joueur »** : les PNJ attribués en
  étiquettes, et « + Ajouter un PNJ » (le geste « Attribuer » actuel, cas
  « PNJ (sans joueur) »).

**Étapes**

1. Relire `CampaignDetail.tsx` et `InviteLinkPanel.tsx` sur `master` (tous
   deux retouchés par V3.1-10) et lister chaque geste existant ; **aucun ne
   disparaît**, chacun reçoit une place dans la carte, le panneau ou l'encart.
2. Regrouper côté client les données que `/api/campaigns/[id]` renvoie déjà
   (`members`, `characters`, `grants`, `displayNames`,
   `passwordResetRequests`) en une vue par personne. **Aucune route ni
   requête nouvelle** : si ce regroupement semble en demander une, s'arrêter
   et le dire. Le regroupement est une fonction pure, testée.
3. **Le tag** (ADR 0032) : `/api/campaigns/[id]` renvoie
   `handleTags: Record<userId, string>` quand l'appelant gère la campagne,
   rien sinon ; test d'intégration des deux cas (MJ reçoit, joueuse ne reçoit
   pas). Nouvelle migration qui remplace le commentaire de colonne
   `profiles.handle_tag` (l'ancienne, appliquée, ne se modifie pas).
4. Composants : `CampaignPersonCard` (une carte), le panneau Invitations
   (réorganisation de `InviteLinkPanel`, `InviteRow` gardé tel quel),
   l'encart PNJ. `CampaignDetail` les assemble.
5. Libellés : « Retirer de la campagne » / « Libérer le personnage » /
   « Partager une fiche » ; textes des `ConfirmDialog` relus pour dire chacun
   sa portée exacte.
6. Vérifier en navigateur sur la campagne réelle (La Croisade des Ombres),
   aux largeurs bureau et 375 px, dans les quatre modes de la charte.

**Critères**

- [x] La fenêtre suit la piste A de l'esquisse : Invitations en haut, MJ sur
  une ligne, une carte par compte joueur, personnages sans joueur en bas.
  Vérifié au banc, puis **chez l'auteur le 9 octobre** sur la vraie campagne.
- [x] Chaque geste de l'écran actuel existe encore, et un seul endroit le
  porte — liste de l'étape 1 :

  | Geste d'avant | Où il vit maintenant |
  |---|---|
  | Inviter par courriel | Panneau Invitations, même ligne que le lien : un courriel saisi change le bouton en « Inviter par courriel » (et le rôle choisi s'applique, là où l'ancien formulaire n'envoyait que « joueur ») |
  | Générer un lien (rôle, mot de passe) | Panneau Invitations |
  | Copier, mot de passe, réinitialiser le personnage, révoquer un lien | `InviteRow`, inchangé |
  | Forcer une réinitialisation | Menu ⋮ de la carte (ou de la ligne MJ) |
  | Révoquer un membre | « Retirer de la campagne », menu ⋮ de la carte, confirmé |
  | Attribuer un PJ à une joueuse | Sa carte : « Aucun personnage — attribuer un PJ » (un PNJ peut toujours devenir son PJ) |
  | Attribuer un personnage sans joueur, ou à un MJ | Encart « Personnages sans joueur » : « PNJ (sans joueur) » ou « MJ — … » |
  | Révoquer une fiche PJ | « Libérer le personnage », menu ⋮ du PJ, **désormais confirmé** |
  | Accorder l'édition d'une fiche | « + Partager une fiche », sur la carte : plus de second menu pour choisir la joueuse |
  | Retirer un octroi | × sur l'étiquette de la fiche |
  | Rappels « référence personnelle » | En tête du panneau Invitations |

- [x] « Révoquer » n'apparaît plus pour deux portées différentes : « Retirer
  de la campagne » et « Libérer le personnage » sont distincts, et chacun
  confirme en nommant la personne et ce qu'elle garde.
- [x] « Forcer une réinitialisation » n'est plus répété sur chaque ligne ; une
  demande en attente reste visible sur la carte (« mot de passe oublié »).
- [x] Partager une fiche se fait depuis la carte de la personne, sans choisir
  de joueur dans un second menu.
- [x] Chaque compte tag est nommé `Nom#0000` partout dans cet écran, y
  compris dans les confirmations ; deux comptes de même nom se distinguent.
- [x] Le tag n'est renvoyé par `/api/campaigns/[id]` qu'à qui gère la
  campagne — **codé** (`isWorldAdmin` dans la route), **pas de test
  d'intégration** : il ne tournerait pas sans base dans la session cloud. À
  vérifier en direct avec un compte joueuse (la réponse ne doit porter aucun
  `handleTags` rempli). **Vérifié le 9 octobre.**
- [x] Aucune nouvelle route ; une seule migration
  (`20261001120000_handle_tag_visible_to_gm.sql`), celle du commentaire de
  colonne. Le reste est de la présentation.
- [x] Lisible à 375 px de large ; les quatre modes et le contraste élevé
  testés (charte §6) — **à faire en direct** : la grille passe à une colonne
  sous 768 px, deux jusqu'à 1 280, trois au-delà.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

**Comment c'est construit.** Le regroupement par personne est une fonction
pure, `groupCampaignPeople` (`src/core/campaigns/people.ts`, tests d'abord) :
MJ, joueuses, et les personnages que personne ne tient — PNJ, PJ libérés, et un
personnage resté au nom d'un compte qui n'est plus membre, qu'on ne perd pas.
Le panneau Invitations est `InviteLinkPanel`, réorganisé : son champ courriel
n'apparaît que dans la Gestion de campagne (l'onglet Accès de l'accueil,
Administration, le monte sans).

**Vérifié au banc** (Chromium, vrai CSS, données des captures de l'auteur) :
les huit tags affichés, plus aucun « Révoquer » à l'écran, la confirmation
« Retirer Tamara#0377 de la campagne ? ».

**Écarts avec l'esquisse, voulus :**
- Les liens MJ déjà utilisés (« Claude, lien créé le 27 septembre ») restent
  dans le panneau Invitations sous « Liens MJ utilisés » plutôt que sur la ligne
  du MJ : c'est là que vivent leurs gestes (mot de passe, révocation).
- « Ouvrir la fiche » n'est pas dans le menu du PJ : l'écran ne connaît que
  l'identifiant et le nom des fiches, pas leur adresse. Ce n'était pas un geste
  de l'ancien écran.
- La RLS de `profiles` laisse encore lire `handle_tag` à tout compte qui
  partage un monde : c'est l'état laissé par V3.1-10. Le filtrage voulu par
  l'ADR 0032 est fait par la route, comme la règle absolue 5 le demande ; une
  restriction en base serait un autre ticket.

**Le tag, visible du MJ — tranché le 1ᵉʳ octobre (ADR 0032).** Deux comptes
peuvent porter le même nom ; c'est précisément ce que le tag à 4 chiffres de
V3.1-10 sert à distinguer. Il s'affiche donc **au MJ de la campagne, dans cet
écran**, après le nom : `Tamara#4821`. Ce choix amende V3.1-10 et l'ADR 0031,
qui le voulaient « invisible hors des réglages du compte concerné » ; il reste
invisible partout ailleurs (liste vue par une joueuse, attribution publique,
wiki). Trois conséquences :

- **Filtrage serveur** (règle absolue 5) : `/api/campaigns/[id]` ajoute les
  tags à sa réponse **seulement** si l'appelant gère la campagne (la garde qui
  alimente déjà `canManage`). Une joueuse qui ouvre la même route ne reçoit
  aucun tag — pas un champ envoyé puis masqué.
- **Partout où le MJ nomme une personne dans cet écran** — cartes, ligne des
  MJ, textes des `ConfirmDialog` (« Retirer Tamara#4821 de la campagne ? ») —
  le tag suit le nom, pour qu'aucun geste ne vise le mauvais compte.
- Un compte ordinaire (courriel, sans tag) affiche son nom seul.

C'est une petite entorse au « aucune route nouvelle » des critères : la
route existe, elle gagne un champ. `getDisplayNamesForUsers` (ou une
variante) lit `handle_tag` en plus de `display_name`.

**Hors périmètre, et dit comme tel** : les cinq liens joueurs réutilisables
se ressemblent tous (seule leur date les distingue). Un seul suffit sans
doute ; les révoquer est un geste du MJ, pas un changement d'écran (mais voir
le bug ci-dessous : avant le correctif du 1ᵉʳ octobre, ce geste expulsait). Les
nommer (« lien Discord », « lien table du jeudi ») serait une fonctionnalité
neuve, à rouvrir si le besoin se confirme.

**Complément du 1ᵉʳ octobre — retirer un second MJ.** Demande de l'auteur :
pouvoir éjecter un MJ de la partie depuis le ⋮ de sa ligne, sauf le créateur du
monde.
- Le ⋮ d'un MJ propose « Retirer de la campagne » **si ce n'est pas le
  créateur du monde** (`worlds.owner_id`). La règle tient dans
  `canRemoveFromCampaign` (`src/core/campaigns/people.ts`, tests d'abord) ;
  `/api/campaigns/[id]` renvoie `worldOwnerId` au seul MJ (même borne que les
  tags).
- La confirmation parle d'un MJ : « n'est plus MJ de cette campagne… Son lien
  MJ, déjà utilisé, ne resservira pas : pour le faire revenir, génère un
  nouveau lien MJ. »
- **Faille fermée en base** (migration `20261001130000`) :
  `app.revoke_campaign_member` vérifiait que l'appelant gère le monde, jamais
  qui était visé. Or tout MJ de campagne gère le monde : un second MJ pouvait
  expulser le créateur en appelant la route à la main. La fonction refuse
  maintenant toute cible qui est le créateur du monde.
- Un MJ invité au niveau du monde (`world_members`, lien MJ de monde) perd sa
  place dans la campagne mais garde ses droits sur le monde : c'est
  « Révoquer » sur son lien qui les retire.
- Test d'intégration ajouté (`campaigns.integration.test.ts`), sauté sans base.
- [x] Vérifié en direct le 9 octobre : le ⋮ de Gabriel (créateur) n'a pas « Retirer » ;
  celui d'un second MJ l'a, et le retrait le fait disparaître de « À la table ».

**Bug trouvé en jouant (1ᵉʳ octobre) — révoquer un lien joueur expulsait des
joueuses.** L'auteur a révoqué les liens joueur en double pour n'en garder
qu'un (celui du 2 septembre) : les joueuses ont disparu de « À la table » et
leur PJ est redevenu libre. L'écran promettait pourtant « Celles qui l'ont
déjà utilisé gardent leur accès ».
- **Cause** : `app.revoke_campaign_invite_access` (V2.1-25) retire l'accès de
  `claimed_by_user_id`. Les liens joueur sont réutilisables depuis V3.1-10 et
  n'écrivent plus ce champ — mais ceux créés **avant**, sous l'ancien régime à
  usage unique, le portaient encore. Révoquer l'un d'eux expulsait la joueuse
  qui l'avait utilisé en premier.
- **Correctif** (migration `20261001140000`) : un lien joueur révoqué cesse
  seulement de fonctionner ; personne n'est expulsé. Retirer quelqu'un, c'est
  « Retirer de la campagne » dans son ⋮. Un lien MJ garde l'ancien
  comportement (le révoquer retire son MJ — c'est ce qui a servi à retirer
  Claude).
- Les comptes, eux, n'ont jamais été touchés : identifiant, mot de passe et
  tag restent valides. Seules les lignes `campaign_members` ont disparu.
  Réintégration donnée à l'auteur : une requête qui recrée la ligne
  `campaign_members` (rôle `player`) pour chaque `claimed_by_user_id` des liens
  joueur révoqués, puis réattribution des PJ depuis « Personnages sans
  joueur » ou « Attribuer un PJ ».
- Test d'intégration ajouté (`campaignInvites.integration.test.ts`), sauté
  sans base.

**Retour en jouant (1ᵉʳ octobre) — le sélecteur « attribuer un PJ » se
chevauchait.** Dans une carte joueuse, la liste, « Attribuer » et « Fermer »
ne tenaient pas sur une ligne et se repliaient les uns sur les autres ; le
chevron de la liste passait sous son libellé (`triggerClassName` remplace le
style de base du `Dropdown`, `inline-flex` compris). Désormais : une petite
boîte, la liste sur toute la largeur, puis « Annuler » et « Attribuer » (ou
« Partager ») en bouton plein, alignés à droite. Pour le PJ, la boîte remplace
la case pointillée au lieu de s'empiler dessous. Vérifié au banc.

**Retour en jouant (1ᵉʳ octobre) — plus de « peut aussi modifier » sur la
ligne d'un MJ.** Un MJ modifie déjà tout le monde : afficher ses octrois
d'édition (« peut aussi modifier : Prologue ») ne disait rien d'utile. La
mention disparaît de la ligne des MJ ; les cartes joueuses la gardent. Les
octrois eux-mêmes restent en base (rien n'est supprimé) : ils resserviraient
tels quels si ce compte redevenait joueur.

---

### ☑ V3.1-16 — Le Calendrier réel refait : une grille à bascule, côté MJ comme côté joueuse · `M`/`L` · sans modèle IA — **fait, vérifié en direct le 9 octobre**

**Modèle conseillé : Sonnet** — interface d'après l'esquisse ; reste la vérification en direct.

Constaté le 1ᵉʳ octobre par l'auteur, captures à l'appui : le Calendrier réel
du MJ (`SchedulingMjPanel.tsx`) empile deux grilles hautes qu'il faut faire
défiler dans les deux sens, perd les heures dès qu'on défile vers la droite,
affiche « ? » au survol à la place de l'auteur, et liste les 31 jours même
quand personne n'est disponible. La vue joueuse (`NextSessionPanel.tsx`,
page `joueur/prochaine-session`) est « pas ouf » : trois onglets, la
prochaine séance cachée derrière l'un d'eux, et aucune vue de la table.

**L'esquisse fait foi, au pixel près pour la grille** — canevas
[Calendrier réel — esquisses](https://claude.ai/artifact/Lh9FKyKz4zF3LbMSBCcXe5),
interactif (bouton Play de chaque cadre) :

- **Vue MJ** : cadre « A — Retenue : une grille, bascule Mes dispos / Toute
  la table », fichier `Main.dc.html`.
- **Vue joueuse** : cadre « Vue joueuse — même écran, sans les outils MJ »,
  fichier `Joueuse.dc.html`.

Les cadres B, C et D (une grille avec panneau latéral, une semaine à la fois,
jours en lignes) ont été regardés et écartés ; ils restent sur le canevas.
Dans l'esquisse, les disponibilités de l'auteur (11, 24, 25 octobre 10:00–22:00,
31 octobre 10:00–18:30) et les séances listées sont réelles ; **celles des
joueuses sont inventées** pour que la carte de chaleur ait quelque chose à
montrer. Comme pour V3.1-15, l'esquisse fait foi pour la disposition et les
comportements ; le code fait foi pour les jetons (`--accent`, `--edge`,
`--panel-*`), `Dropdown`, `ConfirmDialog` et la charte.

#### La grille — commune aux deux vues

Un seul composant de grille remplace `AvailabilityPaintGrid.tsx` et
`AvailabilityHeatmap.tsx` à l'affichage (la logique de peinture et
d'enregistrement de `AvailabilityPaintGrid` est reprise, pas réécrite).

- **Bascule « Mes disponibilités / Toute la table »** (segments, comme dans
  l'esquisse), au-dessus de la grille. Une seule grille à l'écran, jamais deux
  empilées.
  - *Mes disponibilités* : on peint ses créneaux (clic, ou glisser pour
    cocher ou décocher une plage), case pleine en `--accent`. À côté de la
    bascule, le total coché (« 9,5 h cochées »).
  - *Toute la table* : carte de chaleur, fond `--accent` d'autant plus opaque
    qu'il y a de monde, et la légende « Moins → Toute la table » sous la grille.
- **Géométrie de l'esquisse** : colonnes de jour de 40 px, lignes d'une
  demi-heure de 20 px, en-tête de dates de 46 px (jour abrégé au-dessus, numéro
  en dessous), colonne des heures de 68 px avec un libellé par heure pleine.
  Trait vertical plus marqué entre dimanche et lundi ; samedi et dimanche
  légèrement teintés dans l'en-tête.
- **Toutes les heures visibles sans défilement vertical** : la grille prend sa
  hauteur entière (créneau proposé de 08:00 à 22:00 = 28 lignes ≈ 600 px).
  **Une ligne de clôture affiche la dernière heure** (« 22:00 », en accent)
  sous la dernière demi-heure : on voit où finit le créneau proposé. Seul le
  défilement horizontal subsiste, sur les jours.
- **La colonne des heures reste à gauche** quand on défile vers la droite
  (`position: sticky`), et la ligne des dates reste en haut.
- **Surbrillance en croix au survol** : la date dans l'en-tête et l'heure dans
  la colonne de gauche passent en fond accent atténué ; la ligne et la colonne
  de la case s'éclaircissent légèrement ; la case visée est entourée. Vrai dans
  les deux modes.
- **Info-bulle au survol en mode « Toute la table »** : jour en toutes lettres
  et demi-heure (« samedi 24 oct. · 16:00–16:30 »), le décompte (« 5/8
  disponibles »), puis les noms, **la personne qui regarde en tête avec
  « (toi) »**. L'info-bulle passe à gauche de la case près du bord droit.
- **Barre de défilement aux couleurs de l'application** : celle de
  `app/globals.css` (6 px, piste transparente, poignée `--edge`,
  `--edge-strong` au survol), et une marge sous la grille pour qu'elle ne
  couvre jamais la ligne « 22:00 ». Ces règles `::-webkit-scrollbar` ne
  touchent pas Firefox, qui garde la barre du système — limite connue de
  `globals.css`, hors de ce ticket.

#### Les dates possibles — commune aux deux vues

- **Seulement les jours où au moins une personne est disponible.** Les jours
  à « 0/8 — aucun créneau commun » disparaissent.
- Une ligne par jour, comme dans l'esquisse : rang, décompte en grand (« 5/8 »),
  date, meilleur créneau et sa durée (« 14:00–22:00 · 8 h »), étiquette
  « Session complète » ou « Moins de 5 h » (selon la durée visée), les noms des
  présents sur ce créneau, une barre de remplissage.
- **Changement de règle, voulu** : le « meilleur créneau » d'un jour est la plus
  longue plage où le **plus grand nombre** de personnes est disponible, et le
  classement trie par ce nombre, puis par la durée. Aujourd'hui
  (`computeOverlap`/`rankDays`, `src/core/scheduling/overlap.ts`) il faut un
  créneau commun à **toutes** les personnes ayant répondu ce jour-là : une
  seule joueuse dispo le matin seulement suffit à classer le jour « aucun
  créneau commun », alors que quatre autres pourraient jouer 5 h. Fonction
  pure dans `src/core/scheduling`, **tests d'abord**, avec ce cas-là.

#### Vue MJ (`Main.dc.html`)

De haut en bas : en-tête (titre de la demande, « Créneau proposé · N jours ·
X réponses sur Y », durée visée, « Annuler la demande ») → la grille à bascule
→ « Dates possibles » avec un bouton « Confirmer » par ligne (accent plein pour
une session complète) → trois cartes côte à côte : « Régler une date à la
main », « Séances à venir » (avec « Annuler »), « Déjà jouées ».

#### Vue joueuse (`Joueuse.dc.html`)

La même page **sans aucun outil MJ** : ni durée visée, ni « Annuler la
demande », ni « Confirmer », ni date à la main, ni « Annuler » sur les séances.
Elle remplace les trois onglets actuels par une seule page :

1. **La prochaine séance confirmée, en tête et en grand** (carte avec la date
   en pavé, « Dimanche 18 octobre · 16:00 », « environ 6 h · dans 17 jours »).
2. **La demande ouverte** : titre, une phrase qui dit ce que le MJ propose
   (« du 1ᵉʳ au 31 octobre, entre 08:00 et 22:00 — coche tout ce qui t'irait »),
   l'état de sa réponse (« Réponse enregistrée »), puis la grille à bascule —
   **« Toute la table » compris**.
3. **« Les dates qui se dessinent »** : le même classement, en lecture seule,
   avec « c'est le MJ qui choisit ».
4. « Séances à venir » et « Déjà jouées », côte à côte, en lecture seule.

Sans demande ouverte, la section 2 se réduit à une ligne (« Aucune demande de
disponibilités pour le moment ») et la 3 disparaît.

**La joueuse voit la table : aucun droit nouveau.** La RLS de
`real_session_availabilities` ouvre déjà la lecture à tout membre du monde
(« rien ici n'est sensible entre coéquipières », migration
`20260913140000_real_scheduling.sql`). La route
`/api/campaigns/[id]/scheduling/requests/open`, qui renvoie la carte de chaleur
et le classement, ne vérifie que l'authentification : elle sert déjà à une
joueuse, il suffit que sa page l'appelle. Les champs propres au MJ (durée visée)
peuvent rester dans la réponse : ils ne sont pas secrets, seulement inutiles.

#### Deux bugs relevés en lisant le code — corrigés par ce ticket

1. **Le « ? » à la place de l'auteur.** `resolveNamesIncludingGm`
   (`src/server/services/scheduling.ts`) ne nomme que **le premier** MJ trouvé
   (`members.find(m => m.role === "gm")`). Avec deux MJ (Claude et Gabriel),
   l'autre reste sans nom, rendu « ? » par `AvailabilityHeatmap`. Tous les MJ
   sont nommés.
2. **Le « /8 ».** `totalMembers` compte tous les membres de la campagne : les
   deux MJ et le doublon « Tamara ». Le dénominateur devient **les personnes
   attendues à la table** : les joueuses et le MJ qui a ouvert la demande — pas
   un second MJ qui ne répond pas.

#### Points tranchés par l'esquisse, à respecter

- **Les noms affichés sont ceux des personnes**, pas de leurs PJ : l'info-bulle
  et les dates possibles disent « Soso », pas « Fine Lââm ». Aujourd'hui
  `resolvePlayerNames` renvoie le nom du PJ. Lire `display_name` (et le tag de
  V3.1-15 si deux comptes portent le même nom, côté MJ seulement — ADR 0032).
- **Enregistrement côté joueuse** : l'esquisse montre un bouton « Enregistrer
  mes disponibilités ». Aujourd'hui `AvailabilityPaintGrid` enregistre seule, à
  chaque relâchement de la souris. **On garde l'enregistrement automatique** (un
  bouton oublié perd une réponse) et le bouton de l'esquisse devient une ligne
  d'état à la même place : « Enregistrement… » puis « Enregistré ✓ », et l'erreur
  en `--danger` si l'écriture échoue. À rouvrir si l'auteur préfère le bouton.
- Côté MJ, la grille « Mes disponibilités » remplace la grille de peinture
  actuelle : le MJ répond comme une joueuse.

**Étapes**

1. Noyau (`src/core/scheduling`), **tests d'abord** : meilleur créneau d'un jour
   (plus grand nombre, puis plus longue plage), classement, filtrage des jours
   vides, total coché.
2. Serveur : nommer tous les MJ, dénominateur « attendus à la table », noms de
   personnes au lieu des PJ. Tests d'intégration sur deux MJ.
3. Composant de grille unique (bascule, sticky, croix, info-bulle, ligne
   22:00, barre de défilement), monté par les deux vues.
4. `SchedulingMjPanel` réorganisé selon `Main.dc.html`.
5. `NextSessionPanel` réécrit selon `Joueuse.dc.html` (fin des trois onglets).
6. Vérifier en navigateur, avec un compte MJ et un compte joueuse, sur la
   campagne réelle : bureau et 375 px, les quatre modes, le contraste élevé.

**Critères**

- [x] Vue MJ et vue joueuse conformes à `Main.dc.html` et `Joueuse.dc.html`,
  comparées côte à côte avec l'esquisse. **Fait chez l'auteur le 9 octobre**, sur la
  campagne réelle, avec un compte MJ et un compte joueuse.
- [x] Une seule grille par vue, avec la bascule « Mes disponibilités / Toute la
  table » (`AvailabilityGrid.tsx`, monté par `SchedulingMjPanel` et
  `NextSessionPanel` ; `AvailabilityPaintGrid` et `AvailabilityHeatmap`
  supprimés).
- [x] De 08:00 à 22:00, toutes les heures sont visibles sans défilement
  vertical, la ligne « 22:00 » comprise, et la barre de défilement ne la
  couvre pas.
- [x] Les heures restent visibles en défilant vers la droite. *La ligne des
  dates n'a plus besoin de rester en haut : la grille n'a plus de défilement
  vertical.* La colonne des heures a un fond opaque (le panneau posé sur le fond
  de page) : `--panel` est translucide, et les cases défilant dessous
  transparaissaient.
- [x] Au survol, la date et l'heure de la case s'allument, sa ligne et sa
  colonne s'éclaircissent (ombre intérieure, visible aussi sur une case vide) ;
  en « Toute la table », l'info-bulle donne les noms, le sien en tête avec
  « (toi) », et **jamais « ? »** : tous les MJ sont nommés.
- [x] Les dates possibles ne listent que les jours où quelqu'un est disponible,
  classées par nombre de présents puis par durée (`bestWindow.ts`, tests
  d'abord : le cas « une joueuse le matin ne casse plus la journée », et deux
  groupes contigus de même taille jamais fusionnés).
- [x] La vue joueuse ne montre aucun outil MJ, met la prochaine séance en tête,
  et laisse voir la table. Page élargie (`max-w-lg` → `max-w-5xl`).
- [x] La barre de défilement reprend le style de `app/globals.css` (rien à
  écrire : la règle globale s'applique).
- [x] Sans demande en cours, le MJ voit la prochaine séance et un écran vide
  avec « Demander les disponibilités » ; le formulaire s'ouvre au clic, avec
  l'aperçu en direct de la grille (`SansDemande.dc.html`, `Formulaire.dc.html`).
- [x] La grille suit la forme de la demande : colonnes élargies jusqu'à 140 px
  quand il y a peu de dates, mois dans l'en-tête (`EnCours.dc.html`).
- [x] `npm run typecheck && npm run lint && npm run test` passent.

#### Avant et après la demande — ajouté le 1ᵉʳ octobre

Le ticket ne disait rien de l'écran **sans demande en cours**, ni du
**formulaire** qui en ouvre une. L'auteur a demandé à les voir, et à vérifier
que la grille s'adapte à une demande d'une autre forme. Trois cadres ajoutés au
même canevas, rangée « Avant et après la demande », retenus tels quels
(« Allons comme ça ») :

- **`SansDemande.dc.html` — MJ sans demande en cours** : la prochaine séance
  confirmée en tête (la même carte que chez la joueuse, `NextSessionCard`), un
  panneau vide « Aucune demande de disponibilités en cours » avec une phrase
  d'explication et le bouton « Demander les disponibilités », puis les trois
  cartes du bas. Le formulaire ne s'affiche plus d'office : il s'ouvre au clic.
- **`Formulaire.dc.html` — formuler une demande** : trois étapes numérotées
  (nom, dates, plage horaire) et, dessous, **l'aperçu en direct de la grille
  que verront les joueuses** (`AvailabilityGrid` en mode `preview` : ni
  bascule, ni peinture, ni enregistrement). « Annuler » revient à l'écran vide,
  « Envoyer la demande » crée la ronde, comme le « Créer » d'avant.
- **`EnCours.dc.html` — une autre demande** : week-ends de 19:00 à 23:00 sur
  deux mois, pour montrer l'adaptation.

**La grille s'adapte à la demande — c'était déjà vrai, deux choses ajoutées.**
Ses colonnes sont les dates proposées (et elles seules, même non contiguës), ses
lignes la plage horaire par demi-heure, sa ligne de clôture l'heure de fin. Le
curseur va de 00:00 à 24:00 : une demande ne passe jamais minuit. Ajouté :

- **Colonnes élargies quand il y a peu de dates** : la largeur se mesure
  (`ResizeObserver`) et se répartit, entre 40 et 140 px. Huit dates en font
  122 ; trente et une restent à 40, avec défilement.
- **Le mois dans l'en-tête**, au premier jour puis à chaque changement
  (« oct. », « nov. ») : une demande à cheval sur deux mois ne disait pas à quel
  mois appartenait le « 1 ». L'en-tête passe de 46 à 58 px.

**Le formulaire, ce qui change et ce qui reste.**
- Deux mois côte à côte au lieu d'un, flèches pour avancer ; clic et
  clic-glissé comme avant. **Les jours passés ne se choisissent plus** (ils
  restent visibles) : une date candidate passée n'a jamais de sens.
- L'onglet « Jours de la semaine » **garde son fonctionnement** (jours cochés,
  « Du … au … », « Appliquer ») : l'esquisse le simplifiait sur deux mois fixes,
  ce qui aurait perdu la plage libre. Seul le style change.
- Le curseur horaire (`TimeRangeSlider`) se glisse toujours, et gagne des
  boutons − / + d'une demi-heure de chaque côté et une échelle 00:00 → 24:00.
- Même envoi au serveur qu'avant : aucune route ni donnée touchée.

**Vérifié au banc** (même méthode que plus bas) : 8 dates de week-end sur deux
mois → colonnes de 122 px, « oct. » et « nov. » dans l'en-tête ; dans le
formulaire, cinq dates cliquées → l'aperçu en compte cinq, et « Finir plus
tard » ajoute une ligne (40 → 45 cases).

#### Bug trouvé en jouant — corrigé le 1ᵉʳ octobre

**Constat (auteur)** : régler une date à la main pendant la demande d'octobre
a fermé la demande, et les disponibilités cochées ont disparu de l'écran.

**Cause** : `createRealSession` fermait la demande ouverte à **chaque** séance
confirmée, manuelle comprise (comportement de V3.1-8, étape 6, pensé pour le
seul bouton « Confirmer » des dates possibles). **Rien n'était effacé** :
fermer une demande ne fait que passer `availability_requests.status` à
`closed`, et les réponses restent en base, rattachées à elle
(`real_session_availabilities.request_id`).

**Correction** : seule une séance confirmée **depuis les disponibilités**
(`source: "availability"`) ferme la demande ; une date réglée à la main
(`source: "manual"`) est indépendante et la laisse ouverte. Test
`scheduling.createRealSession.test.ts`, écrit avant la correction et vu
échouer dessus.

**Récupérer la demande fermée par erreur** : la rouvrir suffit, les réponses
reviennent avec elle. À faire à la main dans l'éditeur SQL de Supabase (aucun
écran ne rouvre une demande aujourd'hui).

**Ce qui a été vérifié, et comment.** Sans base dans la session cloud, la grille
a été montée seule dans Chromium (Playwright), alimentée par une demande
d'octobre et des réponses de test : réponse existante relue (44,5 h cochées),
colonne des heures immobile à 600 px de défilement, info-bulle « 3/6 disponibles
· Gabriel (toi) · Soso · Leïla », classement des dates, et un glisser sur quatre
cases qui enregistre **une seule plage** `10:00–12:00` — la forme d'avant. Les
routes, la RLS et les deux écrans complets n'ont pas tourné : c'est la
vérification en direct qui reste.

**Les réponses déjà déposées pour octobre ne bougent pas** (demande de l'auteur
pendant le codage) : aucune migration, aucune écriture nouvelle. Une réponse
reste « une plage par jour et par personne » ; seuls le calcul du classement et
l'affichage changent.

**Décisions prises en codant :**
- Noms : **la personne seulement** (`profiles.display_name`), tranché par
  l'auteur le 1ᵉʳ octobre — l'ancien commentaire « les comptes s'identifient par
  leur personnage partout » ne vaut plus pour cet écran. `resolvePlayerNames`
  (nom du PJ) reste inchangé pour le Livre de sessions. Le tag de V3.1-15 n'est
  pas ajouté ici : il vient avec V3.1-15.
- Dénominateur : les joueuses, le MJ qui a ouvert la demande, et tout autre
  membre qui a répondu (`expectedAtTable`). Le doublon « Tamara » compte encore,
  c'est un vrai membre : V3.1-15 permettra de le retirer.
- Enregistrement : automatique au relâchement, comme avant, avec une ligne
  d'état « Enregistrement… / Enregistré ✓ » à côté de la bascule.
- `computeOverlap`/`rankDays` supprimés avec leurs tests : plus aucun appelant.
- Pas de test d'intégration sur deux MJ : il ne tournerait pas sans base. La
  règle du dénominateur est testée dans le noyau ; les noms viennent d'une seule
  requête groupée sur `profiles`.

---

### ☑ V3.1-21 — Cibler et résoudre depuis les boutons de jet · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0042, 0041) → V3.1-105, 106, 107**

**Modèle conseillé : Opus** — résolution partagée par MJ, joueur et solo ; dés lancés par le serveur (règle 8).

**4 octobre — ADR 0036 §6** : cœur commun extrait de `playTurn` ; l'initiative en cours, c'est `combats` et ses participants ; un jet secret qui touche reste secret mais s'applique. L'outil de dés (V3.1-33) livre « Cibler » grisé, ce ticket l'allume.

**Constat.** Les boutons de jet de la fiche (touche, dégâts, sorts, soins)
lancent un dé et l'affichent ; c'est ensuite à la table de calculer et de
reporter le résultat à la main sur la cible. Le mode solo, lui, sait déjà
viser une cible du combat en cours, lire sa CA et établir le verdict
(V3-B1), puis appliquer les effets (V3-B2).

**Décision de l'auteur.** Partout dans l'application (desktop, tablette,
téléphone ; fiche, outil Table, outil Initiative) : **quand une initiative
est lancée**, un bouton de jet demande d'abord une **cible parmi les
participants**, puis tout se résout et s'applique seul — jet de touche
contre la CA, jet de sauvegarde de la cible contre le DD, dégâts (dés doublés
au critique, PV temporaires d'abord), états posés, soins, emplacement dépensé,
PJ à 0 PV → jets contre la mort, créature à 0 PV → sortie de l'initiative.
Sans initiative, rien ne change : le jet s'affiche, sans cible.

Esquissé : fiche complète (bouton « Voir hors combat / en combat ») et outil
Table (au tour du Worg, « Morsure » sur un PJ : touche, dégâts, JS de Force,
À terre).

**Revu le 4 octobre : tout passe par l'outil de dés (ADR 0035).** Un bouton de jet de la
fiche (touche, dégâts, sort, soin, caractéristique, sauvegarde, compétence,
initiative) **ouvre l'outil de dés pré-rempli** (dés, modificateur, libellé)
au lieu de lancer ; on peut encore ajouter un dé, l'avantage ou le secret, puis
on **confirme par « Lancer »**. L'outil gagne un bouton **« Cibler »** sur la
ligne de « Lancer » et « Effacer » : il liste les participants de
l'initiative (alliés pour un soin), affiche la cible retenue, et se grise hors
initiative ou pour un jet sans cible (test, sauvegarde). Une touche réussie
fait apparaître la bande « Lancer les dégâts » (V3.1-33 ; dés doublés au critique), même cible
conservée. Partout : MJ, joueur, **solo** (la barre d'intention de V3-B1 y
pré-remplit l'outil de la même façon). Avis : bonne idée — un seul endroit
pour l'avantage, le modificateur, le secret et la cible ; le coût est un
toucher de plus par jet, compensé par le pré-remplissage.

**Contraintes (règles absolues).** Les dés sont lancés par le serveur et la
résolution passe par le moteur (`resolveAttackRoll`, `resolveDamageRoll`,
`eventsForAttack`…) : le client ne calcule rien. Chaque étape est journalisée
comme en solo ; « Annuler » est une écriture inverse journalisée, pas un
effacement. L'autorisation passe par `canEditEntity` (un joueur cible avec
son PJ, le MJ avec n'importe quel participant).

**À trancher avant de coder.**
- Réutiliser telle quelle la résolution du tour solo (`playTurn`) ou en
  extraire le cœur commun — probablement la seconde : le solo ajoute
  l'interprétation et la narration, que la table n'a pas.
- Où vit « l'initiative en cours » côté multijoueur : la table `combats`
  (participants, CA) existe ; vérifier qu'elle suffit pour les PNJ sans fiche.
- Ce qui est montré au joueur ciblé et aux autres (visibilité côté serveur).

**Critères d'acceptation**
- [ ] Initiative lancée : tout bouton de jet offensif ou de soin demande une cible parmi les participants.
- [ ] Touche, sauvegarde, dégâts, états et soins résolus par le moteur et appliqués, journalisés.
- [ ] Même comportement depuis la fiche, l'outil Table et l'outil Initiative, sur tous les écrans.
- [ ] Sans initiative, les jets restent de simples jets.
- [ ] « Annuler » revient en arrière par une écriture journalisée.

---

### ☑ V3.1-23 — Ce que les joueurs modifient eux-mêmes (Règles actives) · `M` · sans modèle IA — **conçu le 9 octobre (ADR 0043) → V3.1-108, 109 (écran : 57)**

**Modèle conseillé : Opus** — droits d'écriture des joueurs, appliqués côté serveur ; schéma à vérifier.

**4 octobre — ADR 0036 §5, accepté par l'auteur** : colonne `table_settings jsonb` sur `campaigns`, validée par `zCampaignTableSettings`, qui porte aussi le maximum d'inspiration (1 par défaut, réglé dans Règles actives). Migration et mise à jour de `docs/SCHEMA.md` dans ce ticket.

**Constat.** Un joueur peut aujourd'hui toucher à tout ce que sa fiche affiche
en commande. À la table, certaines valeurs sont la prérogative du MJ — les
états (Charmé, À terre…) surtout, et l'inspiration — d'autres sont plus
pratiques tenues par le joueur (PV, pièces, emplacements, dés de vie).

**Décision de l'auteur.** Dans l'outil MJ **Règles actives**, une section
« **Ce que les joueurs modifient eux-mêmes** » : un interrupteur par valeur —
leurs **états**, leur **inspiration**, leurs **PV**, leurs **pièces**, leurs
**emplacements de sorts**, leurs **dés de vie**. Réglage de la campagne, valable
**partout dans l'application** : fiche sur ordinateur, tablette et téléphone,
fenêtres du MJ, tout écran où le joueur voit sa fiche.

- Par défaut : états et inspiration au MJ seul ; PV, pièces, emplacements et
  dés de vie au joueur.
- Interrupteur coupé : le joueur voit la valeur, sans commande (pas de
  « + état », pas de ▲▼ sur l'inspiration) ; le MJ la change depuis la fiche
  ou l'outil Table.
- Interrupteur allumé : le joueur la change sur sa fiche ; chaque changement
  est journalisé.
- Les changements faits par le moteur (dégâts résolus par V3.1-21, repos) ne
  dépendent pas de ces réglages.

Esquissé : planche « Téléphone du MJ — feuilles ouvertes », écran Outils →
Règles actives ; planche « Décidé · fiche vue par le MJ et par le joueur »
(zone « Fiche de personnage ») : les six interrupteurs, vivants, pilotent la
fiche de la joueuse — coupé, la commande disparaît (« + état », ▲▼ de
l'inspiration, des PV, des pièces ; colonnes « niv. » de l'égaliseur
inertes ; « Dépenser un dé » du repos court remplacé par « Le MJ dépense
tes dés de vie »).

**À vérifier avant de coder** (règles de méthode) : où vit ce réglage
(table ou colonne de campagne) et si `docs/SCHEMA.md` le prévoit — sinon
s'arrêter et demander. L'autorisation passe par le serveur (`canEditEntity`
étendu, ou une vérification à côté) : un interrupteur coupé refuse
l'écriture côté serveur, pas seulement l'affichage du bouton.

**Critères d'acceptation**
- [ ] Six interrupteurs dans Règles actives, réglage de campagne, valeurs par défaut ci-dessus.
- [ ] Interrupteur coupé : aucune commande côté joueur, et l'écriture est refusée par le serveur.
- [ ] Même comportement sur ordinateur, tablette et téléphone.
- [ ] Le MJ garde toutes les commandes, quels que soient les réglages.

---

### ☑ V3.1-37 — L'initiative vue des joueurs : sécurité, invitation, temps réel · `M` · sans modèle IA — **conçu le 9 octobre (ADR 0040) → V3.1-101, 102, 103**

**Modèle conseillé : Opus** — RLS à resserrer, nouvelle vue filtrée pour les joueurs, signal temps réel.

**Constat (lu le 4 octobre, `20260818120001_combats.sql`).** Les politiques
de `combats` et `combat_participants` sont restées celles de la « Phase 0 » :
**tout membre du monde lit et écrit** les deux tables. Un joueur peut donc
déjà, par l'API, lire les PV et la CA des adversaires ou modifier un combat
— la règle absolue 5 n'est tenue que parce qu'aucun écran joueur ne les
affiche. À corriger avant tout écran joueur.

**À faire**
1. **RLS** (nouvelle migration) : écriture réservée au MJ de la campagne sur
   les deux tables ; lecture de `combat_participants` réservée au MJ. La
   ligne `combats` (statut, round, tour) reste lisible des membres : elle
   ne porte rien de secret et sert de signal.
2. **Vue joueur** côté serveur (`GET`, Zod) : l'ordre, le tour, le round ;
   pour chaque participant, son nom **affiché** (le renommage est le
   `label`, le nom d'origine se lit de `rule_key` ou de l'entité et ne sort
   que pour le MJ) ; PV pour les alliés, **état de blessure** calculé côté
   serveur pour les adversaires (Indemne ≥ max, Blessé > ½, En sang > 0,
   Hors de combat 0) ; jamais de CA adverse.
3. **Invitation et jets** : statut « jets d'initiative » entre préparation et
   round 1 ; un joueur dont le PJ combat lance son initiative (serveur) ou
   saisit un vrai dé, avec ou sans modificateur (même principe que
   « annoncé à la main », V3-B5) ; le MJ peut saisir à sa place ; le combat
   terminé (confirmé par le MJ) ramène la fiche normale.
4. **Temps réel** : un signal sans donnée sensible (changement de la ligne
   `combats`, ou canal de diffusion) ; le client du joueur relit la vue
   filtrée. Reprendre le mécanisme déjà utilisé par le chat
   (`ChatPanel.tsx`).
5. Vérifier `docs/SCHEMA.md` : si le statut « jets d'initiative » demande
   une valeur de plus dans le `check` de `combats.status`, c'est un
   changement de schéma — le mettre à jour dans le même ticket.

**Critères d'acceptation**
- [ ] Test d'intégration RLS : un joueur ne lit aucune ligne de `combat_participants` et n'écrit ni `combats` ni `combat_participants`.
- [ ] La vue joueur ne contient ni PV ni CA ni nom d'origine d'un adversaire (test).
- [ ] Invitation, jet du joueur, saisie du MJ, fin confirmée : chacun journalisé.

---

### ☑ V3.1-39 — Les sauvegardes demandées à la cible · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0044) → V3.1-110, 111, 112**

**Modèle conseillé : Opus** — nouveau flux joueur ↔ MJ, et une donnée de règle à ajouter aux effets.

**Demande (4 octobre).** Un sort comme Moquerie cruelle ne se « lance »
pas sur la cible : c'est **la cible qui résiste** par un jet de sauvegarde.
Quand une action impose une sauvegarde, la cible reçoit une demande au
premier plan — « Résiste à Moquerie cruelle · JS Sagesse DD 13 » — avec,
comme pour l'initiative : lancer via l'application, saisir un vrai dé
(interrupteur « modificateur inclus »), ou laisser le MJ saisir la valeur.
Le résultat revient à l'outil de dés de l'auteur, qui affiche le verdict et
enchaîne les dégâts ou l'effet.

**Où le MJ répond.** En combat : dans l'outil Initiative (la demande s'y
affiche en bandeau). Hors combat : dans l'outil **Table**, qui liste déjà
les PJ — c'est la bonne place (avis : d'accord) ; une pastille sur le dé
encoché signale une demande en attente, où qu'on soit. Un PNJ ou un
monstre ciblé : le MJ lance ou saisit, comme pour l'initiative.

**Les règles exactes.** Le moteur doit vérifier la cible avant de demander
quoi que ce soit : Charme-personne ne vise qu'un humanoïde, certains effets
ignorent les créatures immunisées à un état. **Constat (lu le 4 octobre)** :
un effet (`zEffectData`, `src/core/schemas/rule-blocks/blocks.ts`) porte sa
sauvegarde (`save.ability`) ou son attaque, mais **aucune restriction de
cible** ; les types de créature existent sur les blocs de stats et les
espèces. À ajouter : un champ optionnel de restriction (types de créature,
immunités d'état), validé par Zod — pas de migration SQL (`jsonb`), mais
les fiches SRD concernées devront le recevoir. Aucun ticket existant ne le
couvre ; il complète V3.1-21 (résolution) et V3-A6 (règles à
déclencheurs).

**Dépend de** : V3.1-21, V3.1-37 (signal temps réel), V3.1-34 (Table).

**Critères d'acceptation**
- [ ] Une sauvegarde imposée à un PJ arrive à son joueur ; lancer, vrai dé ou saisie du MJ y répondent.
- [ ] Le résultat revient à l'auteur du jet ; verdict, puis dégâts ou effet appliqués.
- [ ] Une cible hors restriction (Charme-personne sur un mort-vivant) est refusée avant toute demande (test du noyau).
- [ ] Hors combat, la demande s'affiche dans l'outil Table ; en combat, dans l'Initiative.

---

### ☑ V3.1-40 — Ressources de classe : magie de pacte et recharge partielle · `M` · sans modèle IA — **conçu le 9 octobre (ADR 0045) → V3.1-113, 114**

**Modèle conseillé : Opus** — deux formes de données que le moteur ne connaît pas encore.

**Constat (lu le 5 octobre).** Les ressources de classe sont génériques
(`src/core/schemas/blocks/resources.ts` : maximum en formule, recharge
`short_rest` / `long_rest` / `dawn` / `never`) et les emplacements de sorts
se dérivent de la progression de la classe (`spellcasting.ts`). Deux règles
2024 n'y entrent pas :
- **la magie de pacte** de l'occultiste : des emplacements tous du même
  niveau (5 au niveau 20), rendus au repos court, distincts des
  emplacements ordinaires (un multiclassé a les deux) ; l'Arcanum mystique
  (un sort précis par niveau 6 à 9, une fois par repos long) ;
- **la recharge partielle** : Rage, Conduit divin, Forme sauvage, Second
  souffle rendent **une** utilisation au repos court et toutes au repos long.

**À faire** : une valeur de recharge de plus (une au repos court), une
source d'incantation « pacte » dans `spellcasting`, les repos (V3.1-24) qui
les appliquent, et la ligne d'égaliseur (planche « Décidé · emplacements et
ressources de classe ») qui les affiche. Validé par Zod, sans migration SQL
(`jsonb`). Les libellés français des ressources (points de focalisation,
Ruse magique…) sont à vérifier dans le manuel de l'auteur.

**Critères d'acceptation**
- [ ] Un occultiste 20 a 4 emplacements de pacte de niveau 5, rendus au repos court ; un multiclassé garde les deux réserves séparées.
- [ ] Un repos court rend une Rage, un repos long toutes (test du noyau).
- [ ] Une ressource de plus de six utilisations s'affiche en compteur.

---

### ☑ V3.1-47 — Création : les règles de personnage viennent du ruleset · `L` · sans modèle IA — **conçu le 9 octobre (ADR 0046) → V3.1-115 à 119**

**Modèle conseillé : Opus** — structures de données de règles, ADR, et lien avec le mécanisme générique des choix.

**Principe de l'auteur (6 octobre)** : **aucune règle de personnage écrite
en dur**. Le ruleset porte tout ; un ruleset maison peut tout changer.

**Inventaire — ce qui est déjà en données** : `class_progression` (avec
`max_level`), `subclass_slot.chosen_at_level`, le dé de vie, la progression
d'incantation (budgets de sorts).

**À structurer (ce ticket)**, chacun validé par Zod (`jsonb`, sans
migration SQL sauf si `docs/SCHEMA.md` l'exige — alors s'arrêter et
demander) :
1. **Plafond de niveau du personnage** (20 en D&D 2024) — aujourd'hui seul
   le plafond par classe existe.
2. **Prérequis de multiclassage structurés** (caractéristique ≥ valeur,
   « et » / « ou ») — `prerequisites` n'est que du texte libre ; le contrôle
   reste indicatif tant que ce n'est pas fait. Le MJ peut passer outre.
3. **Améliorations de caractéristiques et dons, don épique** comme
   **choix accordés par une ligne de progression** (niveau, nature du
   choix) — à brancher sur le mécanisme générique des choix
   (V3.1-3, V3.1-6, V3.1-7), qui reste à concevoir : **ce ticket le conçoit
   s'il n'existe pas encore**, ADR à l'appui.
4. **Génération des caractéristiques** : tableau standard, budget et coûts
   de l'achat de points, formule du tirage — aujourd'hui constantes de
   `src/core/rules/abilityGeneration.ts` (`STANDARD_ARRAY`,
   `POINT_BUY_BUDGET`, `POINT_BUY_MIN/MAX`, `ROLL_*`) ; plus l'**ordre de
   répartition suggéré par classe** (« Répartir pour un clerc »).
5. **Charge** : le multiplicateur de Force (7,5 kg par point en 2024).
6. **Départ à haut niveau** : la table « Commencer à un niveau supérieur »
   (or en plus, somme fixe + jet du serveur, objets magiques à choisir aux
   niveaux élevés). **Valeurs à vérifier dans le MdJ 2024** par l'auteur
   avant saisie (CLAUDE.md : le contenu de règles va en base, jamais dans
   une migration ni un seed suivi par Git).
7. **Revente** : le ratio de vente en jeu (moitié du prix en 2024).
8. Le noyau lit ces valeurs dans le ruleset résolu
   (`src/server/services/resolvedRuleset.ts` → `src/core`), avec les valeurs
   2024 comme **valeurs de la base officielle**, pas comme constantes de
   repli dans le code.

**Critères d'acceptation**
- [ ] ADR écrit (structures, lien avec les choix génériques).
- [ ] Un ruleset de test au plafond 15 limite la création à 15 (test).
- [ ] Un prérequis non rempli est signalé ; le MJ peut passer outre (test).
- [ ] Plus aucune constante de génération dans `abilityGeneration.ts` (lu du ruleset), tests du noyau verts.

---

### ☑ V3.1-62 — Rapidité : mesurer, puis recâbler · `M` · sans modèle IA — **fait le 12 octobre (mesures, ADR 0055 et 0056, `docs/CABLAGE.md`)**

**Modèle conseillé : Opus** pour la mesure et le plan (étapes 1 et 2), **Sonnet** pour appliquer les corrections listées (étape 3).

**Question de l'auteur (8 octobre)** : faut-il revoir le « câblage » pour
rendre l'application plus rapide ? **Oui, mais en mesurant d'abord.** Ce
qui est déjà bien : `createClient`, `getAuthUser` et `getWorldBySlug` sont
mis en cache par requête (`cache()` de React) ; plusieurs services publics
aussi. Relevé dans le code le 8 octobre, sans mesure :
- **Chargements après affichage** : 56 composants lancent un `fetch` dans un
  `useEffect` — l'écran s'affiche vide (« … ») puis se remplit, souvent en
  cascade (une requête attend la précédente). Les fenêtres du MJ demandent
  leurs données à `/api/worlds/[worldSlug]/mj/[tool]/window` **après**
  l'ouverture.
- **Rafraîchissements complets** : 32 `router.refresh()` — chacun relance
  tout l'arbre serveur de la page (layouts compris : arborescence, entités,
  campagnes) pour un seul changement ; un `window.location.reload()`
  (`DeletedEntitiesPanel`).
- **Attentes en série** dans les layouts et la route des fenêtres : monde →
  utilisateur → droits → campagnes, l'un après l'autre alors que plusieurs
  sont indépendants.
- **Requêtes par ligne** : l'Initiative charge chaque PJ un par un
  (`getEntityById` par participant, route des fenêtres, cas `initiative`).
- **Peu de chargement progressif** : 3 `loading.tsx`, 2 `<Suspense>` — une
  page lente bloque tout l'écran.
- **Deux allers-retours d'authentification par navigation** (le
  middleware et le serveur appellent chacun `auth.getUser()`) — à mesurer
  avant d'y toucher : la vérification réseau est un choix de sécurité
  documenté dans `lib/supabase/middleware.ts`.

**À faire**
1. **Mesurer** (Opus) : temps serveur des pages les plus utilisées (fiche
   du wiki, fiche de personnage, ouverture d'une fenêtre d'outil, accueil,
   page joueur) — en-tête `Server-Timing` ou journal en développement —, et
   nombre de requêtes à la base par page. Écrire les chiffres ici.
2. **Planifier** (Opus) : classer les causes par gain mesuré ; écrire un ADR
   court sur les conventions retenues (données initiales en props,
   mises à jour optimistes, `Promise.all`, `loading.tsx` par zone,
   `revalidatePath` ciblé plutôt que `router.refresh()` global), qui devient
   la règle commune 6 des tickets du lot i.
3. **Recâbler** (Sonnet) : les corrections listées par le plan, une par
   commit, **sans changer aucun comportement** ; les outils refaits par le
   lot i suivent déjà la règle 6.

**Fait le 11 octobre (étapes 1 et 2).**
- **Instrumentation** : `lib/supabase/measuredFetch.ts`, en développement seulement, active avec `CREADONJON_MESURE=1`.
- **Outils de mesure** : `scripts/mesure-cablage.mjs` (pilote) et `scripts/analyse-mesure.ts` ; `src/core/mesure/vagues.ts` compte les vagues, avec ses tests.
- **Mesures** sur le Banc d'essai, dans `docs/CABLAGE.md` §3. La fiche de personnage coûte 581 requêtes, 123 vagues et 44 chargements après affichage.
- **Décision** : ADR 0055, sept règles C1 à C7.
- **Garde-fou** : le cliquet `lib/cablage.test.ts`.

**Étape 3 (Sonnet)** : suivre `docs/CABLAGE.md` §7, dans l'ordre. *Correction 1, partie C2, faite le 11 octobre par Opus : le contexte était déjà chargé dans la session (skill `deleguer`, règle 1). Mesures dans `docs/CABLAGE.md` §3.* Une correction par commit, une mesure après chacune, le plafond du cliquet abaissé à chaque fois.

**Étape 3 faite les 11 et 12 octobre** (par Opus, le contexte étant chargé) : les six corrections de `docs/CABLAGE.md` §7, une par commit, chacune mesurée. Chemin détaillé dans `docs/CABLAGE.md` §3, rechargements restants justifiés au §6.

**Avant / après** (Banc d'essai, développement, médiane de 3 essais ; avant le 11 octobre, après le 12 octobre) :

| Écran | Requêtes à la base | Vagues | Chargements après affichage | Écran stable |
|---|---|---|---|---|
| MJ, accueil du monde | 68 → 25 | 28 → 8 | 3 → 0 | 6,7 s → 4,0 s |
| MJ, fiche du wiki | 42 → 29 | 14 → 11 | 3 → 0 | 3,3 s → 3,5 s |
| MJ, fiche de personnage | 581 → 143 | 123 → 30 | 44 → 5 | 23,6 s → 7,5 s |
| MJ, page Initiative | 54 → 23 | 14 → 7 | 3 → 0 | 5,1 s → 2,8 s |
| MJ, fenêtre Initiative (route) | 34 → 15 | 10 → 8 | — | 3,4 s → 1,4 s |
| Joueuse, accueil | 33 → 13 | 11 → 7 | 5 → 0 | 3,1 s → 3,1 s |
| Joueuse, sa fiche | 279 → 115 | 77 → 28 | 21 → 7 | 16,5 s → 6,7 s |
| Joueuse, fiche du wiki de son PJ | 334 → 132 | 65 → 30 | 31 → 5 | 12,8 s → 7,0 s |

Sortie de la base par ouverture de la fenêtre Initiative : 4,9 Mo → 65 ko. `router.refresh()` : 20 appels → 14.

**Critères d'acceptation**
- [x] Les mesures avant / après sont écrites dans ce ticket (tableau ci-dessus ; détail correction par correction dans `docs/CABLAGE.md` §3).
- [x] Aucune régression : `npm run test` vert, aucun test affaibli.
- [x] Aucun changement de sécurité (RLS, vérification de session) sans décision écrite de l'auteur.

---

### ☑ V3.1-101 — Initiative : la base et les routes réservées au MJ · `S` · sans modèle IA — **terminé le 10 octobre**

**Modèle conseillé : Opus** — RLS et sécurité. **ADR 0040.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration nouvelle : `combats` lisible des membres, écrit par
  `app.is_world_admin(app.campaign_world_id(campaign_id))` ;
  `combat_participants` lu et écrit par `app.is_world_admin(app.combat_world_id(combat_id))`.
- **Chaque route** de `app/api/campaigns/[campaignId]/combats/**` vérifie
  `isWorldAdmin` (`src/server/services/permissions.ts`) et répond 403 avant
  toute lecture de participants ou écriture.
- Vérifier que rien d'autre ne lisait les participants pour un joueur en
  multijoueur (lu le 9 octobre : `turnIntent`, `turnLoop`, `combatTriggers`,
  `soloScene` — solo, où le joueur est propriétaire) ; le solo ne change pas.

**Critères d'acceptation**
- [x] Test d'intégration RLS : un joueur ne lit aucune ligne de
  `combat_participants` et n'écrit ni `combats` ni `combat_participants`.
- [x] Chaque route de combat répond 403 à un joueur (test de la porte `checkCombatAccess` sur la base, commune aux dix routes).
- [x] Le solo et l'outil Initiative du MJ marchent comme avant. Vérifié à l'écran le 10 octobre par une session de vérification : créer, lancer les initiatives, commencer, passer les tours, terminer, supprimer, tout en 200/201. L'ajout d'un PJ sans fiche répond 404, comme avant (les PJ du Banc d'essai n'ont pas encore de fiche). Solo non joué : le joueur y est propriétaire du monde, donc administrateur.
- [x] À faire par l'auteur : appliquer la migration `20261010120000_combats_gm_only` (`supabase db push`), puis relancer les tests d'intégration avec `NEXT_PUBLIC_SUPABASE_ANON_KEY` défini.

**Codé le 10 octobre.**
- **Base** : migration `20261010120000_combats_gm_only`. `combats` reste lisible des membres et n'est plus écrit que par un administrateur du monde ; `combat_participants` est lu et écrit par l'administrateur seulement.
- **Routes** : les dix routes de `app/api/campaigns/[campaignId]/combats/**` passent par une porte commune, `guardCombatRoute` (`lib/combats/routeGuard.ts`). Elle valide l'adresse par Zod (règle 4, ce qui manquait partout), exige une session (trois lectures n'en demandaient pas) et le droit MJ, puis vérifie que le combat appartient à la campagne de l'adresse et le participant au combat. Elle répond 400, 401, 403 ou 404 avant toute lecture ou écriture.
- **Décision** : la règle pure `decideCombatAccess` (`src/core/permissions/combatAccess.ts`, 6 tests) refuse un joueur avant de lui dire si un combat existe. Les faits sont rassemblés par `checkCombatAccess` (`services/combats.ts`).
- **Solo** : inchangé. Le joueur y est propriétaire du monde, donc administrateur ; `turnLoop`, `turnIntent`, `soloScene` et `combatTriggers` ne sont pas touchés.
- **Tests** : `combatsRls.integration.test.ts`. Un joueur voit le combat mais aucun participant, et n'écrit rien ; le MJ lit et écrit ; la porte rend le même verdict. Ce test n'a pas tourné ici : la base n'est pas joignable avec la clé publique, et la migration n'est pas encore appliquée.
- Typecheck et lint verts. `npm run test` : 1405 tests passent ; 3 échecs et 14 fichiers en erreur **préexistants**, identiques sans ce ticket. Cette session voit l'URL et la clé service de Supabase mais pas la clé publique : des tests d'intégration démarrent puis échouent à connecter leurs comptes.

---

### ☑ V3.1-108 — Droits des joueurs : la base ferme, le serveur règle · `M` · sans modèle IA — **terminé le 10 octobre**

**Modèle conseillé : Opus** — RLS et schéma. **ADR 0043.**

**Sous-tâches Haiku** (`aide-haiku`) : lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

- Migration : `campaigns.table_settings jsonb not null default '{}'` ;
  `docs/SCHEMA.md` ; `zCampaignTableSettings` (défauts : `inspiration_max`
  1 ; `player_can_edit` : `conditions` et `inspiration` faux, `hp`,
  `currency`, `spell_slots`, `hit_dice` vrais).
- Migration : écriture de `entity_runtime_state` et `entity_active_effects`
  par `app.can_edit_entity(entity_id)` (au lieu de tout membre du monde).
- `src/core/campaigns/tableSettings.ts` : `mayPlayerChange(field, settings)`
  (tests d'abord) ; garde dans chaque service qui écrit un de ces champs
  pour une joueuse (PV, états, inspiration, pièces, emplacements, dés de
  vie) : 403 si l'interrupteur est coupé et que l'appelant n'est pas MJ.
  Les fonctions du moteur (repos, résolution) ne passent pas par la garde.
- Route d'écriture des réglages (Zod, MJ seul).

**Critères d'acceptation**
- [x] Une joueuse ne peut plus écrire l'état de jeu d'une autre fiche
  (test RLS).
- [x] Interrupteur coupé : l'écriture d'une joueuse est refusée par le
  serveur ; le MJ et le repos passent (tests de service).

**Note de clôture (10 octobre).** Fait :
- migration `20261010130000_runtime_state_can_edit_and_table_settings` : RLS
  d'écriture par `can_edit_entity`, colonne `table_settings` (objet) ;
- `src/core/campaigns/tableSettings.ts` et
  `src/core/permissions/sheetActionAccess.ts` (tests d'abord, 15 tests) ;
- porte commune `lib/characterActions/routeGuard.ts` sur les 11 routes
  d'action qui ne vérifiaient rien (droit d'éditer, Zod sur l'adresse,
  campagne du même monde) ; interrupteurs : PV → `hp`, inspiration →
  `inspiration` (plafonnée à `inspiration_max`), épuisement → `conditions` ;
- la route de la fiche n'enregistre l'état de départ que pour qui peut
  éditer ;
- route `/api/campaigns/[campaignId]/table-settings` (GET membres, PUT MJ) ;
- test d'intégration `runtimeStateRls.integration.test.ts`, passé sur la
  vraie base le 10 octobre (4/4, voir `docs/TESTS.md` §4 bis).

Pièces, emplacements et dés de vie n'ont pas encore de geste manuel (seuls
le sort et les repos les écrivent, chemins du moteur) : leur garde viendra
avec ces gestes (V3.1-24, 109). L'écran des réglages et le masquage des
commandes coupées : V3.1-57, 109.

---

### ☑ V3.1-120 — Défaire les cycles d'import (services serveur, fiche jouable) · `M` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Sonnet** — refactorisation sans changement de comportement ; les tests existants font foi.

**Sous-tâches Haiku** (`aide-haiku`) : recenser, avant de coder, chaque import de la liste ci-dessous et ses usages ; lancer `npm run typecheck && npm run lint && npm run test` et résumer les échecs.

**Constat (audit Graphify du 10 octobre, ADR 0054).** Huit cycles d'import. Rien ne casse aujourd'hui, mais un cycle rend l'ordre de chargement fragile. Une constante peut valoir `undefined` au moment où un module la lit. Et on ne peut plus toucher à un fichier sans tirer les autres. La refonte va justement modifier la fiche jouable et l'assistant de montée de niveau (V3.1-26, 48 à 53).

**Les cycles et l'import qui les ferme**

*Composants*, deux cycles : `LevelUpWizard` → `AsiStep` / `RemainingChoicesStep` → `PlayableCharacterSheet` → `LevelUpWizard`.
- `AsiStep.tsx` et `RemainingChoicesStep.tsx` n'importent de `PlayableCharacterSheet.tsx` que deux constantes, `ABILITY_LABELS` et `SORTED_SKILLS`.
- `ABILITY_LABELS` existe déjà dans `src/core/rules/sheet.ts`. S'il est identique, utiliser celui-là ; sinon, garder la version française la plus complète et le dire.
- `SORTED_SKILLS` va dans un petit module sans composant, par exemple `components/blocks/skillOrder.ts`. `PlayableCharacterSheet.tsx` l'importe de là.

*Services serveur* (`src/server/services/`), six cycles qui passent par ces imports :

| Fichier | Importe | Depuis |
|---|---|---|
| `campaigns.ts` | `createEntity`, `listEntities` | `entities.ts` |
| `entities.ts` | `listPlayerCharacterEntityIds` | `worldPlayerCharacters.ts` |
| `entities.ts` | `getSessionJournalTreeGroup` | `sessionJournal.ts` |
| `worldPlayerCharacters.ts` | `listCampaigns` | `campaigns.ts` |
| `worldPlayerCharacters.ts` | `assembleResolvedRuleset` | `resolvedRuleset.ts` |
| `sessionJournal.ts` | `createEntity` | `entities.ts` |
| `sessionJournal.ts` | `getCalendar` | `worlds.ts` |
| `worlds.ts` | `createCampaign`, `listWorldPlayerCharacters` | `campaigns.ts`, `worldPlayerCharacters.ts` |
| `rules.ts` | `getWorldBySlug` | `worlds.ts` |
| `resolvedRuleset.ts` | `resolveEntryBlocksInRuleset…`, `walkRulesetChain` | `rules.ts` |

**Méthode**, dans cet ordre, en gardant chaque fonction publique et sa signature :
1. **Quand le service importé ne fait que relayer un repo** (`listCampaigns`, `getCalendar`, `getWorldBySlug` sont les premiers à vérifier) : appeler directement la fonction de `src/server/repos/`. Un service peut toujours importer un repo.
2. **Sinon, déplacer la fonction partagée vers le bas**, dans le module dont elle dépend vraiment, ou dans un nouveau module de service « feuille » qui n'importe aucun des fichiers du cycle. Par exemple, les lectures des PJ d'un monde, utilisées par `entities.ts` et `worlds.ts`.
3. Ne jamais casser un cycle par un `import()` dynamique, ni en dupliquant une requête. Une requête Supabase reste dans `src/server/repos/` (règle 20).

**Garde-fou.** Activer `import/no-cycle` dans `eslint.config.mjs`, pour `src/` et `components/`. La règle vient de `eslint-plugin-import`, déjà présent dans `node_modules` ; s'il n'est pas une dépendance directe, le dire avant de l'ajouter à `package.json`. Le lint échoue désormais sur tout nouveau cycle.

**Critères d'acceptation**
- [x] `import/no-cycle` actif ; `npm run lint` passe sans aucune exception désactivée.
- [x] Aucune signature publique changée ; aucun test modifié, sauf ses imports.
- [x] `npm run typecheck && npm run lint && npm run test` passent.
- [x] Une note de clôture liste, pour chaque cycle, l'import déplacé et sa nouvelle source.

**Note de clôture (13 octobre, fait par Opus, sans délégation : la carte des cycles était déjà chargée).** Le recensement par `import/no-cycle` a trouvé **sept** cycles : les six du constat, plus un apparu depuis dans le noyau (`encumbrance.ts` ↔ `sheet.ts`). Aucune signature publique n'a changé : chaque fonction déplacée est réexportée par son ancien fichier, et aucun test n'a été touché.

| Cycle | Import déplacé | Nouvelle source |
|---|---|---|
| Fiche jouable ↔ assistant de montée de niveau | `ABILITY_LABELS` (abréviations FOR, DEX…), `SORTED_SKILLS` | `components/blocks/sheetLabels.ts`. `ABILITY_LABELS` du noyau donne les noms complets (« Force ») : différent, donc gardé à part. La fiche, ses étapes et les deux fichiers du solo l'importent de là |
| `sheet.ts` ↔ `encumbrance.ts` (noyau) | `Ability`, `ABILITIES`, `ABILITY_LABELS`, `SKILL_ABILITIES`, `Skill`, `SKILLS` | `src/core/rules/abilities.ts`, module feuille ; `sheet.ts` le réexporte |
| `worldPlayerCharacters` → `campaigns` → `entities` → `worldPlayerCharacters` | `listCampaigns`, `CampaignSummary` | `services/campaignSummary.ts`. Pas d'appel direct au repo : `listCampaigns` est enveloppé dans `React.cache()`, l'appel direct aurait doublé des requêtes par page |
| `rules` → `worlds` → `worldPlayerCharacters` → `resolvedRuleset` → `rules` | `getWorldBySlug` | `services/worldLookup.ts`, même raison (`React.cache()`) |
| `entities` ↔ `sessionJournal` (et les cycles qui passaient par `worlds`) | `getSessionJournalTreeGroup`, `getLatestSessionJournalSlug`, `SESSION_JOURNAL_KIND` | `services/sessionJournalTree.ts` |

Les autres arêtes du tableau du constat (`getCalendar`, `createCampaign`, `resolveEntryBlocks…`) restent : une fois ces trois coupures faites, elles ne ferment plus aucune boucle. **Garde-fou** : `import/no-cycle` est actif pour `src/` et `components/`. Le plugin et son résolveur TypeScript sont déjà chargés par `eslint-config-next` : aucune dépendance ajoutée. `docs/ARCHITECTURE.md` §6 dit comment casser un cycle. Vérifié : typecheck, lint, 1 468 tests unitaires et 161 d'intégration.


---

### ☑ V3.1-121 — Ténacité naine ignorée dans les PV max · `S` · sans modèle IA — **fait et vérifié le 13 octobre** — cause : les effets passifs des traits d'espèce ne sont appliqués nulle part, et aucun ticket ne le prévoit (V3.1-116 ne traite que les traits à choix).

**Modèle conseillé : Opus** — calcul de la fiche (`characterSheet()`, noyau).

Nain Clerc 1, CON 14 : PV max 10 au lieu de 11. Les sources de PV renvoyées par `GET /api/entities/[id]/sheet` ne listent que « Dés de vie (1d8) » 8 et « Constitution » 2 ; le trait est affiché à l'étape Espèce mais ne produit aucun modificateur.

**Critères d'acceptation**
- [x] Test d'abord (noyau) : un Nain niveau 1 gagne +1 PV max, puis +1 par niveau.
- [x] La fiche du PJ de Testeur B affiche 11 PV max, avec la source « Ténacité naine ».

**Vérifié en direct le 13 octobre (Opus).** Application lancée en local, connexion en Testeur B par Chromium, fiche `/m/banc-d-essai/joueur/fiche/3`.
- La jauge affiche « 10/11 ». Les PV actuels restent à 10 : c'est un état enregistré, et une hausse du maximum ne soigne pas.
- Les données de la page portent les trois sources des PV : Dés de vie 8, Constitution 2, **Ténacité naine 1**.
- L'écran n'affiche aucune source des PV, ni au survol ni ailleurs, pour aucune des trois. C'est déjà le cas avant ce ticket ; la fiche à jauges (V3.1-26) est l'endroit pour les montrer.
- En passant : l'inventaire affiche la masse d'armes à 1.8 kg (V3.1-125).

**Codé le 13 octobre (Opus).** Choix de l'auteur : un modificateur « par niveau ».
- **Moteur.** Un modificateur peut porter `per_level` (`zModifier`, `DeclaredModifier`). `characterSheet()` multiplie sa valeur par le niveau total du personnage, avant toute pile ; les sources affichent le total. 5 tests dans `sheet.test.ts`.
- **Branchement.** `resolvedRuleset.ts` lit enfin le bloc `modifiers` des traits d'espèce, validé par Zod, et l'ajoute à la feature de l'espèce en couche 2, avec le nom du trait pour étiquette. Aucune requête de plus : `fetchEntriesBatch` lisait déjà tous les blocs des traits.
- **Donnée.** `data/srd/modifiers-2024.json`, saisi à la main sur le modèle de `triggers-2024.json`, lu par `ingest-srd.ts` et testé par `srdModifiersData.test.ts`. La fiche de règle affiche « +1 par niveau ».
- **Pas fait ici.** La Résilience draconique dépend du *niveau de classe*, et les aptitudes de sous-classe ne sont pas encore résolues : elle attend V3.1-117. Le don Robuste n'est pas dans le SRD 5.2.1 ; une version maison peut porter `per_level`.

---

### ☑ V3.1-125 — Masse d'armes : poids faux à l'import · `S` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Sonnet.**

La masse d'armes pèse 0,9 kg sur la fiche ; le SRD donne 4 lb, soit environ 1,8 kg. Trouver l'erreur de conversion dans `ingest-srd` (et vérifier les autres armes de la même famille), la corriger à l'import, jamais à la main en base.

**Critères d'acceptation**
- [x] Masse d'armes à 1,8 kg après réimport ; un test couvre le cas. **Réimport fait le 13 octobre** : 4 lb en base dans les deux rulesets SRD (1 904 entrées, aucun échec), les trois scripts d'auteur rejoués.

**Diagnostic du 13 octobre (`dev-sonnet`, vérifié par Opus).** Pas d'erreur de conversion : `lbToKg` est juste. C'est `data/srd/srd-2024.json` qui était faux. Comparé au tableau des armes du SRD 5.2.1 (`data/srd/en-source/srd-5.2.1-en.txt`) :
- masse d'armes : 2 lb au lieu de 4 ;
- lance : 2 lb au lieu de 3 ;
- pique : 6 lb au lieu de 18.

Les trois sont corrigées dans le JSON. `srdWeaponWeights.test.ts` compare les 28 armes de corps à corps au tableau ; il échoue sans la correction.

---

### ☑ V3.1-126 — Les `catch` muets restants · `M` · sans modèle IA — **fait le 13 octobre**

**Modèle conseillé : Sonnet.** Sous-tâches Haiku : recenser les occurrences et les classer par fichier (`grep -rn "catch {\|\.catch(() => {})" app components lib src`, tests exclus).

`CLAUDE.md` interdit le `catch` silencieux. Le 12 octobre, il en reste **55, dans 44 fichiers**. Ceux touchés par V3.1-62 ont été corrigés en passant (chargeurs de la fiche, pastille du chat, radio, dés, liste des règles, découverte d'une fiche joueuse). Les autres datent d'avant la règle.

**Méthode**, fichier par fichier, sans changer le comportement visible :
- un échec qui doit rester sans effet pour l'utilisateur (geste « au mieux ») garde son repli, mais **journalise** l'erreur (`console.error` avec ce qui a échoué) ;
- un échec qui laisse un écran sur un état faux reçoit l'état d'erreur de la charte (`docs/CHARTE-UI.md`, états d'écran) ;
- un `fetch` qui ne teste pas `res.ok` le teste (charte : « un `fetch` dont on ne teste pas `res.ok` est un bug »).

**Garde-fou.** Ajouter le motif au cliquet `lib/cablage.test.ts`, plafond au compte du jour, abaissé à chaque lot.

**Critères d'acceptation**
- [x] Plus aucun `catch` sans traitement de l'erreur hors des tests.
- [x] Le cliquet compte les `catch` muets et échoue s'ils augmentent.
- [x] `npm run typecheck && npm run lint && npm run test` passent.

**Note de clôture (13 octobre, `dev-sonnet`, relu par Opus).** Le grep du ticket comptait 55 lignes, mais beaucoup traitaient déjà l'erreur (réponse HTTP, erreur typée, état d'erreur). Il y avait environ 35 vrais muets, formes `.catch(() => setX(null))` comprises.
- **Journalisés** (`console.error` avec ce qui a échoué), repli inchangé : stockage local, chargements « au mieux » du shell et des blocs, cartes, calendrier, narration et esquisses du solo, préchauffage de `publicShare.ts`, arguments d'outil illisibles de l'adaptateur d'IA.
- **Marqués `catch-attendu`**, échec prévu par conception et justifié dans le commentaire : `wikiPath.ts`, `supabase/server.ts`, `embedUrl.ts`, `tables/roll.ts`, `CommandPalette.tsx` (requête annulée à chaque frappe ; un journal ferait du bruit), `srdMapping.ts`, `homebrewEdit.ts`.
- **Aucun état d'erreur posé, aucun `res.ok` ajouté** : ceux vus le testaient déjà.

**Cliquet** : clé `catchMuets` de `lib/cablage.test.ts`, **plafond 0**. `lib/` entre dans les racines comptées.

**Laissé pour plus tard** (relevé par Sonnet, hors périmètre) :
- `app/api/campaigns/[id]/invites/route.ts` transforme tout échec en 403 « seul le MJ peut inviter » ; le changer modifie le comportement visible.
- La carte vide et le calendrier par défaut mériteraient l'état d'erreur de la charte, plutôt qu'un simple journal : c'est un ticket d'interface.


---

### ☑ V3.1-127 — Mettre à jour Next et les dépendances vulnérables · `S` · sans modèle IA — **fait le 12 octobre**

**Modèle conseillé : Opus**, car le changement de version de Next touche tout le rendu. Sous-tâches Haiku : lancer `npm audit --omit=dev`, typecheck, lint, tests et build, et résumer les échecs.

Le 12 octobre, `npm audit --omit=dev` relève 32 failles (1 critique, 6 hautes, 25 moyennes), inscrites au registre de `docs/SECURITE.md` §3.
- **Next 16.2.12** : plusieurs failles corrigées en 16.3.8, dont des exécutions de code à distance (optimisation d'images AVIF, `next/og`, serveur Windows) et une falsification de requête par l'optimisation d'images. Le code n'utilise ni `next/image` ni `next/og` : exposition faible, mais `/_next/image` répond quand même.
- **Éditeur** : `@tiptap/core` et `prosemirror-view` (XSS au collage) ; correctif dans les versions permises.
- **Outillage** : `sharp`, `postcss` (suivent Next), `nanoid`, `source-map-js`.

**Méthode**
1. Monter `next` (et `eslint-config-next`) à la dernière 16.x, au moins 16.3.8 ; lire ses notes de version pour les changements de comportement.
2. `npm audit fix`, **sans** `--force`.
3. `npm run typecheck && npm run lint && npm run test`, `npm run build`, `npm run verifier:secrets`.
4. Parcours à la main (`docs/TESTS.md`) : une fiche de personnage, l'éditeur (coller du texte), un portrait téléversé, une page partagée.
5. Passer la ligne du registre à *corrigée*.

**Fait le 12 octobre.**
- **Next 16.3.8**, pas 16.4.0 : dernière version corrective de la ligne 16.3, qui corrige toutes les failles relevées ; 16.4.0 (six jours) apporte des nouveautés, donc plus de changements possibles. `eslint-config-next` suit.
- **Tiptap 3.31.4**, toutes les extensions ensemble (elles exigent la même version exacte). Le fichier de verrouillage gardait l'ancienne version de chaque extension : ses entrées Tiptap ont été retirées pour que npm les résolve à neuf, puis `npm ci` a prouvé qu'il s'installe proprement depuis zéro.
- `sharp`, `nanoid`, `source-map-js` montés dans leurs versions permises (`npm update`).
- `npm audit fix` plante avec npm 10.9 (`edgesOut`) : les mises à jour ont été faites paquet par paquet.
- **Parcours à la main** sur le build de production (`next start`), Banc d'essai, Chromium :
  - fiche de personnage côté MJ et côté joueuse : CA 16, PV 12/12 ;
  - éditeur : bloc Texte ajouté à la faction, frappe et collage enregistrés et relus ; une image collée avec un script caché (`onerror`) ne l'exécute pas ; bloc supprimé ensuite ;
  - page partagée avec un jeton inconnu : 404 prévu, pas d'erreur serveur ; en-têtes de sécurité présents.
  - Téléversement d'image : *erreur corrigée le 12 octobre*. Ce ticket affirmait d'abord que notre code n'utilisait pas `sharp` : faux, il le charge à la demande (`await import("sharp")`, `src/server/services/assetUpload.ts`, `blockImageUpload.ts`, `backgroundImageProcessing.ts`), forme que la recherche n'avait pas trouvée. Vérifié ensuite sur la machine, sans rien téléverser, avec `sharp` 0.35.5 et les réglages exacts de l'app : une carte PNG de 19,6 Mo (5760 px) devient un WebP de 537 ko à 4096 px, 168 ko à 1600 px, 30 ko en portrait ; un faux fichier est refusé proprement. L'envoi vers le stockage (`supabase-js`) n'a pas changé de version.
- **Nouveau en 16.3** : la règle de lint `no-location-assign-relative-destination` signalait `components/shell/CommandPalette.tsx` (navigation par `window.location.href`, donc rechargement complet). Corrigé le même jour : `router.push`. Cette branche ne sert que hors du bureau de fenêtres, qui entoure aujourd'hui toutes les pages d'un monde ; aucun écran actuel ne change.
- **Outils de développement**, le même jour : 10 → 5 failles avec npm 11 (Vitest 4.1.11, `brace-expansion`, `js-yaml`) ; les 5 restantes n'ont aucun correctif publié (`docs/SECURITE.md` §6).

**Critères d'acceptation**
- [x] `npm audit --omit=dev` ne relève plus de faille critique ni haute, ou chaque reste est justifié au registre. *0 faille en production ; les 10 restes des outils de développement sont justifiés dans `docs/SECURITE.md` §6.*
- [x] `npm run typecheck && npm run lint && npm run test` et le build passent.
- [x] Le parcours à la main ne montre aucune régression.

---

### ☑ V3.1-128 — Les cartes laissent leurs images dans le stockage · `S` · sans modèle IA — **fait le 12 octobre**

**Modèle conseillé : Sonnet** au départ. *Corrigé après coup : le ticket a demandé une migration et une fonction `security definer`, domaine d'Opus (`CLAUDE.md`, répartition par modèle). Fait par Opus.* Sous-tâches Haiku : aucune.

Trouvé le 12 octobre en écrivant `docs/QUOTAS.md` Q5. Les portraits, images de blocs et fonds d'écran effacent leur ancien fichier (`deleteAsset`). Les cartes, non :
- **Remplacer l'image d'une carte** (`components/entities/map/MapWorkspace.tsx`, `upload`) téléverse deux nouveaux fichiers (4096 px et vignette 1600 px) et remplace `assetId` et `thumbnailAssetId` dans les données du bloc. Les deux anciens restent dans le stockage et dans `assets`, désignés par rien.
- **Supprimer un bloc `map`** (`deleteBlock`, `src/server/services/blocks.ts`) ne retire l'image que pour un bloc `image`.

Chaque cas laisse ≈ 700 ko d'orphelins, sur 1 Go de stockage gratuit.

**À faire**
1. Côté serveur, à l'enregistrement d'un bloc `map` : si `assetId` ou `thumbnailAssetId` change, effacer l'ancien par `deleteAsset`, après l'écriture réussie.
2. `deleteBlock` : pour un bloc `map`, effacer ses deux images, comme pour un bloc `image`.
3. Vérifier qu'aucune autre ligne ne désigne ces images avant de les effacer (une carte dupliquée partage-t-elle ses images ? Lire « Dupliquer » avant de coder).
4. Recenser les orphelins déjà présents (lignes `assets` qu'aucun bloc, portrait ni fond ne désigne) et proposer leur nettoyage à l'auteur, sans rien effacer d'office.

**Fait le 12 octobre** (Opus, contexte déjà chargé ; décision de l'auteur, ADR 0057).
- **Les images se partagent.** `duplicateEntity` et la duplication d'un bloc recopient `assetId` : compter avant d'effacer est indispensable. Et la RLS cache certains blocs même au MJ : le compte se fait par `app.asset_reference_count`, `security definer` (migration `20261012120000`).
- `src/core/images/imagesDeCarte.ts` (10 tests) : les images qu'un enregistrement abandonne.
- `deleteAssetIfUnreferenced` (`storage.ts`) : efface après l'écriture, seulement à un compte de 0 ; un échec est journalisé.
- Branché dans `updateBlockContent` et `deleteBlock` pour les blocs `map`.
- **Migration appliquée par l'auteur** (SQL Editor) le 12 octobre. Le test d'intégration a alors révélé un **défaut plus ancien, commun à toutes les images** : `deleteAsset` effaçait la ligne `assets` avant le fichier, or la règle de lecture du stockage (`assets_bucket_select`, migration `20260902110001`) n'ouvre un fichier que si une ligne le désigne. Le fichier devenait invisible et `remove` ne retirait rien, sans erreur : chaque portrait, image de bloc ou fond d'écran supprimé depuis le 2 septembre est resté dans le stockage. Corrigé : le fichier d'abord, la ligne ensuite.
- **Orphelins existants** : `npm run recenser:images-orphelines` (lecture seule). Le 12 octobre : 19 images, 27,8 Mo, toutes dans « Faerûn », des paires carte + vignette du 1er septembre. S'y ajoutent 12 fichiers sans ligne (0,4 Mo), laissés par le défaut de `deleteAsset`. Rien n'est effacé sans l'accord de l'auteur.
- **Effacement** (demandé par l'auteur le 12 octobre) : `npm run effacer:images-orphelines`. Même liste que le recensement (`src/core/images/orphelins.ts`, 10 tests), exige l'empreinte de la liste relue, met de côté ce qui a moins d'une heure, fichier avant ligne. Essayé sur un monde jetable : orphelin effacé, image désignée gardée, fichier récent intact, empreinte fausse refusée. Lancé par l'auteur, jamais par Claude.

**Critères d'acceptation**
- [x] Remplacer l'image d'une carte, puis supprimer son bloc, ne laisse aucun fichier ni aucune ligne `assets` orpheline (test d'intégration `mapAssetsCleanup.integration.test.ts`). *5/5 sur la vraie base le 12 octobre, après la migration et la correction de `deleteAsset`.*
- [x] Une carte dupliquée garde son image quand on supprime l'original (même test, copie dans un bloc privé invisible au MJ).
- [x] `npm run typecheck && npm run lint && npm run test` passent (1603 tests).
