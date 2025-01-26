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
          properties: { clas: { type: 'string' } },
          required: ['clas']
        }
      },
      {
        name: 'classComponents',
        description: 'List class components',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url']
        }
      },
      {
        name: 'createTestInclude',
        description: 'Create test include for class',
        inputSchema: {
          type: 'object',
          properties: { 
            clas: { type: 'string' },
            lockHandle: { type: 'string' },
            transport: { type: 'string' }
          },
          required: ['clas', 'lockHandle']
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
      case 'createTestInclude':
        return this.handleCreateTestInclude(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown class tool: ${toolName}`);
    }
  }

  async handleClassIncludes(args: any): Promise<any> {
    const result = await ADTClient.classIncludes(args.clas);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    };
  }

  async handleClassComponents(args: any): Promise<any> {
    const result = await this.adtclient.classComponents(args.url);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    };
  }

  async handleCreateTestInclude(args: any): Promise<any> {
    const result = await this.adtclient.createTestInclude(args.clas, args.lockHandle, args.transport);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    };
  }
}
