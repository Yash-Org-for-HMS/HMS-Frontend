import { useEffect } from "react";
import { Box, IconButton, Tooltip, Divider } from "@mui/material";
import {
  FormatBoldRounded,
  FormatItalicRounded,
  FormatListBulletedRounded,
  FormatListNumberedRounded,
} from "@mui/icons-material";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string | number;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        p: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Tooltip title="Bold">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBold().run()}
          sx={{
            bgcolor: editor.isActive("bold") ? "rgba(59,130,246,0.15)" : "transparent",
            color: editor.isActive("bold") ? "#3b82f6" : "text.secondary",
            borderRadius: 1.5,
          }}
        >
          <FormatBoldRounded fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Italic">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          sx={{
            bgcolor: editor.isActive("italic") ? "rgba(59,130,246,0.15)" : "transparent",
            color: editor.isActive("italic") ? "#3b82f6" : "text.secondary",
            borderRadius: 1.5,
          }}
        >
          <FormatItalicRounded fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Bullet List">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          sx={{
            bgcolor: editor.isActive("bulletList") ? "rgba(59,130,246,0.15)" : "transparent",
            color: editor.isActive("bulletList") ? "#3b82f6" : "text.secondary",
            borderRadius: 1.5,
          }}
        >
          <FormatListBulletedRounded fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Numbered List">
        <IconButton
          size="small"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          sx={{
            bgcolor: editor.isActive("orderedList") ? "rgba(59,130,246,0.15)" : "transparent",
            color: editor.isActive("orderedList") ? "#3b82f6" : "text.secondary",
            borderRadius: 1.5,
          }}
        >
          <FormatListNumberedRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default function RichTextEditor({ value, onChange, placeholder = "Type here...", minHeight = 120 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync the editor when `value` is changed from the outside (e.g. applying a
  // SOAP template or loading a saved consultation). TipTap only reads `content`
  // at init, so without this the editor ignores external updates. The guard
  // avoids resetting (and jumping the cursor) on the user's own keystrokes,
  // since those make `value` already equal to the editor's HTML.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s",
        "&:focus-within": {
          borderColor: "#3b82f6",
        },
        "& .ProseMirror": {
          p: 2,
          minHeight,
          outline: "none",
          color: "text.primary",
          typography: "body2",
          "& p.is-editor-empty:first-child::before": {
            color: "text.secondary",
            content: "attr(data-placeholder)",
            float: "left",
            height: 0,
            pointerEvents: "none",
          },
          "& ul": {
            pl: 3,
            my: 1,
          },
          "& ol": {
            pl: 3,
            my: 1,
          },
          "& p": {
            my: 0.5,
          },
        },
      }}
    >
      <MenuBar editor={editor} />
      <Box sx={{ flex: 1, overflowY: "auto", bgcolor: "background.paper" }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
