"use client";

import SegmentsEditor from "@/components/entities/SegmentsEditor";
import type { Segment } from "@/src/core/schemas/entities/segments";
import type { DescriptionBlockData } from "@/src/core/schemas/blocks/description";

export default function DescriptionBlockEditor({
  data,
  onChange,
}: {
  data: DescriptionBlockData;
  onChange: (data: DescriptionBlockData) => void;
}) {
  return (
    <SegmentsEditor
      segments={data.segments}
      onChange={(segments: Segment[]) => onChange({ __v: 1, segments })}
    />
  );
}
