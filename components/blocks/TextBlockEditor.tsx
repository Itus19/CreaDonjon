"use client";

import RichTextEditor from "@/components/entities/richtext/RichTextEditor";
import type { Segment } from "@/src/core/schemas/entities/segments";
import type { TextBlockData } from "@/src/core/schemas/blocks/text";

export default function TextBlockEditor({
  data,
  onChange,
}: {
  data: TextBlockData;
  onChange: (data: TextBlockData) => void;
}) {
  return (
    <RichTextEditor
      segments={data.segments}
      onChange={(segments: Segment[]) => onChange({ __v: 1, segments })}
    />
  );
}
