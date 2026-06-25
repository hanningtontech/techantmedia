import { Streamdown } from "streamdown";

type Props = {
  content: string;
  className?: string;
};

/** Renders technical breakdown copy with Markdown (lists, code, emphasis). */
export function TechnicalMarkdown({ content, className = "" }: Props) {
  if (!content.trim()) return null;
  return (
    <div className={`xai-markdown ${className}`}>
      <Streamdown>{content}</Streamdown>
    </div>
  );
}
