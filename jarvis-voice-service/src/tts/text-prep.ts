/**
 * Text preparation for TTS — strips markdown, expands abbreviations,
 * splits into sentences for parallel synthesis.
 */

const ABBREVIATIONS: Record<string, string> = {
  'API': 'A P I',
  'SSL': 'S S L',
  'TLS': 'T L S',
  'HTTP': 'H T T P',
  'HTTPS': 'H T T P S',
  'URL': 'U R L',
  'CPU': 'C P U',
  'GPU': 'G P U',
  'RAM': 'ram',
  'DNS': 'D N S',
  'SSH': 'S S H',
  'CLI': 'C L I',
  'GUI': 'G U I',
  'JSON': 'jason',
  'YAML': 'yammel',
  'SQL': 'sequel',
  'HTML': 'H T M L',
  'CSS': 'C S S',
  'UI': 'U I',
  'UX': 'U X',
  'IP': 'I P',
  'TCP': 'T C P',
  'UDP': 'U D P',
  'OS': 'O S',
  'VM': 'V M',
  'AWS': 'A W S',
  'GCP': 'G C P',
  'CI': 'C I',
  'CD': 'C D',
  'PR': 'P R',
  'ACDT': 'A C D T',
  'UTC': 'U T C',
  'AEST': 'A E S T',
};

// Titles and abbreviations that end with a period but are NOT sentence boundaries
const NON_SENTENCE_ABBREVS = new Set([
  'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Jr.', 'Sr.', 'Prof.', 'Rev.',
  'Gen.', 'Gov.', 'Sgt.', 'Cpl.', 'Lt.', 'Capt.', 'Maj.', 'Col.',
  'Inc.', 'Ltd.', 'Corp.', 'Co.', 'vs.', 'etc.', 'approx.',
  'St.', 'Ave.', 'Blvd.', 'Dept.', 'Div.', 'Est.', 'Fig.',
  'e.g.', 'i.e.', 'a.m.', 'p.m.',
]);

export function stripMarkdown(text: string): string {
  let result = text;
  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/`([^`]+)`/g, '$1');
  // Remove bold/italic
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/\*([^*]+)\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  result = result.replace(/_([^_]+)_/g, '$1');
  // Remove headers
  result = result.replace(/^#{1,6}\s+/gm, '');
  // Remove links, keep text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Remove images
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  // Remove bullet points / list markers
  result = result.replace(/^[\s]*[-*+]\s+/gm, '');
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');
  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}$/gm, '');
  // Remove blockquotes
  result = result.replace(/^>\s*/gm, '');
  // Em-dashes to commas (natural pause)
  result = result.replace(/—/g, ', ');
  result = result.replace(/–/g, ', ');
  // Remove emoji
  result = result.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  // Collapse whitespace
  result = result.replace(/\n+/g, ' ');
  result = result.replace(/\s+/g, ' ');
  return result.trim();
}

// Pre-compiled regex patterns (created once at module load, not per call)
const ABBREV_PATTERNS = Object.entries(ABBREVIATIONS).map(
  ([abbr, expansion]) => ({ regex: new RegExp(`\\b${abbr}\\b`, 'g'), expansion })
);

export function expandAbbreviations(text: string): string {
  let result = text;
  for (const { regex, expansion } of ABBREV_PATTERNS) {
    result = result.replace(regex, expansion);
  }
  return result;
}

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';

  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    current += (current ? ' ' : '') + word;

    // Check if this word ends a sentence
    if (/[.!?]$/.test(word)) {
      // Check if it's a non-sentence abbreviation
      if (NON_SENTENCE_ABBREVS.has(word)) {
        continue;
      }
      // Check if it looks like a decimal number (e.g., "3.14")
      if (/^\d+\.\d*$/.test(word)) {
        continue;
      }
      // Check if it's an abbreviation like "U.S." (alternating letter-dot)
      if (/^([A-Z]\.){2,}$/.test(word)) {
        continue;
      }
      // It's a sentence boundary
      const trimmed = current.trim();
      if (trimmed) sentences.push(trimmed);
      current = '';
    }
  }

  // Remaining text
  const trimmed = current.trim();
  if (trimmed) sentences.push(trimmed);

  return sentences;
}

export function prepareForTTS(text: string): string[] {
  const cleaned = stripMarkdown(text);
  const expanded = expandAbbreviations(cleaned);
  return splitSentences(expanded);
}
