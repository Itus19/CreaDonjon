import WikiFicheSkeleton from "@/components/entities/public/WikiFicheSkeleton";

/**
 * AG-23 — la fiche côté MJ esquisse la colonne de lecture, comme le wiki :
 * titre puis prose, ce que toute fiche possède (règle C6 de docs/CABLAGE.md).
 */
export default function Loading() {
  return <WikiFicheSkeleton />;
}
