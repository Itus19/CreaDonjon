import { createElement, Fragment, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { AnchoredImage, AnchorFlow } from "@/src/core/images/blockAnchor";
import { showsInPage } from "@/src/core/images/backgroundMode";
import type { Segment, SegmentContentNode } from "@/src/core/schemas/entities/segments";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";
import type { InfoboxBlockData } from "@/src/core/schemas/blocks/infobox";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";
import type { QuestBlockData, QuestNote, QuestObjective } from "@/src/core/schemas/blocks/quest";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { PublicBlock } from "@/src/server/services/publicShare";
import { QUEST_STATE_LABELS_FR } from "@/src/i18n/fr";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { TimelineBlockData } from "@/src/core/schemas/blocks/timeline";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import type { SessionJournalMetaBlockData } from "@/src/core/schemas/blocks/sessionJournalMeta";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { weekdayNameForDate } from "@/src/core/calendar/weekday";
import SpoilerSpan from "./SpoilerSpan";
import PublicGenealogyBlock from "./PublicGenealogyBlock";
import PublicPersonalityBlock from "./PublicPersonalityBlock";
import PublicWorldviewBlock from "./PublicWorldviewBlock";
import PublicRelationshipBlock from "./PublicRelationshipBlock";
import PublicTimelineBlock from "./PublicTimelineBlock";
import PublicMapBlock from "./PublicMapBlock";

/**
 * V3-R3 (suite) — seul bloc public charge a la demande.
 *
 * Ce fichier est un composant SERVEUR qui importe des composants clients :
 * leur JS entre donc dans le paquet de la route, qu'ils soient rendus ou
 * non. Mesure : des sept vues publiques, six pesent moins de 1 800 lignes
 * et rien de tiers ; `PublicRelationsGraphBlock` tire `d3-force` a lui
 * seul. Il etait donc telecharge par toute page wiki JOUEUR — les routes
 * qu'on ouvre sur un telephone — meme sans aucun bloc "reseau".
 *
 * Les six autres restent en import statique : les decouper couterait un
 * aller-retour de chargement pour quelques centaines de lignes. On ne
 * decoupe que ce qui pese.
 */
const PublicRelationsGraphBlock = dynamic(() => import("./PublicRelationsGraphBlock"));

/**
 * V2.1-11 lot 3 — deuxieme vue chargee a la demande, pour une autre raison
 * que la premiere. `PublicRelationsGraphBlock` est decoupe parce qu'il PESE
 * (d3-force) ; celui-ci est leger, et le regle ci-dessus ("on ne decoupe que
 * ce qui pese") conclurait a l'import statique.
 *
 * Sauf qu'ici le poids n'est pas le sujet : c'est le seul composant CLIENT
 * de tout le rendu d'image, et le ticket promet qu'une page sans parallaxe
 * ne telecharge rien de plus qu'avant. Importe statiquement, son JS entrerait
 * dans le paquet de TOUTE page wiki, y compris celles qui n'ont aucune image.
 * La promesse deviendrait fausse.
 */
const ParallaxImage = dynamic(() => import("./ParallaxImage"));

const TAG_BY_BLOCK_TYPE: Record<Segment["blockType"], string> = {
  paragraph: "p",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  // V2.1-14 : jamais rendu par `createElement` avec des enfants — `hr` est un
  // element vide, React refuse qu'on lui en passe (voir PublicTextBlock).
  divider: "hr",
};

/**
 * V2.1-1 : un noeud `ref` de kind "entity" se resout via `textRefs` (nom/slug
 * deja calcules cote serveur, filtres par visibilite — meme motif que
 * `questRefLink` plus bas) ; "rule" construit son lien directement depuis sa
 * `key` (aucune resolution serveur necessaire) MAIS seulement si
 * `ruleHrefBase` est fourni — absent sur le partage anonyme (`/partage`,
 * `/apercu`), aucune page de regle n'y existe pour un visiteur non
 * authentifie. Cible introuvable/non fournie : lien brise, jamais retire
 * silencieusement (specs/wiki-liens-et-personnages.md §A1).
 */
function renderNode(
  node: SegmentContentNode,
  key: number,
  textRefs: Record<string, { name: string; slug: string }> | undefined,
  hrefBase: string,
  ruleHrefBase: string | undefined
) {
  if (node.t === "ref") {
    if (node.kind === "entity" && node.id) {
      const found = textRefs?.[node.id];
      if (found) {
        return (
          <Link key={key} href={`${hrefBase}/${found.slug}`} className="rich-ref-mention">
            {node.label}
          </Link>
        );
      }
      // Fiche supprimee, ou masquee a CE viewer — lien brise visible plutot
      // que retire silencieusement (specs/wiki-liens-et-personnages.md §A1).
      return (
        <span key={key} className="rich-ref-mention rich-ref-broken" title="Fiche introuvable ou non visible">
          {node.label}
        </span>
      );
    }
    if (node.kind === "rule" && node.key && ruleHrefBase) {
      return (
        <Link key={key} href={`${ruleHrefBase}/${node.key}`} className="rich-ref-mention">
          {node.label}
        </Link>
      );
    }
    return (
      <span key={key} className="rich-ref-mention">
        {node.label}
      </span>
    );
  }
  const marks = node.marks ?? [];
  let content: React.ReactNode = node.v;
  if (marks.includes("strike")) content = <s>{content}</s>;
  if (marks.includes("underline")) content = <u>{content}</u>;
  if (marks.includes("italic")) content = <em>{content}</em>;
  if (marks.includes("bold")) content = <strong>{content}</strong>;
  if (marks.includes("spoiler")) content = <SpoilerSpan>{content}</SpoilerSpan>;
  return <span key={key}>{content}</span>;
}

/**
 * Un bloc texte dont le PREMIER segment est un trait (V2.1-17, retour
 * utilisateur) : le trait ne se rend pas dans le fil du texte, il remonte
 * au-dessus du TITRE du bloc — c'est la que separer a un sens, entre deux
 * parties de la fiche, pas entre un titre et le texte qu'il annonce.
 *
 * Utilise aussi par `PublicEntityBody` pour eteindre le filet automatique du
 * bloc PRECEDENT (`border-b`, pose sur chaque bloc depuis V2-G11) : sans cela
 * le trait choisi s'ajouterait au filet impose au lieu de le remplacer, et on
 * verrait deux traits a la meme jonction.
 */
export function hasLeadRule(block: PublicBlock | undefined): boolean {
  if (!block || block.blockType !== "text") return false;
  return segmentsLeadWithRule(block.data as unknown as TextBlockData);
}

function segmentsLeadWithRule(data: TextBlockData): boolean {
  return data.segments[0]?.blockType === "divider";
}

/**
 * V2.1-11 : les images ancrees a CE bloc s'inserent entre ses segments, pas
 * a cote du bloc. `segmentId: null` remonte en tete, avant le premier
 * segment. L'insertion passe par un `Fragment` sans balise, pour que
 * `.rich-text-content[data-dropcap] > p:first-of-type` (la lettrine,
 * app/globals.css) continue de viser le bon paragraphe.
 */
function PublicTextBlock({
  data,
  textRefs,
  hrefBase,
  ruleHrefBase,
  anchoredImages,
}: {
  data: TextBlockData;
  textRefs: Record<string, { name: string; slug: string }> | undefined;
  hrefBase: string;
  ruleHrefBase: string | undefined;
  anchoredImages: AnchoredImage<PublicBlock>[];
}) {
  const atHead = anchoredImages.filter((image) => image.segmentId === null);
  const around = new Map<string, { before: AnchoredImage<PublicBlock>[]; after: AnchoredImage<PublicBlock>[] }>();
  for (const image of anchoredImages) {
    if (image.segmentId === null) continue;
    const slot = around.get(image.segmentId) ?? { before: [], after: [] };
    slot[image.position].push(image);
    around.set(image.segmentId, slot);
  }

  return (
    // V2.1-14 : la lettrine se pose sur ce conteneur (voir globals.css), le
    // meme element que porte l'editeur — un seul selecteur CSS pour les deux.
    <div className="rich-text-content" data-dropcap={data.dropCap ? "true" : undefined}>
      {atHead.map(renderAnchoredImage)}
      {(segmentsLeadWithRule(data) ? data.segments.slice(1) : data.segments).map((segment) => {
        const tag = TAG_BY_BLOCK_TYPE[segment.blockType] ?? "p";
        const slot = around.get(segment.id);
        const rendered =
          segment.blockType === "divider"
            ? createElement(tag, { "data-align": segment.align })
            : createElement(
                tag,
                { "data-align": segment.align },
                segment.content.map((node, i) => renderNode(node, i, textRefs, hrefBase, ruleHrefBase)),
              );
        if (!slot) return <Fragment key={segment.id}>{rendered}</Fragment>;
        return (
          <Fragment key={segment.id}>
            {slot.before.map(renderAnchoredImage)}
            {rendered}
            {slot.after.map(renderAnchoredImage)}
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * Une image ancree se rend SANS l'habillage de bloc (`border-b py-4`) : c'est
 * lui qui laissait une bordure orpheline et faisait demarrer l'image au-dessus
 * du titre de sa cible (V2.1-11).
 *
 * Les images en « seulement en fond » ont deja ete ecartees par
 * `visiblesDansLaPage` ci-dessous — inutile de les filtrer une seconde fois
 * ici.
 */
function renderAnchoredImage(anchored: AnchoredImage<PublicBlock>) {
  const data = anchored.block.data as unknown as ImageBlockData;
  return <PublicImageBlock key={anchored.block.id} data={data} flow={anchored.flow} />;
}

/**
 * V2.1-11 lot 2 : une image ancree en « seulement en fond » ne se rend pas
 * dans le corps de la fiche. On l'ecarte AVANT tout le reste, pour que le
 * bloc hote ne recoive pas non plus le `flow-root` d'un flottement qui
 * n'existera jamais.
 */
function visiblesDansLaPage(images: AnchoredImage<PublicBlock>[]): AnchoredImage<PublicBlock>[] {
  return images.filter((image) => showsInPage(image.block.data as unknown as ImageBlockData));
}

function PublicInfoboxBlock({ data }: { data: InfoboxBlockData }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {data.entries.map((entry, i) => (
        <div key={i} className="contents">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Bloc `session_journal_meta` (V2.1-14) : rendu dans le fil comme tout autre
 * bloc, avec son titre. Il etait jusqu'ici extrait par `PublicEntityBody` pour
 * finir en pied de page discret, reserve aux fiches `session_journal` —
 * present partout ou on l'ajoute, il ne peut plus avoir de place a part.
 *
 * Les libelles restent fixes (c'est tout l'interet de ce bloc face a un
 * `infobox`) ; une ligne absente n'est simplement pas affichee.
 */
function PublicSessionJournalMetaBlock({ data, calendar }: { data: SessionJournalMetaBlockData; calendar: PublicBlock["timelineCalendar"] }) {
  const ingameWeekday = calendar ? weekdayNameForDate(data.ingameDate, calendar) : null;
  const rows: Array<[string, string]> = [];
  if (calendar) {
    rows.push(["Date ingame", `${ingameWeekday ? `${ingameWeekday} ` : ""}${formatGameDate(data.ingameDate, calendar)}`]);
  }
  if (data.realSession) rows.push(["Session du", data.realSession.label]);
  if (data.writtenBy) rows.push(["Rédigé par", data.writtenBy.name]);
  if (data.writtenAt) {
    rows.push([
      "Rédigé le",
      new Date(data.writtenAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    ]);
  }
  if (rows.length === 0) return null;
  return (
    // `items-baseline` (V2.1-17, retour utilisateur capture a l'appui) : le
    // libelle (10px) et la valeur (14px) n'ont pas la meme hauteur de ligne.
    // L'alignement par defaut d'une grille (`stretch`) pose chacun en haut de
    // SA cellule, donc leurs lignes de base divergent d'autant plus que
    // l'ecart de taille est grand. La ligne de base est le seul alignement
    // qui tienne entre deux textes de tailles differentes.
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Largeur de reference a 100% (V2-G12) — meme mecanique que le portrait (`PortraitUpload.tsx`/`PublicPortrait.tsx`), une autre reference car une image de bloc peut occuper toute la colonne de prose (`max-w-[70ch]`), pas juste une case de cote. */
const BASE_IMAGE_WIDTH_PX = 480;

/**
 * `flow` absent = image en mode flux : un bloc a part entiere, pleine
 * largeur de la colonne, jamais flottante. `"float"` la fait flotter et
 * le texte du bloc hote s'ecoule autour ; `"break"` la pose entre deux
 * segments, sur toute la largeur.
 *
 * La largeur passe par une propriete personnalisee plutot que par
 * `style={{ width }}` : un style en ligne l'emporterait sur les classes, et
 * le repli mobile (`max-sm:`) ne pourrait pas la reprendre.
 */
export function PublicImageBlock({ data, flow }: { data: ImageBlockData; flow?: AnchorFlow }) {
  if (!data.url) return null;
  const widthPx = (BASE_IMAGE_WIDTH_PX * data.sizePct) / 100;
  // Sous 640px, une colonne de texte a cote d'une image de 480px est
  // illisible : le flottement est abandonne et l'image reprend toute la
  // largeur (retour utilisateur V2.1-11).
  const floating =
    flow === "float"
      ? `mb-3 max-sm:float-none max-sm:mx-0 max-sm:w-full ${data.align === "left" ? "float-left mr-4 max-sm:mr-0" : "float-right ml-4 max-sm:ml-0"}`
      : data.align === "left"
        ? "items-start"
        : data.align === "right"
          ? "items-end ml-auto"
          : "items-center mx-auto";
  return (
    <figure
      className={`flex w-[var(--img-w)] max-w-full flex-col gap-1.5 ${floating} ${flow === "break" ? "my-3" : ""}`}
      style={{ "--img-w": `${widthPx}px` } as CSSProperties & Record<`--${string}`, string>}
    >
      {/* V2.1-11 lot 3 : seule une intensite > 0 monte le composant client.
          Une page dont aucune image n'est en parallaxe ne telecharge donc
          rien de plus qu'avant — le curseur est son propre interrupteur. */}
      {data.parallaxPct > 0 ? (
        <ParallaxImage src={data.url} alt={data.caption} intensityPct={data.parallaxPct} />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={data.url} alt={data.caption} loading="lazy" decoding="async" className="w-full rounded-md object-cover" />
      )}
      {data.caption && <figcaption className="text-xs italic text-ink-muted">{data.caption}</figcaption>}
    </figure>
  );
}

function PublicCustomTableBlock({ data }: { data: CustomTableBlockData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge/60">
            {data.columns.map((col) => (
              <th key={col} className="py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="border-b border-edge/30">
              {data.columns.map((col) => (
                <td key={col} className="py-1 pr-4">
                  {typeof row[col] === "string" || typeof row[col] === "number" ? String(row[col]) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function questRefLink(
  ref: BlockReference | null | undefined,
  questRefs: Record<string, { name: string; slug: string }> | undefined,
  hrefBase: string
) {
  if (!ref || ref.kind !== "entity") return null;
  const found = questRefs?.[ref.id];
  if (!found) return null;
  return (
    <Link href={`${hrefBase}/${found.slug}`} className="rich-ref-mention">
      {found.name}
    </Link>
  );
}

function PublicQuestBlock({
  data,
  questRefs,
  hrefBase,
}: {
  data: QuestBlockData;
  questRefs: Record<string, { name: string; slug: string }> | undefined;
  hrefBase: string;
}) {
  function noteList(items: QuestNote[], label: string) {
    if (items.length === 0) return null;
    return (
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              {item.text} {questRefLink(item.ref, questRefs, hrefBase)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="rounded-full border border-edge px-2 py-0.5">{QUEST_STATE_LABELS_FR[data.state] ?? data.state}</span>
        {questRefLink(data.giver, questRefs, hrefBase) && <span>Commanditaire : {questRefLink(data.giver, questRefs, hrefBase)}</span>}
      </div>
      {data.objectives.length > 0 && (
        <ul className="flex flex-col gap-1">
          {data.objectives.map((objective: QuestObjective) => (
            <li key={objective.id} className={`flex items-start gap-2 ${objective.done ? "text-ink-muted line-through" : ""}`}>
              <span aria-hidden>{objective.done ? "☑" : "☐"}</span>
              <span>
                {objective.text} {questRefLink(objective.ref, questRefs, hrefBase)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {noteList(data.rewards, "Récompenses")}
      {noteList(data.prerequisites, "Prérequis")}
    </div>
  );
}

/**
 * Rendu dedie a la page publique de partage — pas les editeurs
 * (components/blocks/*BlockEditor.tsx) : aucun champ, aucun bouton, aucun
 * appel d'ecriture possible. Garantit qu'un visiteur anonyme ne peut
 * jamais declencher une mutation, meme par accident.
 */
export default function PublicBlockView({
  block,
  hrefBase,
  ruleHrefBase,
  anchoredImages = [],
  suppressBottomRule = false,
}: {
  block: PublicBlock;
  hrefBase: string;
  /** V2.1-1 : base des liens vers une fiche de regle (ex. `/m/[worldSlug]/joueur/regles`) — absent sur le partage anonyme (`/partage`, `/apercu`), aucune page de regle n'y existe pour un visiteur non authentifie. */
  ruleHrefBase?: string;
  /** V2.1-11 : images ancrees DANS ce bloc (`planImageAnchors`), a inserer entre ses segments — jamais a cote de lui. */
  anchoredImages?: AnchoredImage<PublicBlock>[];
  /** V2.1-17 : le bloc SUIVANT ouvre sur un trait choisi, qui remplace le filet automatique de cette jonction au lieu de s'y ajouter (`hasLeadRule`, calcule par `PublicEntityBody` qui seul voit la suite). */
  suppressBottomRule?: boolean;
}) {
  const imagesVisibles = visiblesDansLaPage(anchoredImages);
  // Retour utilisateur (V2-G13) : une image active comme fond de page est
  // deja rendue par WikiBackgroundProvider (position fixed, plein ecran) —
  // la rendre en plus a sa place dans le corps de la fiche la dupliquerait
  // ("en fond" ET "au fond de la page").
  //
  // V2.1-11 lot 2 : cette duplication est desormais un CHOIX. Seul le mode
  // « seulement en fond » retire l'image d'ici ; « en plus de la fiche » la
  // laisse aux deux endroits, ce que l'auteur voulait.
  if (block.blockType === "image" && !showsInPage(block.data as unknown as ImageBlockData)) {
    return null;
  }
  // V2.1-6 : un bloc `music` ne s'affiche plus du tout ici — ni contenu, ni
  // titre, ni cadre. Il ne sert qu'a poser une ambiance sonore, et son seul
  // reste visible est un bouton que `PublicEntityBody` pose a cote du nom de
  // la fiche, quel que soit l'endroit ou le bloc a ete range.
  if (block.blockType === "music") {
    return null;
  }
  const leadRule = hasLeadRule(block);
  return (
    // `flow-root` seulement quand ce bloc heberge une image : il contient le
    // flottement a l'interieur du bloc, pour qu'une image plus haute que son
    // texte ne deborde pas sur le bloc suivant. Pose sans condition, il
    // changerait la fusion des marges de TOUS les blocs.
    <div
      className={`border-b border-edge/60 py-4 first:pt-0 last:border-b-0 ${suppressBottomRule ? "!border-b-0" : ""} ${imagesVisibles.length > 0 ? "flow-root" : ""}`}
    >
      {/* V2.1-17 : un trait pose en tete d'un bloc texte se rend ICI, avant
          le titre — jamais entre le titre et le texte qu'il annonce (retour
          utilisateur). `PublicTextBlock` saute donc son premier segment. */}
      {leadRule && <hr className="block-lead-rule" />}
      {/* Retour utilisateur : le titre du bloc (souvent juste "Image") est
          redondant avec l'image/la legende elle-meme sur le wiki public —
          jamais affiche pour ce type, contrairement a l'editeur ou il
          reste utile pour s'y retrouver parmi plusieurs blocs. */}
      {block.blockType !== "image" && <h3 className="block-title mb-2">{block.display.label}</h3>}
      {block.blockType === "text" && (
        <PublicTextBlock
          data={block.data as unknown as TextBlockData}
          textRefs={block.textRefs}
          hrefBase={hrefBase}
          ruleHrefBase={ruleHrefBase}
          anchoredImages={imagesVisibles}
        />
      )}
      {block.blockType === "infobox" && <PublicInfoboxBlock data={block.data as unknown as InfoboxBlockData} />}
      {block.blockType === "session_journal_meta" && (
        <PublicSessionJournalMetaBlock
          data={block.data as unknown as SessionJournalMetaBlockData}
          calendar={block.timelineCalendar}
        />
      )}
      {block.blockType === "image" && <PublicImageBlock data={block.data as unknown as ImageBlockData} />}
      {block.blockType === "genealogy" && block.genealogyTree && (
        <PublicGenealogyBlock tree={block.genealogyTree} hrefBase={hrefBase} />
      )}
      {block.blockType === "custom_table" && (
        <PublicCustomTableBlock data={block.data as unknown as CustomTableBlockData} />
      )}
      {block.blockType === "quest" && (
        <PublicQuestBlock data={block.data as unknown as QuestBlockData} questRefs={block.questRefs} hrefBase={hrefBase} />
      )}
      {block.blockType === "personality" && (
        <PublicPersonalityBlock
          data={block.data as unknown as PersonalityBlockData}
          events={block.personalityEvents ?? []}
          calendar={block.timelineCalendar ?? null}
        />
      )}
      {block.blockType === "worldview" && (
        <PublicWorldviewBlock
          data={block.data as unknown as WorldviewBlockData}
          events={block.personalityEvents ?? []}
          calendar={block.timelineCalendar ?? null}
        />
      )}
      {block.blockType === "relationship" && (
        <PublicRelationshipBlock
          axes={block.relationshipAxes ?? {}}
          target={block.relationshipTarget ?? null}
          hrefBase={hrefBase}
          events={block.relationshipEvents ?? []}
          calendar={block.timelineCalendar ?? null}
        />
      )}
      {block.blockType === "relations_graph" && block.relationsGraph && (
        <PublicRelationsGraphBlock graph={block.relationsGraph} hrefBase={hrefBase} />
      )}
      {block.blockType === "timeline" && block.timelineCalendar && (
        <PublicTimelineBlock
          data={block.data as unknown as TimelineBlockData}
          calendar={block.timelineCalendar}
          refs={block.timelineRefs ?? {}}
          hrefBase={hrefBase}
        />
      )}
      {block.blockType === "map" && (
        <PublicMapBlock
          data={block.data as unknown as MapBlockData}
          mapSource={block.mapSource}
          mapPins={block.mapPins}
          mapRegions={block.mapRegions}
          hrefBase={hrefBase}
        />
      )}
    </div>
  );
}
