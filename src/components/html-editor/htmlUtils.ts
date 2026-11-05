import DOMPurify from "dompurify";

export const WELCOME_HTML = "<p><em>Hey!</em></p><p>Welcome to this HTML WYSIWYG editor.</p>";

/** Allow only the editor's document schema; never load imported remote assets. */
export function sanitizeHTML(input: string): string {
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "s", "u", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr", "a", "table", "tbody", "thead", "tr", "th", "td", "img"],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "colspan", "rowspan", "style", "start"],
    ALLOW_DATA_ATTR: false,
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.body.querySelectorAll("*").forEach(element => {
    const alignment = element instanceof HTMLElement ? element.style.textAlign : "";
    element.removeAttribute("style");
    if (["left", "center", "right", "justify"].includes(alignment)) element.setAttribute("style", `text-align: ${alignment}`);
    if (element.tagName === "IMG" && !/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(element.getAttribute("src") ?? "")) element.remove();
    if (element.tagName === "A") {
      const href = element.getAttribute("href") ?? "";
      if (!safeLink(href)) element.removeAttribute("href");
      else { element.setAttribute("rel", "noopener noreferrer"); }
    }
  });
  return doc.body.innerHTML;
}

export function safeLink(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|#)/i.test(url.trim()) && !/[\u0000-\u001f\u007f]/.test(url);
}

export function formatHTML(html: string): string {
  return html.replace(/(<\/(?:p|h[1-6]|ul|ol|li|blockquote|pre|table|tr)>|<hr>)(?=<)/g, "$1\n");
}

export function htmlDocument(html: string): string {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Document</title></head><body>\n${formatHTML(sanitizeHTML(html))}\n</body></html>`;
}