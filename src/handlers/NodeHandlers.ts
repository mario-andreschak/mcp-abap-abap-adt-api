import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { NodeParents, NodeStructure } from "abap-adt-api";
import { SAFE_OUTPUT_CHARS, shrinkToFit } from '../lib/responseSizing.js';

export class NodeHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'nodeContents',
                description: 'Retrieves the contents of a node in the ABAP repository tree. For large packages/namespaces, use startIndex/maxItems to page through the node list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        parent_type: {
                            type: 'string',
                            description: 'The type of the parent node.'
                        },
                        parent_name: {
                            type: 'string',
                            description: 'The name of the parent node.',
                            optional: true
                        },
                        user_name: {
                            type: 'string',
                            description: 'The user name.',
                            optional: true
                        },
                        parent_tech_name: {
                            type: 'string',
                            description: 'The technical name of the parent node.',
                            optional: true
                        },
                        rebuild_tree: {
                            type: 'boolean',
                            description: 'Whether to rebuild the tree.',
                            optional: true
                        },
                        parentnodes: {
                            type: 'array',
                            description: 'An array of parent node IDs.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the node to start from (default 0). Use with maxItems to page through large node lists.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of nodes to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['parent_type']
                }
            },
            {
                name: 'mainPrograms',
                description: 'Retrieves the main programs for a given include.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeUrl: {
                            type: 'string',
                            description: 'The URL of the include.'
                        }
                    },
                    required: ['includeUrl']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'nodeContents':
                return this.handleNodeContents(args);
            case 'mainPrograms':
                return this.handleMainPrograms(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown node tool: ${toolName}`);
        }
    }

    async handleNodeContents(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const nodeContents: NodeStructure = await this.adtclient.nodeContents(
                args.parent_type,
                args.parent_name,
                args.user_name,
                args.parent_tech_name,
                args.rebuild_tree,
                args.parentnodes
            );
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            // Keep old behavior (unpaginated result, `nodeContents` field)
            // when it already fits and the caller didn't ask for paging.
            if (!requestedPaging) {
                const text = JSON.stringify({
                    status: 'success',
                    nodeContents
                });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const allNodes = Array.isArray(nodeContents?.nodes) ? nodeContents.nodes : [];
            const totalItems = allNodes.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalItems - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalItems);
                const paged = { ...nodeContents, nodes: allNodes.slice(startIndex, endIndex) };
                const payload: any = {
                    status: 'success',
                    result: paged,
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
                `Failed to get node contents: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleMainPrograms(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const mainPrograms = await this.adtclient.mainPrograms(args.includeUrl);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            mainPrograms
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get main programs: ${error.message || 'Unknown error'}`
            );
        }
    }
}
