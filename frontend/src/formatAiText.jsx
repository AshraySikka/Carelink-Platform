// Turns the light Markdown Gemini tends to write (**bold**, "* " bullet
// lists, blank line paragraph breaks) into real React elements, without
// pulling in a full Markdown library for something this small. Shared by
// the chat bubble's Assistant tab and the AI search page, so an answer
// looks the same wherever it is read.
export default function renderAiText(text, keyPrefix = "ai") {
  const lines = (text || "").split("\n");
  const blocks = [];
  let currentList = null;

  function flushList() {
    if (currentList) {
      blocks.push(
        <ul key={`${keyPrefix}-ul-${blocks.length}`} style={{ margin: "4px 0", paddingLeft: 18 }}>
          {currentList}
        </ul>
      );
      currentList = null;
    }
  }

  function formatInline(line, lineKey) {
    // Split out **bold** and *italic* segments. **bold** is checked first
    // in the alternation so a bold span never gets misread as two italics.
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter((p) => p !== "");
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`${lineKey}-${i}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 1) {
        return <em key={`${lineKey}-${i}`}>{part.slice(1, -1)}</em>;
      }
      return <span key={`${lineKey}-${i}`}>{part}</span>;
    });
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const lineKey = `${keyPrefix}-${i}`;
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (!currentList) currentList = [];
      currentList.push(<li key={`li-${lineKey}`}>{formatInline(trimmed.slice(2), lineKey)}</li>);
    } else {
      flushList();
      if (trimmed === "") {
        blocks.push(<div key={`sp-${lineKey}`} style={{ height: 6 }} />);
      } else {
        blocks.push(<div key={`p-${lineKey}`}>{formatInline(line, lineKey)}</div>);
      }
    }
  });
  flushList();
  return blocks;
}