import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient } from "abap-adt-api";
import { SAFE_OUTPUT_CHARS, shrinkToFit } from '../lib/responseSizing.js';

export class FeedHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'feeds',
                description: 'Retrieves a list of feeds.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'dumps',
                description: 'Retrieves a list of dumps. For a busy system with many dumps, use startIndex/maxItems to page through the dump list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'An optional query string to filter the dumps.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the dump to start from (default 0). Use with maxItems to page through a large dump list.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of dumps to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    }
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'feeds':
                return this.handleFeeds(args);
            case 'dumps':
                return this.handleDumps(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown feed tool: ${toolName}`);
        }
    }

    async handleFeeds(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const feeds = await this.adtclient.feeds();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            feeds
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get feeds: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleDumps(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            // Resolves to a DumpsFeed: { href, title, updated, dumps: Dump[] }.
            // The `dumps` array is the part that scales with system activity
            // (can be very many on a busy system) - page over it while keeping
            // the surrounding feed metadata (href/title/updated) intact.
            const dumpsFeed = await this.adtclient.dumps(args.query);
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', dumps: dumpsFeed });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const allDumps: any[] = Array.isArray(dumpsFeed?.dumps) ? dumpsFeed.dumps : [];
            const totalItems = allDumps.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalItems - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalItems);
                const pagedResult = { ...dumpsFeed, dumps: allDumps.slice(startIndex, endIndex) };
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
                `Failed to get dumps: ${error.message || 'Unknown error'}`
            );
        }
    }
}
