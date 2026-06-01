"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

/**
 * Renders the skill markdown body with GFM + syntax-highlighted code blocks.
 * Styling is applied via the `prose-atrium` class (see selectors below).
 */
export function SkillBodyViewer({ body }: { body: string }) {
  return (
    <div className="prose-atrium max-w-none text-sm leading-relaxed text-muted">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {body}
      </ReactMarkdown>
      <style>{`
        .prose-atrium h1,.prose-atrium h2,.prose-atrium h3{color:var(--color-foreground);font-weight:600;margin:1.4em 0 .5em;line-height:1.25}
        .prose-atrium h1{font-size:1.5rem}.prose-atrium h2{font-size:1.25rem}.prose-atrium h3{font-size:1.05rem}
        .prose-atrium p{margin:.75em 0}
        .prose-atrium a{color:var(--color-accent);text-decoration:underline;text-underline-offset:2px}
        .prose-atrium ul,.prose-atrium ol{margin:.75em 0;padding-left:1.4em}
        .prose-atrium li{margin:.3em 0}
        .prose-atrium code{font-family:var(--font-mono);font-size:.85em;background:rgba(47,56,38,.08);padding:.15em .4em;border-radius:.35rem;color:var(--color-foreground)}
        .prose-atrium pre{background:var(--color-card-elevated);border:1px solid var(--color-border);border-radius:.6rem;padding:1rem;overflow-x:auto;margin:1em 0}
        .prose-atrium pre code{background:none;padding:0;font-size:.82rem}
        .prose-atrium blockquote{border-left:2px solid var(--color-accent);padding-left:1em;color:var(--color-muted-foreground);margin:1em 0}
        .prose-atrium table{width:100%;border-collapse:collapse;margin:1em 0;font-size:.85em}
        .prose-atrium th,.prose-atrium td{border:1px solid var(--color-border);padding:.5em .7em;text-align:left}
        .prose-atrium hr{border-color:var(--color-border);margin:1.5em 0}
      `}</style>
    </div>
  );
}
