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
                            description: 'The range to extract, as a JSON string, e.g. {"start":{"line":1,"column":0},"end":{"line":5,"column":10}}'
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
                            description: 'The extract method proposal returned by extractMethodEvaluate, as a JSON string.'
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
                            description: 'The refactoring returned by extractMethodPreview, as a JSON string.'
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

    // Schemas declare these params as JSON strings, but the abap-adt-api methods
    // expect deserialized objects; also accept plain objects for forward compatibility
    private parseObjectArg<T>(value: unknown, name: string): T {
        if (typeof value !== 'string') return value as T;
        try {
            return JSON.parse(value) as T;
        } catch {
            throw new McpError(ErrorCode.InvalidParams, `Parameter '${name}' is not valid JSON`);
        }
    }

    async handleExtractMethodEvaluate(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const range = this.parseObjectArg<Range>(args.range, 'range');
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
            const proposal = this.parseObjectArg<ExtractMethodProposal>(args.proposal, 'proposal');
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
            const refactoring = this.parseObjectArg<GenericRefactoring>(args.refactoring, 'refactoring');
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
