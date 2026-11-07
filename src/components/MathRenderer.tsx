import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split text by $$...$$ or $...$
  const renderFormattedText = (text: string) => {
    // If text contains HTML table, split around it
    if (text.includes('<table')) {
      return <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: text }} />;
    }

    // Match $...$ or $$...$$
    // Regex matches $$...$$ or $...$
    const parts: React.ReactNode[] = [];
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Push preceding text
      if (match.index > lastIndex) {
        const plainText = text.substring(lastIndex, match.index);
        parts.push(plainText);
      }

      const mathToken = match[0];
      const isDisplay = mathToken.startsWith('$$');
      const mathExpr = isDisplay ? mathToken.slice(2, -2) : mathToken.slice(1, -1);

      try {
        const rendered = katex.renderToString(mathExpr, {
          displayMode: isDisplay,
          throwOnError: false,
        });
        parts.push(
          <span
            key={`math_${match.index}`}
            dangerouslySetInnerHTML={{ __html: rendered }}
            className={isDisplay ? 'block my-2 text-center' : 'inline-block mx-0.5'}
          />
        );
      } catch {
        parts.push(<span key={`err_${match.index}`} className="font-mono text-red-500">{mathToken}</span>);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // Split by newlines to render paragraphs
  const lines = content.split('\n');

  return (
    <div className={`leading-relaxed break-words ${className}`}>
      {lines.map((line, idx) => (
        <React.Fragment key={idx}>
          {line.startsWith('<table') ? (
            <div className="overflow-x-auto my-2" dangerouslySetInnerHTML={{ __html: line }} />
          ) : (
            <span>{renderFormattedText(line)}</span>
          )}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
};
