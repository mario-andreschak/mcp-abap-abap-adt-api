import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { NodeParents, NodeStructure } from "abap-adt-api";

export class NodeHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'nodeContents',
                description: 'Retrieves the contents of a node in the ABAP repository tree.',
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
            const nodeContents = await this.adtclient.nodeContents(
                args.parent_type,
                args.parent_name,
                args.user_name,
                args.parent_tech_name,
                args.rebuild_tree,
                args.parentnodes
            );
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            nodeContents
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get node contents: ${this.formatAdtError(error)}`
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
                `Failed to get main programs: ${this.formatAdtError(error)}`
            );
        }
    }
}
