import DOMPurify from "dompurify";

// Allow-list matches exactly what RichTextEditor (Tiptap StarterKit, no link
// extension configured) can produce — nothing else should ever appear in
// content that came from that editor, so anything outside this list is
// treated as an injection attempt rather than legitimate formatting.
const RICH_TEXT_ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "s", "u",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "code", "pre", "hr",
];

/**
 * Sanitize HTML authored by RichTextEditor (doctor notes, SOAP assessments,
 * etc.) before rendering with dangerouslySetInnerHTML. Strips everything but
 * the editor's own formatting tags — no attributes, no scripts, no event
 * handlers — regardless of what a compromised account or a stored draft
 * might contain.
 */
export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
