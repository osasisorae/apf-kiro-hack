"use client";

import React from "react";

export default function MessageContent({ content }) {
  const renderMarkdown = (text) => {
    const lines = text.split("\n");
    const elements = [];
    let currentList = [];
    let inList = false;

    lines.forEach((line, index) => {
      const numberedListMatch = line.match(/^(\d+)\.\s\*\*(.*?)\*\*:\s(.*)$/);
      if (numberedListMatch) {
        if (!inList) {
          inList = true;
          currentList = [];
        }
        currentList.push(
          <li key={index} className="markdown-list-item">
            <strong>{numberedListMatch[2]}</strong>: {numberedListMatch[3]}
          </li>,
        );
        return;
      }

      if (inList && !numberedListMatch) {
        elements.push(
          <ol key={`list-${elements.length}`} className="markdown-ordered-list">
            {currentList}
          </ol>,
        );
        currentList = [];
        inList = false;
      }

      if (line.includes("**")) {
        const parts = line.split(/(\*\*.*?\*\*)/);
        const formattedLine = parts.map((part, partIndex) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });
        elements.push(
          <div key={index} className="markdown-line">
            {formattedLine}
          </div>,
        );
      } else if (line.trim() === "") {
        elements.push(<div key={index} className="markdown-spacing"></div>);
      } else {
        elements.push(
          <div key={index} className="markdown-line">
            {line}
          </div>,
        );
      }
    });

    if (inList && currentList.length > 0) {
      elements.push(
        <ol key={`list-${elements.length}`} className="markdown-ordered-list">
          {currentList}
        </ol>,
      );
    }

    return elements;
  };

  return <div className="message-markdown">{renderMarkdown(content)}</div>;
}

