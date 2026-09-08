// abap-adt-api wraps SAP's <exc:exception> error XML into AdtErrorException,
// exposing the real SAP message via `.message` and any extra detail via
// `.properties`. But its own fromError()/fromResponse() parsing (see
// node_modules/abap-adt-api/build/AdtException.js) silently swallows parse
// failures and falls back to the raw axios error, whose `.message` is just
// "Request failed with status code NNN" with no SAP-side detail. When that
// happens the raw HTTP response body (still attached deeper in the error
// chain) usually still contains the exc:exception XML, so we re-parse it
// ourselves as a fallback.
const GENERIC_HTTP_MESSAGE = /^Request failed with status code \d+$/i;

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function findRawExceptionXml(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  const queue: unknown[] = [error];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    const c = current as Record<string, unknown>;
    const body = asNonEmptyString(c.body) ?? asNonEmptyString(c.data);
    if (body && /<[\w.]*:?exception[\s>]/i.test(body)) return body;
    if (c.response) queue.push(c.response);
    if (c.parent) queue.push(c.parent);
    if (c.cause) queue.push(c.cause);
  }
  return undefined;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseSapExceptionXml(xml: string): { message?: string; properties: Record<string, string> } {
  const properties: Record<string, string> = {};
  const entryPattern = /<[\w.]*:?entry\s+[^>]*key="([^"]*)"[^>]*>([\s\S]*?)<\/[\w.]*:?entry>/gi;
  let entryMatch: RegExpExecArray | null;
  while ((entryMatch = entryPattern.exec(xml))) {
    const value = decodeXmlEntities(entryMatch[2].trim());
    if (value) properties[entryMatch[1]] = value;
  }
  const messageMatch = xml.match(/<[\w.]*:?message\b[^>]*>([\s\S]*?)<\/[\w.]*:?message>/i);
  const message = messageMatch ? decodeXmlEntities(messageMatch[1].trim()) : undefined;
  return { message, properties };
}

/**
 * Builds a detailed error string for a caught abap-adt-api error, including
 * the real SAP-side message and any structured `properties` detail, instead
 * of the bare "Request failed with status code NNN" that surfaces when only
 * `error.message` is used.
 */
export function formatAdtError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return asNonEmptyString(error) ?? 'Unknown error';
  }
  const err = error as Record<string, unknown>;

  let message = asNonEmptyString(err.message) ?? 'Unknown error';
  let properties = (err.properties && typeof err.properties === 'object')
    ? (err.properties as Record<string, string>)
    : undefined;

  if (!properties || GENERIC_HTTP_MESSAGE.test(message)) {
    const rawXml = findRawExceptionXml(err);
    if (rawXml) {
      const parsed = parseSapExceptionXml(rawXml);
      if (parsed.message) message = parsed.message;
      if (Object.keys(parsed.properties).length) properties = parsed.properties;
    }
  }

  const parts = [message];
  const type = asNonEmptyString(err.type);
  if (type) parts.push(`type: ${type}`);
  const namespace = asNonEmptyString(err.namespace);
  if (namespace) parts.push(`namespace: ${namespace}`);
  if (properties && Object.keys(properties).length) {
    const propertyText = Object.entries(properties).map(([key, value]) => `${key}: ${value}`).join(', ');
    parts.push(`details: [${propertyText}]`);
  }
  return parts.join(' | ');
}
