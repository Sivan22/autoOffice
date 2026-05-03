/**
 * Extract a JSON string field's value from a possibly-truncated JSON document.
 *
 * Used to read the streamed `code` argument of a tool call before the full
 * JSON has arrived. Returns the decoded string so far, or null if the field
 * hasn't started yet. Tolerates truncation mid-string and mid-escape.
 */
export function extractPartialStringField(json: string, field: string): string | null {
  const keyPattern = new RegExp(`"${field}"\\s*:\\s*"`);
  const match = json.match(keyPattern);
  if (!match) return null;

  let i = match.index! + match[0].length;
  let out = '';

  while (i < json.length) {
    const c = json[i];
    if (c === '"') return out;
    if (c !== '\\') {
      out += c;
      i++;
      continue;
    }
    if (i + 1 >= json.length) return out;
    const esc = json[i + 1];
    switch (esc) {
      case 'n': out += '\n'; i += 2; break;
      case 't': out += '\t'; i += 2; break;
      case 'r': out += '\r'; i += 2; break;
      case '"': out += '"'; i += 2; break;
      case '\\': out += '\\'; i += 2; break;
      case '/': out += '/'; i += 2; break;
      case 'b': out += '\b'; i += 2; break;
      case 'f': out += '\f'; i += 2; break;
      case 'u': {
        if (i + 6 > json.length) return out;
        const hex = json.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return out;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 6;
        break;
      }
      default:
        out += esc;
        i += 2;
        break;
    }
  }
  return out;
}
