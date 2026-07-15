/**
 * In-memory cache of ABAP object source, keyed by object source URL.
 *
 * A stdio MCP server serves a single client for the lifetime of the process,
 * so a simple module-level Map is a safe place to remember the source that was
 * last read (getObjectSource) or written (setObjectSource). This lets
 * syntaxCheckCode reuse that source instead of forcing the model to re-send the
 * whole file on every check (issue #2).
 */
const cache = new Map<string, string>();

export const sourceCache = {
  set(url: string, source: string): void {
    if (typeof url === 'string' && url.length > 0 && typeof source === 'string') {
      cache.set(url, source);
    }
  },
  get(url: string): string | undefined {
    return cache.get(url);
  },
  has(url: string): boolean {
    return cache.has(url);
  },
  delete(url: string): void {
    cache.delete(url);
  },
  clear(): void {
    cache.clear();
  }
};
