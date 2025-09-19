import React from 'react';
import './text_highlight.css';


function normalizeHighlights(highlights: { start: number; end: number; type: string }[]) {
    if (highlights.length === 0) {
        return [];
    }

    // Sort highlights by start position
    highlights.sort((a, b) => a.start - b.start);

    const normalized: { start: number; end: number; type: string }[] = [];
    let current = highlights[0];

    for (let i = 1; i < highlights.length; i++) {
        const next = highlights[i];
        if (next.start <= current.end) {
            // Overlapping or contiguous ranges, cut out the overlapping part
            // |aaaaaa|
            //     |bbbbbb|
            // becomes
            // |aaaa|<aa,bb>|bbbb|
            // where <aa,bb> is the overlapping part with combined types
            // |aaaaaa|
            //   |bb|
            // becomes
            // |aa|<aa,bb>|aa|
            //
            const currentEnd = current.end;
            current.end = next.start;

            normalized.push(current);
            const overlaped = {
                start: next.start,
                end: Math.min(currentEnd, next.end),
                type: current.type + ', ' + next.type,
            };
            if (next.end > currentEnd) {
                normalized.push(overlaped);
                current = {
                    start: currentEnd,
                    end: next.end,
                    type: next.type,
                };
            } else if (next.end === currentEnd) {
                current = overlaped;
            } else {
                normalized.push(overlaped);
                current = {
                    start: next.end,
                    end: currentEnd,
                    type: current.type,
                };
            }
        } else {
            // No overlap, push the current range and move to the next
            normalized.push(current);
            current = next;
        }
    }
    // Push the last range
    normalized.push(current);

    return normalized;
}

// TextHighlight component for rendering highlighted SQL text
export const TextHighlight: React.FC<{ text: string; highlights: { start: number; end: number; type: string }[] }> = ({ text, highlights }) => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    const normalizedHighlights = normalizeHighlights(highlights);

    normalizedHighlights.forEach(({ start, end, type }) => {
        parts.push(<span key={`${lastIndex}-${start}-text`}>{text.slice(lastIndex, start)}</span>);
        parts.push(<span key={`${start}-${end}-highlight`} className={`highlight ${type}`} title={type}>{text.slice(start, end)}</span>);
        lastIndex = end;
    });

    parts.push(<span key={`${lastIndex}-text`}>{text.slice(lastIndex)}</span>);

    return <>{parts}</>;
};
