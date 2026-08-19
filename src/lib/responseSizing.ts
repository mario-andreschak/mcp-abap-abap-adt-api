// Hard cap (chars) on the JSON text actually handed back to the MCP host.
// The host's own limit is token-based and code/XML/JSON tokenizes less
// efficiently than prose (short keywords/punctuation, escaped newlines from
// JSON.stringify). Real-world failures have been observed even around
// 60-100k raw chars, so this is kept deliberately small with a wide safety
// margin rather than tuned to a measured cutoff (the host never reports the
// actual limit).
export const SAFE_OUTPUT_CHARS = 40_000;

/**
 * Iteratively shrinks a page size (line count, row count, item count, ...)
 * until `buildPayload(count, capped)` serializes under SAFE_OUTPUT_CHARS, or
 * count can't be reduced further (bottoms out at 1).
 *
 * This is applied UNCONDITIONALLY - even when the caller passed an explicit
 * page size larger than what fits - because honouring an oversized explicit
 * request blows past the host's limit just as badly as not paging an
 * oversized default. `buildPayload` should read `capped` to decide whether
 * to add a truncation note to the object it returns; on the first attempt
 * `capped` is false, so the payload is built without that note to measure
 * the unpadded size (the note's own ~150-200 chars are covered by the 0.9
 * safety factor below, so exact precision here doesn't matter).
 */
export function shrinkToFit(initialCount: number, buildPayload: (count: number, capped: boolean) => any): string {
    let count = Math.max(0, Math.floor(initialCount));
    let text = '';
    let capped = false;
    let lastPayload: any;

    for (let attempt = 0; attempt < 8; attempt++) {
        lastPayload = buildPayload(count, capped);
        text = JSON.stringify(lastPayload);
        if (text.length <= SAFE_OUTPUT_CHARS || count <= 1) {
            break;
        }
        capped = true;
        count = Math.max(1, Math.floor(count * (SAFE_OUTPUT_CHARS / text.length) * 0.9));
    }

    // Shrinking bottomed out at a single item (one line, one row, one
    // component, ...) and that single item is itself still larger than the
    // safe budget (e.g. a minified/no-newline source line, or a row with a
    // huge field value). There's nothing more structurally meaningful left
    // to slice, so fall back to a hard character-level cut of the whole
    // payload as a universal, shape-agnostic last resort.
    if (text.length > SAFE_OUTPUT_CHARS) {
        return hardTruncateJson(lastPayload);
    }

    return text;
}

/**
 * Last-resort hard character cut for payloads with no natural "count" to
 * shrink (a single large object/blob with no array to page through, e.g. a
 * discovery document). Prefer shrinkToFit whenever the data has any
 * array/list to page over - this loses structure and should only be used
 * when there's truly nothing else to slice.
 */
export function hardTruncateJson(payload: any): string {
    const text = JSON.stringify(payload);
    if (text.length <= SAFE_OUTPUT_CHARS) {
        return text;
    }
    const budget = Math.max(1000, SAFE_OUTPUT_CHARS - 500);
    return JSON.stringify({
        status: 'success',
        truncated: true,
        note: 'Result exceeded the safe response size and was hard-truncated mid-structure (no array field was available to page through cleanly). The JSON below is a character-level prefix and may not parse as valid JSON on its own - treat it as a raw text preview, or use a more specific/scoped query if possible.',
        totalChars: text.length,
        preview: text.slice(0, budget)
    });
}
