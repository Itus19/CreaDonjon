import { fenceUntrustedData } from "./promptSafety";

/**
 * V3-B3 — Le contexte envoyé au modèle pour narrer un tour solo.
 *
 * Généralise `spikeSoloProposal.buildSpikeNpcContext` (S2/S1, trois PNJ
 * codés en dur) à de vraies données de campagne : la scène, les présents
 * avec leur bande d'attitude nommée, le résultat mécanique du tour, les
 * indices de narration des règles déclenchées, les quêtes actives.
 *
 * **Fonction PURE.** Elle ne lit rien en base — l'appelant (V3-B3, côté
 * service) résout déjà tout : le `known_as` est appliqué, l'attitude est
 * déjà traduite en bande nommée (jamais le nombre), les quêtes sont déjà
 * filtrées par l'audience du joueur. Ce module ne fait que composer et
 * encadrer ; il ne peut donc pas se tromper de viewer, il n'en connaît pas.
 *
 * **Quel contenu est encadré, et lequel ne l'est pas — sans exception, à
 * dessein.** `fenceUntrustedData` (règle absolue 10) protège de la prose
 * qu'un humain — ou un modèle — a écrite : le nom d'un lieu, d'un PNJ, le
 * texte d'une quête, un `narrate_hint` posé sur un déclencheur homebrew,
 * et depuis V3-B4 les dernières narrations elles-mêmes (de la prose de
 * modèle réinjectée, encadrée comme n'importe quelle autre). `facts`/
 * `changes` n'ont besoin d'AUCUN encadrement : ce sont des phrases
 * COMPOSÉES par le serveur à partir de gabarits fixes et de nombres
 * (`turnLoop.ts`/`describeChange`) — B1 l'a déjà posé en principe ("les
 * faits nomment désormais le dé et chaque modificateur... jamais
 * recomposés"). `playerAction` est le texte du joueur lui-même, jamais une
 * donnée du monde. Le test de ce fichier vérifie exactement cette
 * frontière : les cinq premières sont fenced, les trois dernières ne le
 * sont jamais — un sixième champ de "contenu du monde" ajouté ici sans
 * passer par `fenceUntrustedData` casserait ce test.
 *
 * **La consigne « ne répète pas » (V3-B4) reste hors de l'encadrement.**
 * C'est une vraie instruction du système, pas une donnée que le fencing
 * inviterait le modèle à ignorer — la seule ligne de ce fichier qui suit
 * une balise `<donnee>` sans être elle-même encadrée.
 */

export interface TurnContextNpc {
  /** L'id réel de l'entité — jamais inventé, c'est ce qui borne un futur `npc_id` d'outil (même garde-fou que le spike). */
  id: string;
  /** Déjà résolu par `known_as` si le personnage ne connaît pas son vrai nom. */
  name: string;
  /** `null` : aucune attitude suivie pour cette paire — omis plutôt qu'un "neutre" inventé. */
  attitudeLabel: string | null;
  zone: "engaged" | "near" | "far";
  /** V3-C2 — le trait tiré au générateur pour une esquisse (aucune fiche, donc aucune attitude suivie). `undefined` pour un PNJ réel. */
  note?: string;
  /** V3.1-193 — comment l'accorder (`pronounGuidance` de son bloc `character`) ; absent quand rien n'est choisi. */
  pronouns?: string;
  /**
   * Qui est ce PNJ : le premier paragraphe de sa page que la personne qui joue
   * peut lire (« aubergiste du Fanal », « orphelin qui traîne au port »),
   * tronqué. Sans lui, le modèle devine un métier à partir du nom (un client
   * qui propose de servir). Absent d'une page vide ou d'une esquisse.
   */
  description?: string;
}

export interface TurnContextQuest {
  title: string;
  /** Les objectifs NON cochés seulement — ce qui reste à faire, pas l'historique. */
  openObjectives: string[];
}

export interface TurnContextPlayer {
  /** Le nom du personnage joué : c'est lui que la narration tutoie. */
  name: string;
  /** Comment l'accorder (« tu es surpris·e »), absent quand rien n'est choisi. */
  pronouns?: string;
}

