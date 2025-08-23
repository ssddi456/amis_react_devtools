import React from 'react';
import './text_highlight.css';

// TextHighlight component for rendering highlighted SQL text
export const TextHighlight: React.FC<{ text: string; highlights: { start: number; end: number; type: string }[] }> = ({ text, highlights }) => {
    const parts = [];
    let lastIndex = 0;

    highlights.forEach(({ start, end, type }) => {
        parts.push(<span key={`${lastIndex}-text`}>{text.slice(lastIndex, start)}</span>);
        parts.push(<span key={`${start}-highlight`} className={`highlight ${type}`} title={type}>{text.slice(start, end)}</span>);
        lastIndex = end;
    });

    parts.push(<span key={`${lastIndex}-text`}>{text.slice(lastIndex)}</span>);

    return <>{parts}</>;
};
