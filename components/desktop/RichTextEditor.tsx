"use client";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Spoiler, MjHidden } from "@/lib/tiptap/marks";

const TEXT_COLORS = [
  { label: "Défaut", value: null },
  { label: "Doré", value: "#c9a24a" },
  { label: "Rouge", value: "#e0796a" },
  { label: "Bleu", value: "#60a5fa" },
  { label: "Vert", value: "#4ade80" },
];

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`toolbar-btn ${active ? "toolbar-btn-active" : ""}`}
    >
      {children}
    </button>
  );
}

function TextTypeDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  const current = editor.isActive("heading", { level: 1 })
    ? "Titre 1"
    : editor.isActive("heading", { level: 2 })
      ? "Titre 2"
      : editor.isActive("heading", { level: 3 })
        ? "Titre 3"
        : "Paragraphe";

  return (
    <div className="relative">
      <ToolbarButton onClick={() => setOpen((v) => !v)} title="Type de texte">
        {current} ▾
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex w-32 flex-col rounded-md border border-border bg-surface shadow-xl">
          {[
            { label: "Paragraphe", action: () => editor.chain().focus().setParagraph().run() },
            { label: "Titre 1", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
            { label: "Titre 2", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
            { label: "Titre 3", action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className="px-2 py-1 text-left text-xs text-foreground hover:bg-surface-hover"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorPicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <ToolbarButton onClick={() => setOpen((v) => !v)} title="Couleur du texte">
        <span className="underline decoration-2" style={{ textDecorationColor: "var(--accent)" }}>
          A
        </span>
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-md border border-border bg-surface p-1.5 shadow-xl">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (c.value) {
                  editor.chain().focus().setColor(c.value).run();
                } else {
                  editor.chain().focus().unsetColor().run();
                }
                setOpen(false);
              }}
              className="h-5 w-5 rounded-full border border-border"
              style={{ background: c.value ?? "var(--foreground)" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RichTextEditor({
  content,
  onBlurSave,
  placeholder,
}: {
  content: string;
  onBlurSave: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      Color,
      Spoiler,
      MjHidden,
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-editor",
        "data-placeholder": placeholder ?? "",
      },
    },
    onBlur: ({ editor }) => onBlurSave(editor.getHTML()),
  });

  if (!editor) return null;

  function setExternalLink() {
    const previousUrl = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL du lien :", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-glass p-1 shadow-2xl backdrop-blur-xl"
      >
        <TextTypeDropdown editor={editor} />
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <span className="font-bold">G</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Barré"
        >
          <span className="line-through">S</span>
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton active={editor.isActive("link")} onClick={setExternalLink} title="Lien externe">
          🔗
        </ToolbarButton>
        <ColorPicker editor={editor} />
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          active={editor.isActive("spoiler")}
          onClick={() => editor.chain().focus().toggleMark("spoiler").run()}
          title="Spoiler (cliquer pour révéler)"
        >
          👁
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("mjHidden")}
          onClick={() => editor.chain().focus().toggleMark("mjHidden").run()}
          title="Masquer aux joueurs"
        >
          🔒
        </ToolbarButton>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
