import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient, Range, ExtractMethodProposal, GenericRefactoring } from 'abap-adt-api';

export class RefactorHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'extractMethodEvaluate',
                description: 'Evaluates an extract method refactoring.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        uri: {
                            type: 'string',
                            description: 'The URI of the object.'
                        },
                        range: {
                            type: 'string',
                            description: 'The range to extract.'
                        }
                    },
                    required: ['uri', 'range']
                }
            },
            {
                name: 'extractMethodPreview',
                description: 'Previews an extract method refactoring.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        proposal: {
                            type: 'string',
                            description: 'The extract method proposal.'
                        }
                    },
                    required: ['proposal']
                }
            },
            {
                name: 'extractMethodExecute',
                description: 'Executes an extract method refactoring.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        refactoring: {
                            type: 'string',
                            description: 'The refactoring object.'
                        }
                    },
                    required: ['refactoring']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'extractMethodEvaluate':
                return this.handleExtractMethodEvaluate(args);
            case 'extractMethodPreview':
                return this.handleExtractMethodPreview(args);
            case 'extractMethodExecute':
                return this.handleExtractMethodExecute(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown refactor tool: ${toolName}`);
        }
    }

    async handleExtractMethodEvaluate(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const range = typeof args.range === 'string' ? JSON.parse(args.range) : args.range;
            const result = await this.adtclient.extractMethodEvaluate(args.uri, range);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to evaluate extract method: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleExtractMethodPreview(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const proposal = typeof args.proposal === 'string' ? JSON.parse(args.proposal) : args.proposal;
            const result = await this.adtclient.extractMethodPreview(proposal);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to preview extract method: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleExtractMethodExecute(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const refactoring = typeof args.refactoring === 'string' ? JSON.parse(args.refactoring) : args.refactoring;
            const result = await this.adtclient.extractMethodExecute(refactoring);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to execute extract method: ${error.message || 'Unknown error'}`
            );
        }
    }
}
