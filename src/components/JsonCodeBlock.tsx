import React, { useMemo } from 'react';

interface JsonCodeBlockProps {
  json: string;
  httpStatusLine?: string;
  httpHeaders?: Array<[string, string]>;
  showLineNumbers?: boolean;
  className?: string;
}

const TOKEN_REGEX =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:])/g;

function highlightJsonLine(line: string, lineIdx: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let tokenIdx = 0;
  TOKEN_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    const token = match[0];
    let cls = 'text-slate-300';

    if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        // Property key + colon
        const colonIdx = token.lastIndexOf(':');
        const keyPart = token.slice(0, colonIdx);
        const colonPart = token.slice(colonIdx);
        parts.push(
          <span key={`${lineIdx}-k-${tokenIdx}`} className="text-sky-300 font-medium">
            {keyPart}
          </span>
        );
        parts.push(
          <span key={`${lineIdx}-c-${tokenIdx}`} className="text-slate-500">
            {colonPart}
          </span>
        );
        lastIndex = match.index + token.length;
        tokenIdx += 1;
        continue;
      }
      cls = 'text-emerald-300';
    } else if (token === 'true' || token === 'false') {
      cls = 'text-violet-300 font-medium';
    } else if (token === 'null') {
      cls = 'text-rose-400 italic';
    } else if (/^-?\d/.test(token)) {
      cls = 'text-amber-300';
    } else if (/^[{}\[\],:]$/.test(token)) {
      cls = 'text-slate-500';
    }

    parts.push(
      <span key={`${lineIdx}-t-${tokenIdx}`} className={cls}>
        {token}
      </span>
    );

    lastIndex = match.index + token.length;
    tokenIdx += 1;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts.length > 0 ? parts : ' ';
}

export function JsonCodeBlock({
  json,
  httpStatusLine,
  httpHeaders,
  showLineNumbers = false,
  className = '',
}: JsonCodeBlockProps) {
  const { lines, truncatedCount } = useMemo(() => {
    const rawLines = json.split('\n');
    const maxLines = 1800;
    if (rawLines.length > maxLines) {
      return {
        lines: rawLines.slice(0, maxLines),
        truncatedCount: rawLines.length - maxLines,
      };
    }
    return { lines: rawLines, truncatedCount: 0 };
  }, [json]);

  return (
    <div className={`font-mono text-xs leading-relaxed text-slate-200 ${className}`}>
      {httpStatusLine && (
        <div className="mb-3 border-b border-slate-800/90 pb-3 space-y-0.5 select-all">
          <div
            className={
              httpStatusLine.includes('200')
                ? 'font-semibold text-emerald-400'
                : 'font-semibold text-amber-300'
            }
          >
            {httpStatusLine}
          </div>
          {httpHeaders?.map(([name, value]) => (
            <div key={name} className="break-all">
              <span className="text-sky-300">{name}:</span>{' '}
              <span className="text-slate-300">{value}</span>
            </div>
          ))}
        </div>
      )}

      <pre className="whitespace-pre-wrap break-words">
        {lines.map((line, idx) => (
          <div key={idx} className={showLineNumbers ? 'flex gap-4' : undefined}>
            {showLineNumbers && (
              <span className="w-8 shrink-0 select-none text-right text-slate-600 tabular-nums">
                {idx + 1}
              </span>
            )}
            <span className="min-w-0 flex-1">{highlightJsonLine(line, idx)}</span>
          </div>
        ))}
        {truncatedCount > 0 && (
          <div className="mt-2 text-slate-500">
            ... ({truncatedCount.toLocaleString('id-ID')} baris tambahan — gunakan Salin atau Download .json untuk isi lengkap)
          </div>
        )}
      </pre>
    </div>
  );
}
