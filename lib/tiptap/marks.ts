import { Mark, mergeAttributes } from "@tiptap/core";

// Spoiler: visible to the author while editing (dashed highlight); the
// actual click-to-reveal behaviour belongs to a future read-only/player
// rendering, not the editor itself.
export const Spoiler = Mark.create({
  name: "spoiler",
  parseHTML() {
    return [{ tag: "span[data-spoiler]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-spoiler": "true", class: "mark-spoiler" }),
      0,
    ];
  },
});

// Marks text as MJ-only. Same caveat: this only records intent for now.
// Actually hiding it from players needs the server-side visibility
// resolution work tracked in ROADMAP.md.
export const MjHidden = Mark.create({
  name: "mjHidden",
  parseHTML() {
    return [{ tag: "span[data-mj-hidden]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-mj-hidden": "true", class: "mark-mj-hidden" }),
      0,
    ];
  },
});