export interface TurnContextInput {
  locationName: string;
  /**
   * Le personnage joué, que la narration tutoie. Sans lui, le modèle lit son
   * nom dans les faits et le raconte à la troisième personne, comme un PNJ
   * de plus. `null` quand l'entité est introuvable : la consigne du « tu »
   * reste dans le prompt système.
   */
  player: TurnContextPlayer | null;
  /** L'id du PNJ à qui le joueur parle dans ce tour (`npcAddressedBy`), `null` si personne n'est clairement désigné. */
  addressedNpcId: string | null;
  time: { day: number; hour: number; minute: number };
  lighting: "bright" | "dim" | "dark";
  npcs: TurnContextNpc[];
  quests: TurnContextQuest[];
  /** `record.facts` de `TurnOutcome` (V3-B2) — déjà établis, déjà journalisés. */
  facts: string[];
  /** `changes` de `TurnOutcome`. */
  changes: string[];
  /** `hints` de `TurnOutcome` — les `narrate_hint` des règles déclenchées. Contenu du monde (posé par un auteur de règle) : encadré. */
  hints: string[];
  playerAction: string;
  /**
   * V3-B4 — Les *n* dernières narrations, la plus récente en tête. Contenu
   * ENCADRÉ (c'est de la prose déjà produite par un modèle, réinjectée
   * comme donnée de référence) ; la consigne de ne pas la répéter, elle,
   * reste hors de l'encadrement — c'est une VRAIE instruction du système,
   * pas une donnée du monde que le modèle aurait le droit d'ignorer.
   */
  recentNarrations: string[];
  /**
   * V3.2-11 (ADR 0110) — la bourse du personnage joué, composée par le serveur
   * à partir de nombres (« 1 po, 12 pa, 3 pc », « vide ») : comme les faits,
   * jamais encadrée. Absente hors scène.
   */
  purse?: string;
  /**
   * ADR 0117 — ce que seul le MJ sait du lieu et des PNJ présents : les
   * paragraphes de leurs pages que la personne qui joue ne lit pas. Contenu du
   * monde, encadré, À PART de ce que le personnage sait ; la consigne qui le
   * suit interdit de le dire. Absent ou vide : rien de caché.
   */
  secrets?: { name: string; text: string }[];
  /** V3.2-11 — la carte du lieu (« Bière : 4 pc ») : des libellés écrits dans le wiki, donc ENCADRÉS. */
  priceList?: string[];
  /** V3.2-11 — l'ardoise du lieu (« « Bière », 4 pc, due à Mabelle ») : libellés et noms du monde, ENCADRÉS. */
  tab?: string[];
  /**
   * Le premier paragraphe visible de la page du lieu (`premierParagraphe`,
   * déjà filtré pour le joueur). Sans lui, le modèle ne peut rien décrire de
   * vrai et reste dans le vague. Contenu du monde : encadré.
   */
  locationDescription: string | null;
  /**
   * ME-5 — la météo calculée par le moteur (`describeWeatherForAi`) : le
   * temps dehors et ce que le personnage en perçoit là où il est. Un fait du
   * moteur, jamais encadré ; `null` hors scène.
   */
  weather: string | null;
  /**
   * Les dernières actions du joueur AVANT ce tour, de la plus ancienne à la
   * plus récente : le fil de la scène, pour que le modèle sache où elle va.
   * Texte du joueur, comme `playerAction` : jamais encadré.
   */
  recentPlayerActions: string[];
  /**
   * Vrai quand le joueur pose une question (`estQuestionDirecte`) : la
   * réplique du PNJ désigné est alors due. Sinon il peut se taire, faire un
   * geste, et la scène avance sans dialogue forcé.
   */
  addressedIsQuestion: boolean;
  /**
   * V3.2-19 — les lieux voisins (`lieuxVoisins`) que le joueur peut voir : là
   * où la narration peut proposer de l'emmener (`move_to`). Noms du monde :
   * encadrés ; l'id borne l'enum de l'outil.
   */
  moveTargets: { id: string; name: string }[];
  /** V3.2-19 — les pièces connues du lieu (bloc « Pièces » visible, puis esquisses de la scène). Contenu du monde : encadré. */
  rooms: { name: string; description: string }[];
  /** V3.2-19 — la pièce où se trouve le personnage, `null` s'il est dans le lieu sans pièce précise. Encadrée. */
  currentRoom: { name: string; description: string } | null;
  /**
   * V3.2-28 — les présents du lieu qui sont dans une AUTRE pièce
   * (`presentsAilleurs`) : nom tel que le joueur le connaît, et leur pièce
   * (`null` : l'espace principal). Le modèle les sait là sans les faire agir
   * dans celle du personnage. Encadrés.
   */
  elsewhere?: { name: string; room: string | null }[];
}

