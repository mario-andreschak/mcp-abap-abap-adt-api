import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient } from 'abap-adt-api';

export class ClassHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'classIncludes',
                description: 'Get class includes structure',
                inputSchema: {
                    type: 'object',
                    properties: {
                        clas: {
                            type: 'string',
                            description: 'The class name'
                        }
                    },
                    required: ['clas']
                }
            },
            {
                name: 'classComponents',
                description: 'List class components',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the class'
                        }
                    },
                    required: ['url']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'classIncludes':
                return this.handleClassIncludes(args);
            case 'classComponents':
                return this.handleClassComponents(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown class tool: ${toolName}`);
        }
    }

    async handleClassIncludes(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await ADTClient.classIncludes(args.clas);
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
                `Failed to get class includes: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleClassComponents(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.classComponents(args.url);
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
                `Failed to get class components: ${error.message || 'Unknown error'}`
            );
        }
    }

}
