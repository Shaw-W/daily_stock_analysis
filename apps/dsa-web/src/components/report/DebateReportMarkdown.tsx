import type React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownToPlainText } from '../../utils/markdown';

type DebateReportMarkdownProps = {
  content: string;
};

const DebateReportMarkdown: React.FC<DebateReportMarkdownProps> = ({ content }) => {
  const handleCopy = async (plain = false) => {
    const text = plain ? markdownToPlainText(content) : content;
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={() => void handleCopy(false)}>复制 Markdown</button>
        <button type="button" className="btn-secondary text-xs" onClick={() => void handleCopy(true)}>复制纯文本</button>
      </div>
      <div className="prose prose-sm max-w-none rounded-2xl border border-border/70 bg-elevated/70 p-5 text-foreground dark:prose-invert">
        <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
      </div>
    </div>
  );
};

export default DebateReportMarkdown;