/** Exportes : V3-D4 (`gmQuestionContext.ts`) en est le second consommateur — meme lieu, memes PNJ, memes quetes, pour une question hors du temps de jeu plutot qu'une narration de tour. */
export const LIGHTING_LABELS: Record<TurnContextInput["lighting"], string> = {
  bright: "plein jour",
  dim: "pénombre",
  dark: "obscurité",
};

const ZONE_LABELS: Record<TurnContextNpc["zone"], string> = {
  engaged: "au contact",
  near: "à portée",
  far: "au loin",
};

/**
 * V3.2-11 — l'argent se règle au moteur, jamais en narration : le PNJ cite les
 * prix qu'on lui donne, peut réclamer ce qui est dû, et ce qu'il propose
 * (rabais, troc) reste de la parole tant qu'aucun échange n'est réglé.
 */
/**
 * V3.2-11, revue le 26 novembre : quand on demande un prix, le PNJ le DIT, lu
 * sur la carte. « L'ardoise dit le prix » sans le prix était une esquive : le
 * mot « ardoise » désignait à la fois la dette et le tableau des prix, et sans
 * carte la consigne ne laissait au modèle que cette dérobade.
 */
export const MONEY_INSTRUCTION =
  "Consigne sur l'argent : ne fixe jamais un prix toi-même. Quand le personnage demande ce que coûte quelque chose, le PNJ dit le prix à voix haute, tel qu'il est sur la carte-du-lieu (« la soupe et le pain, 3 pc »), sans renvoyer à un tableau ou à une ardoise. Ce qui n'est pas sur la carte, le PNJ dit qu'il n'en a pas ou propose ce qui y est. Un PNJ peut réclamer ce que le personnage doit ici (dettes-du-personnage). Un rabais ou un troc qu'un PNJ propose reste une parole : rien n'est payé, donné ni retiré tant que le moteur n'a pas réglé un échange dans les faits.";

/** Le même, quand le lieu n'a pas de carte : aucun prix à citer, donc aucun renvoi à un prix affiché. */
export const MONEY_INSTRUCTION_NO_PRICE_LIST =
  "Consigne sur l'argent : ce lieu n'a pas de carte des prix, et tu ne fixes jamais un prix toi-même. Aucun PNJ ne cite de prix, ni ne renvoie à un tableau, une ardoise ou un prix affiché, et le décor n'en montre aucun (pas de prix effacés ni illisibles : il n'y a rien d'écrit). Si le personnage demande ce que coûte quelque chose, le PNJ répond sans chiffre (« on verra ça à la fin », « ce que tu jugeras juste ») ou dit qu'il ne vend pas cela. Un PNJ peut réclamer ce que le personnage doit ici (dettes-du-personnage). Un rabais ou un troc reste une parole : rien n'est payé, donné ni retiré tant que le moteur n'a pas réglé un échange dans les faits.";

/**
 * La météo tirée (V3-C6) est celle du dehors. Sans cette consigne, la pluie
 * tombait sur une ardoise au milieu d'une salle d'auberge (26 novembre).
 */
export const WEATHER_INSTRUCTION =
  "Consigne : la météo du lieu est celle du dehors. Quand le personnage est à l'intérieur, elle ne se perçoit que par les fenêtres, le toit, la porte ou les vêtements de ceux qui entrent ; elle ne mouille ni n'abîme rien de ce qui est dedans.";

