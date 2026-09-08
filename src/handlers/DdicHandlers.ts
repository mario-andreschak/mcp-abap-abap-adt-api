import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient, PackageValueHelpType } from 'abap-adt-api';
import { SAFE_OUTPUT_CHARS, shrinkToFit, hardTruncateJson } from '../lib/responseSizing.js';

export class DdicHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'annotationDefinitions',
                description: 'Retrieves the CDS annotation catalog for the system. This can be large; use startIndex/maxItems to page through it instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the first entry to return (default 0). Only applies when the result contains a pageable list. Use with maxItems to page through a large catalog.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of entries to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    }
                }
            },
            {
                name: 'ddicElement',
                description: 'Retrieves information about a DDIC element. For complex objects the child element list (fields/associations/secondary objects) can be large; use startIndex/maxItems to page through it instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'The path to the DDIC element.'
                        },
                        getTargetForAssociation: {
                            type: 'boolean',
                            description: 'Whether to get the target for association.',
                            optional: true
                        },
                        getExtensionViews: {
                            type: 'boolean',
                            description: 'Whether to get extension views.',
                            optional: true
                        },
                        getSecondaryObjects: {
                            type: 'boolean',
                            description: 'Whether to get secondary objects.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the first child element to return (default 0). Use with maxItems to page through a large children list.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of child elements to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['path']
                }
            },
            {
                name: 'ddicRepositoryAccess',
                description: 'Accesses the DDIC repository. This can return a large list of object references; use startIndex/maxItems to page through it instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'The path to the DDIC element.'
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the first reference to return (default 0). Use with maxItems to page through a large result set.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of references to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['path']
                }
            },
            {
                name: 'packageSearchHelp',
                description: 'Performs a package search help.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        type: {
                            type: 'string',
                            description: 'The package value help type.'
                        },
                        name: {
                            type: 'string',
                            description: 'The package name.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the first result to return (default 0). Use with maxResults to page through a large result set.',
                            optional: true
                        },
                        maxResults: {
                            type: 'number',
                            description: 'Maximum number of results to return from startIndex. Omit to return the rest (still subject to the safe response size backstop).',
                            optional: true
                        }
                    },
                    required: ['type']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'annotationDefinitions':
                return this.handleAnnotationDefinitions(args);
            case 'ddicElement':
                return this.handleDdicElement(args);
            case 'ddicRepositoryAccess':
                return this.handleDdicRepositoryAccess(args);
            case 'packageSearchHelp':
                return this.handlePackageSearchHelp(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown DDIC tool: ${toolName}`);
        }
    }

    async handleAnnotationDefinitions(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            // The library types this as Promise<string>, but the underlying XML
            // is parsed to an object before being returned, so the actual shape
            // observed at runtime can be a nested object (or array) rather than a
            // literal string. Handle defensively: page over a top-level array if
            // one is found, otherwise fall back to a hard character truncation.
            const result: any = await this.adtclient.annotationDefinitions();
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const arrayField: string | undefined = Array.isArray(result)
                ? undefined
                : (result && typeof result === 'object'
                    ? Object.keys(result).find(k => Array.isArray(result[k]))
                    : undefined);
            const items: any[] | undefined = Array.isArray(result)
                ? result
                : (arrayField ? result[arrayField] : undefined);

            if (!items) {
                // No pageable list found (e.g. a plain string/object) - last
                // resort hard character cut.
                const text = hardTruncateJson({ status: 'success', result });
                return { content: [{ type: 'text', text }] };
            }

            const totalItems = items.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalItems - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalItems);
                const pagedItems = items.slice(startIndex, endIndex);
                const pagedResult = Array.isArray(result) ? pagedItems : { ...result, [arrayField as string]: pagedItems };
                const payload: any = {
                    status: 'success',
                    result: pagedResult,
                    totalItems,
                    startIndex,
                    returnedItems: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalItems
                };
                if (!requestedPaging) {
                    payload.autoPaged = true;
                }
                if (capped) {
                    payload.capped = true;
                    payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxItems (or a later startIndex) to continue.';
                }
                return payload;
            });

            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get annotation definitions: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleDdicElement(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.ddicElement(
                args.path,
                args.getTargetForAssociation,
                args.getExtensionViews,
                args.getSecondaryObjects
            );
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            // `children` is the top-level array that scales with object
            // complexity (fields/associations/secondary objects merged in by
            // getTargetForAssociation/getExtensionViews/getSecondaryObjects).
            const allChildren: any[] = Array.isArray(result?.children) ? result.children : [];
            const totalItems = allChildren.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalItems - startIndex;

            let text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalItems);
                const payload: any = {
                    status: 'success',
                    result: { ...result, children: allChildren.slice(startIndex, endIndex) },
                    totalItems,
                    startIndex,
                    returnedItems: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalItems
                };
                if (!requestedPaging) {
                    payload.autoPaged = true;
                }
                if (capped) {
                    payload.capped = true;
                    payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxItems (or a later startIndex) to continue.';
                }
                return payload;
            });

            // Defense-in-depth: if even a single child (or the element itself
            // with no children) is too large to fit, fall back to a hard
            // character cut instead of returning an oversized payload.
            if (text.length > SAFE_OUTPUT_CHARS) {
                text = hardTruncateJson({ status: 'success', result });
            }

            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get DDIC element: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleDdicRepositoryAccess(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.ddicRepositoryAccess(args.path);
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const totalItems = result.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalItems - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalItems);
                const payload: any = {
                    status: 'success',
                    result: result.slice(startIndex, endIndex),
                    totalItems,
                    startIndex,
                    returnedItems: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalItems
                };
                if (!requestedPaging) {
                    payload.autoPaged = true;
                }
                if (capped) {
                    payload.capped = true;
                    payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxItems (or a later startIndex) to continue.';
                }
                return payload;
            });

            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to access DDIC repository: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handlePackageSearchHelp(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            // this.adtclient.packageSearchHelp() has no max/limit parameter in
            // the underlying library, so maxResults/startIndex are applied
            // client-side here; shrinkToFit is still applied unconditionally as
            // a hard backstop regardless of whether paging args were given.
            const result = await this.adtclient.packageSearchHelp(args.type, args.name);
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxResults !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const totalItems = result.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxResults !== undefined
                ? Math.max(0, Number(args.maxResults))
                : totalItems - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalItems);
                const payload: any = {
                    status: 'success',
                    result: result.slice(startIndex, endIndex),
                    totalItems,
                    startIndex,
                    returnedItems: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalItems
                };
                if (!requestedPaging) {
                    payload.autoPaged = true;
                }
                if (capped) {
                    payload.capped = true;
                    payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxResults (or a later startIndex) to continue.';
                }
                return payload;
            });

            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get package search help: ${error.message || 'Unknown error'}`
            );
        }
    }
}
