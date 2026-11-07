import { memo, useMemo, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { ImageIcon } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { headingAnchors } from "./documentUtils";

function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  return (
    <div className="markdown-code-block">
      <CopyButton
        value={() => preRef.current?.querySelector("code")?.textContent ?? preRef.current?.textContent ?? ""}
        message="Code copied"
        ariaLabel="Copy code"
        className="markdown-copy h-7 w-7"
        size="icon"
        variant="ghost"
      />
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

export const MarkdownPreview = memo(function MarkdownPreview({ text }: { text: string }) {
  const anchors = useMemo(() => headingAnchors(text), [text]);
  let headingIndex = 0;
  return <div className="markdown-rendered"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeHighlight, { detect: false, ignoreMissing: true }]]} components={{
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    img: ({ alt }) => <span className="markdown-image-placeholder"><ImageIcon className="h-4 w-4 inline mr-2" />{alt || "Image"} · external image blocked</span>,
    a: ({ children, href }) => <a href={href} target={href?.startsWith("#") ? undefined : "_blank"} rel="noreferrer noopener">{children}</a>,
    h1: ({ children }) => <h1 id={anchors[headingIndex++]?.slug}>{children}</h1>,
    h2: ({ children }) => <h2 id={anchors[headingIndex++]?.slug}>{children}</h2>,
    h3: ({ children }) => <h3 id={anchors[headingIndex++]?.slug}>{children}</h3>,
    h4: ({ children }) => <h4 id={anchors[headingIndex++]?.slug}>{children}</h4>,
    h5: ({ children }) => <h5 id={anchors[headingIndex++]?.slug}>{children}</h5>,
    h6: ({ children }) => <h6 id={anchors[headingIndex++]?.slug}>{children}</h6>,
  }}>{text}</ReactMarkdown></div>;
});