/**
 * ADR 0117 — en solo, le moteur et l'IA sont les deux moitiés du MJ : l'IA
 * sait ce que le personnage ignore, et s'en sert pour rester cohérente.
 */
export const SECRETS_INSTRUCTION =
  "Consigne : secrets-du-mj est ce que seul le MJ sait ; le personnage joué l'ignore. Sers-t'en pour que les PNJ et le monde agissent de façon cohérente (motifs, gestes, mensonges, hésitations, ce qui se trouve où). N'en écris jamais le contenu, ni dans la narration, ni dans une réplique, ni dans une world_note, sauf ce que les faits établis de ce tour font découvrir au personnage. Un PNJ peut mentir ou se taire pour le cacher.";

/** Les PNJ restent ce que leur page dit qu'ils sont : c'est ce qui empêche un client d'offrir de servir. */
export const NPC_ROLE_INSTRUCTION =
  "Consigne : chaque PNJ agit selon ce que pnjs-presents dit de lui. Seul le personnel du lieu sert, encaisse ou loue une chambre. Un PNJ dont rien n'est dit n'est pas du personnel : n'invente pas son métier.";

export function npcLine(npc: TurnContextNpc): string {
  const attitude = npc.attitudeLabel ?? "attitude inconnue";
  const note = npc.note ? `, ${npc.note}` : "";
  const pronoms = npc.pronouns ? `, pronoms : ${npc.pronouns}` : "";
  const qui = npc.description ? ` — ${npc.description}` : "";
  return `- ${npc.name} (id: ${npc.id}) — ${ZONE_LABELS[npc.zone]}, ${attitude}${note}${pronoms}${qui}`;
}

export function questLine(quest: TurnContextQuest): string {
  if (quest.openObjectives.length === 0) return `- ${quest.title}`;
  return `- ${quest.title} : ${quest.openObjectives.join(" ; ")}`;
}

/**
 * Assemble le contexte d'un tour solo, prêt à poser en message `user`
 * derrière `AiProvider` (`src/server/ai/soloNarration.ts`, V3-B2).
 */
