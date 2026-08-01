/** Mise en page `prose` (specs/regles-blocs.md §4) : segments narratifs. Une fiche de regle importee n'a que du public — pas de visibilite par segment ici (contrairement au wiki). */
export default function Prose({ segments }: { segments: { text: string }[] }) {
  return (
    <div className="rich-text-content flex flex-col gap-2">
      {segments.map((segment, i) => (
        <p key={i}>{segment.text}</p>
      ))}
    </div>
  );
}
