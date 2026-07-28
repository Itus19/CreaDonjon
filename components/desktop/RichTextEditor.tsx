"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

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
    extensions: [StarterKit],
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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 border-b border-border pb-1.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`toolbar-btn ${editor.isActive("bold") ? "toolbar-btn-active" : ""}`}
        >
          <span className="font-bold">G</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`toolbar-btn ${editor.isActive("italic") ? "toolbar-btn-active" : ""}`}
        >
          <span className="italic">I</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`toolbar-btn ${editor.isActive("heading", { level: 3 }) ? "toolbar-btn-active" : ""}`}
        >
          Titre
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`toolbar-btn ${editor.isActive("bulletList") ? "toolbar-btn-active" : ""}`}
        >
          • Liste
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