export function buildTurnContext(input: TurnContextInput): string {
  const locationText = `${input.locationName} — jour ${input.time.day}, ${String(input.time.hour).padStart(2, "0")}h${String(input.time.minute).padStart(2, "0")} — ${LIGHTING_LABELS[input.lighting]}`;
  const addressed = input.addressedNpcId && input.npcs.some((n) => n.id === input.addressedNpcId) ? input.addressedNpcId : null;

  const parts: (string | null)[] = [
    fenceUntrustedData("lieu", locationText),
    // ME-5 : un fait calculé par le moteur, hors balise ; la consigne générale de V3.2-41 suit.
    input.weather ? `Météo (calculée par le moteur, ne la change pas) :\n${input.weather}\n\n${WEATHER_INSTRUCTION}` : null,
    input.locationDescription ? fenceUntrustedData("description-du-lieu", input.locationDescription) : null,
    input.player
      ? fenceUntrustedData("personnage-joue", `${input.player.name}${input.player.pronouns ? ` (pronoms : ${input.player.pronouns})` : ""}`)
      : null,
    input.currentRoom
      ? fenceUntrustedData("piece-actuelle", `${input.currentRoom.name}${input.currentRoom.description ? ` — ${input.currentRoom.description}` : ""}`)
      : null,
    input.rooms.length > 0 ? fenceUntrustedData("pieces-du-lieu", input.rooms.map((r) => `- ${r.name}${r.description ? ` : ${r.description}` : ""}`).join("\n")) : null,
    input.moveTargets.length > 0 ? fenceUntrustedData("lieux-accessibles", input.moveTargets.map((l) => `- ${l.name} (id: ${l.id})`).join("\n")) : null,
    input.npcs.length > 0 ? fenceUntrustedData("pnjs-presents", input.npcs.map(npcLine).join("\n")) : null,
    input.npcs.length > 0 ? NPC_ROLE_INSTRUCTION : null,
    (input.secrets?.length ?? 0) > 0
      ? `${fenceUntrustedData("secrets-du-mj", (input.secrets ?? []).map((x) => `- ${x.name} : ${x.text}`).join("\n"))}\n\n${SECRETS_INSTRUCTION}`
      : null,
    // V3.2-28 : qui est ailleurs dans le lieu, et une vraie consigne (hors balise) sur ce qu'on en fait.
    (input.elsewhere?.length ?? 0) > 0
      ? `${fenceUntrustedData("ailleurs-dans-le-lieu", (input.elsewhere ?? []).map((e) => `- ${e.name} (${e.room ?? "espace principal du lieu"})`).join("\n"))}\n\nConsigne : les personnes d'ailleurs-dans-le-lieu ne sont pas avec le personnage. Il peut les entendre de loin ou les retrouver en changeant de pièce, mais elles ne parlent ni n'agissent à côté de lui.`
      : null,
    input.npcs.length === 0 && (input.currentRoom !== null || (input.elsewhere?.length ?? 0) > 0)
      ? "Consigne : personne d'autre n'est avec le personnage là où il se trouve. N'y fais apparaître personne, sauf si le joueur fait venir quelqu'un."
      : null,
    input.quests.length > 0 ? fenceUntrustedData("quetes-en-cours", input.quests.map(questLine).join("\n")) : null,
    input.hints.length > 0 ? fenceUntrustedData("indices-de-narration", input.hints.join("\n")) : null,
    // V3.2-11 : ce que la personne a et doit, et ce que le lieu vend. La
    // consigne qui suit est une vraie instruction du système, hors balise.
    input.priceList && input.priceList.length > 0 ? fenceUntrustedData("carte-du-lieu", input.priceList.join("\n")) : null,
    input.purse ? `Bourse du personnage joué : ${input.purse}` : null,
    input.tab && input.tab.length > 0 ? fenceUntrustedData("dettes-du-personnage", input.tab.join("\n")) : null,
    (input.priceList?.length ?? 0) > 0 ? MONEY_INSTRUCTION : input.purse !== undefined || (input.tab?.length ?? 0) > 0 ? MONEY_INSTRUCTION_NO_PRICE_LIST : null,
    // V3-B4 : la prose vient dans l'encadrement (c'est de la donnee de
    // reference, deja produite par un modele), la consigne reste DEHORS —
    // une vraie instruction du systeme, jamais quelque chose que le modele
    // aurait le droit d'ignorer comme "contenu du monde".
    input.recentNarrations.length > 0
      ? `${fenceUntrustedData("dernieres-narrations", input.recentNarrations.map((n, i) => `${i + 1}. ${n}`).join("\n"))}\n\nConsigne : ne répète pas ces phrases ni leurs formulations dans ta nouvelle narration.`
      : null,
    input.recentPlayerActions.length > 0
      ? `Les actions précédentes du joueur dans cette scène, de la plus ancienne à la plus récente :\n${input.recentPlayerActions.map((a) => `- ${a}`).join("\n")}`
      : null,
    `Faits établis de ce tour :\n${input.facts.length > 0 ? input.facts.map((f) => `- ${f}`).join("\n") : "(aucun)"}`,
    input.changes.length > 0 ? `Changements :\n${input.changes.map((c) => `- ${c}`).join("\n")}` : null,
    `Action du joueur : ${input.playerAction}`,
    // L'id, jamais le nom : un nom est du contenu du monde, il reste dans sa
    // balise ; cette ligne-ci est une vraie consigne du système.
    addressed && input.addressedIsQuestion
      ? `Consigne : le joueur parle au PNJ d'id ${addressed} et lui pose une question. Ce PNJ lui répond dans npc_reaction (npc_id = ${addressed}), au discours direct, avec ses propres mots.`
      : null,
    addressed && !input.addressedIsQuestion
      ? `Consigne : le joueur parle au PNJ d'id ${addressed}. Fais-le parler (npc_reaction, npc_id = ${addressed}) seulement si sa parole apporte quelque chose ; sinon un geste ou un silence suffit, et la scène avance.`
      : null,
  ];

  return parts.filter((p): p is string => p !== null).join("\n\n");
}
