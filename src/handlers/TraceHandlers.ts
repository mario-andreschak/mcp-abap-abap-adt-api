import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient, TraceStatementOptions, TraceParameters, TracesCreationConfig } from 'abap-adt-api';

export class TraceHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'tracesList',
                description: 'Retrieves a list of traces.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        user: {
                            type: 'string',
                            description: 'The user.',
                            optional: true
                        }
                    }
                }
            },
            {
                name: 'tracesListRequests',
                description: 'Retrieves a list of trace requests.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        user: {
                            type: 'string',
                            description: 'The user.',
                            optional: true
                        }
                    }
                }
            },
            {
                name: 'tracesHitList',
                description: 'Retrieves the hit list for a trace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'The ID of the trace.'
                        },
                        withSystemEvents: {
                            type: 'boolean',
                            description: 'Whether to include system events.',
                            optional: true
                        }
                    },
                    required: ['id']
                }
            },
            {
                name: 'tracesDbAccess',
                description: 'Retrieves database access information for a trace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'The ID of the trace.'
                        },
                        withSystemEvents: {
                            type: 'boolean',
                            description: 'Whether to include system events.',
                            optional: true
                        }
                    },
                    required: ['id']
                }
            },
            {
                name: 'tracesStatements',
                description: 'Retrieves statements for a trace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'The ID of the trace.'
                        },
                        options: {
                            type: 'string',
                            description: 'Options for retrieving statements.',
                            optional: true
                        }
                    },
                    required: ['id']
                }
            },
            {
                name: 'tracesSetParameters',
                description: 'Sets trace parameters.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        parameters: {
                            type: 'string',
                            description: 'The trace parameters.'
                        }
                    },
                    required: ['parameters']
                }
            },
            {
                name: 'tracesCreateConfiguration',
                description: 'Creates a trace configuration.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        config: {
                            type: 'string',
                            description: 'The trace configuration.'
                        }
                    },
                    required: ['config']
                }
            },
            {
                name: 'tracesDeleteConfiguration',
                description: 'Deletes a trace configuration.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'The ID of the trace configuration.'
                        }
                    },
                    required: ['id']
                }
            },
            {
                name: 'tracesDelete',
                description: 'Deletes a trace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'The ID of the trace.'
                        }
                    },
                    required: ['id']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'tracesList':
                return this.handleTracesList(args);
            case 'tracesListRequests':
                return this.handleTracesListRequests(args);
            case 'tracesHitList':
                return this.handleTracesHitList(args);
            case 'tracesDbAccess':
                return this.handleTracesDbAccess(args);
            case 'tracesStatements':
                return this.handleTracesStatements(args);
            case 'tracesSetParameters':
                return this.handleTracesSetParameters(args);
            case 'tracesCreateConfiguration':
                return this.handleTracesCreateConfiguration(args);
            case 'tracesDeleteConfiguration':
                return this.handleTracesDeleteConfiguration(args);
            case 'tracesDelete':
                return this.handleTracesDelete(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown trace tool: ${toolName}`);
        }
    }

    async handleTracesList(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const traces = await this.adtclient.tracesList(args.user);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            traces
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get traces list: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesListRequests(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const requests = await this.adtclient.tracesListRequests(args.user);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            requests
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get trace requests: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesHitList(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const hitList = await this.adtclient.tracesHitList(args.id, args.withSystemEvents);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            hitList
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get trace hit list: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesDbAccess(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const dbAccess = await this.adtclient.tracesDbAccess(args.id, args.withSystemEvents);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            dbAccess
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get trace DB access: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesStatements(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const statements = await this.adtclient.tracesStatements(args.id, args.options);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            statements
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get trace statements: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesSetParameters(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.tracesSetParameters(args.parameters);
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
                `Failed to set trace parameters: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesCreateConfiguration(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.tracesCreateConfiguration(args.config);
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
                `Failed to create trace configuration: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesDeleteConfiguration(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.tracesDeleteConfiguration(args.id);
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
                `Failed to delete trace configuration: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleTracesDelete(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.tracesDelete(args.id);
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
                `Failed to delete trace: ${this.formatAdtError(error)}`
            );
        }
    }
}
