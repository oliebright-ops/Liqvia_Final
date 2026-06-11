'use client';

import ReactMarkdown from 'react-markdown';

export function MarkdownReply({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none text-sm prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-headings:my-2 prose-strong:text-foreground">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
