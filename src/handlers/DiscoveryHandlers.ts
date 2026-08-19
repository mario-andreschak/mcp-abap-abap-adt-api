import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { SAFE_OUTPUT_CHARS, shrinkToFit, hardTruncateJson } from '../lib/responseSizing.js';

export class DiscoveryHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'featureDetails',
                description: 'Retrieves details for a given feature.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'The title of the feature.'
                        }
                    },
                    required: ['title']
                }
            },
            {
                name: 'collectionFeatureDetails',
                description: 'Retrieves details for a given collection feature.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the collection feature.'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'findCollectionByUrl',
                description: 'Finds a collection by its URL.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the collection.'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'loadTypes',
                description: 'Loads object types.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'adtDiscovery',
                description: 'Performs ADT discovery. Returns a list of discovery collections. For large systems, use startIndex/maxItems to page through the list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the discovery entry to start from (default 0). Use with maxItems to page through a large discovery list.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of discovery entries to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    }
                }
            },
            {
                name: 'adtCoreDiscovery',
                description: 'Performs ADT core discovery. Returns a list of core discovery collections. For large systems, use startIndex/maxItems to page through the list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the core discovery entry to start from (default 0). Use with maxItems to page through a large list.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of core discovery entries to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    }
                }
            },
            {
                name: 'adtCompatibiliyGraph',
                description: 'Retrieves the ADT compatibility graph.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'featureDetails':
                return this.handleFeatureDetails(args);
            case 'collectionFeatureDetails':
                return this.handleCollectionFeatureDetails(args);
            case 'findCollectionByUrl':
                return this.handleFindCollectionByUrl(args);
            case 'loadTypes':
                return this.handleLoadTypes(args);
            case 'adtDiscovery':
                return this.handleAdtDiscovery(args);
            case 'adtCoreDiscovery':
                return this.handleAdtCoreDiscovery(args);
            case 'adtCompatibiliyGraph':
                return this.handleAdtCompatibilityGraph(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown discovery tool: ${toolName}`);
        }
    }

    async handleFeatureDetails(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const details = await this.adtclient.featureDetails(args.title);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            details
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get feature details: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleCollectionFeatureDetails(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const details = await this.adtclient.collectionFeatureDetails(args.url);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            details
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get collection feature details: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleFindCollectionByUrl(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const collection = await this.adtclient.findCollectionByUrl(args.url);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            collection
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to find collection by URL: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleLoadTypes(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const types = await this.adtclient.loadTypes();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            types
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to load types: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAdtDiscovery(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const discovery = await this.adtclient.adtDiscovery();
            this.trackRequest(startTime, true);
            return this.buildPagedArrayResponse(discovery, 'discovery', args);
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to perform ADT discovery: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAdtCoreDiscovery(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const discovery = await this.adtclient.adtCoreDiscovery();
            this.trackRequest(startTime, true);
            return this.buildPagedArrayResponse(discovery, 'discovery', args);
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to perform ADT core discovery: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAdtCompatibilityGraph(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const graph = await this.adtclient.adtCompatibiliyGraph();
            this.trackRequest(startTime, true);
            // The graph is a genuinely heterogeneous document (a `nodes` array
            // and a correlated `edges` array that references those nodes, both
            // scaling with system size) - there is no single clean array to
            // page over, so fall back to a hard character truncation as a
            // last-resort safety net. hardTruncateJson returns the untouched
            // JSON unchanged when it already fits under SAFE_OUTPUT_CHARS.
            const text = hardTruncateJson({
                status: 'success',
                graph
            });
            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get ADT compatibility graph: ${error.message || 'Unknown error'}`
            );
        }
    }

    // Shared paging for adtDiscovery/adtCoreDiscovery, both of which resolve
    // directly to a top-level array (AdtDiscoveryResult[] / AdtCoreDiscoveryResult[])
    // rather than an object wrapping one.
    private buildPagedArrayResponse(items: any[], fieldName: string, args: any): any {
        const allItems: any[] = Array.isArray(items) ? items : [];
        const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

        if (!requestedPaging) {
            const text = JSON.stringify({ status: 'success', [fieldName]: allItems });
            if (text.length <= SAFE_OUTPUT_CHARS) {
                return { content: [{ type: 'text', text }] };
            }
        }

        const totalItems = allItems.length;
        const startIndex = Math.max(0, Number(args.startIndex) || 0);
        const initialMaxItems = args.maxItems !== undefined
            ? Math.max(0, Number(args.maxItems))
            : totalItems - startIndex;

        const text = shrinkToFit(initialMaxItems, (count, capped) => {
            const endIndex = Math.min(startIndex + count, totalItems);
            const payload: any = {
                status: 'success',
                [fieldName]: allItems.slice(startIndex, endIndex),
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
    }
}
