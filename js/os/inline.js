// The two inline marks the dialogue uses, **bold** and [label](href), parsed
// into segments; and those segments cut into words for streaming. Pure.
// Nesting (a link inside bold) is deliberately not supported.

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else out.push({ kind: "link", text: m[2], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

// Each token keeps the whitespace around it, so writing the tokens one after
// another rebuilds the paragraph exactly.
export function wordTokens(segments) {
  const tokens = [];
  segments.forEach((s, seg) => {
    for (const w of s.text.match(/\s*\S+\s*|\s+/g) ?? []) tokens.push({ seg, text: w });
  });
  return tokens;
}
