import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler';
import type { ToolDefinition } from '../types/tools';
import { session_types } from 'abap-adt-api';

export class ObjectSourceHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'getObjectSource',
        description: 'Retrieves source code for ABAP objects',
        inputSchema: {
          type: 'object',
          properties: {
            objectSourceUrl: { type: 'string' },
            options: { type: 'string' }
          },
          required: ['objectSourceUrl']
        }
      },
      {
        name: 'setObjectSource',
        description: 'Sets source code for ABAP objects',
        inputSchema: {
          type: 'object',
          properties: {
            objectSourceUrl: { type: 'string' },
            source: { type: 'string' },
            lockHandle: { type: 'string' },
            transport: { type: 'string' }
          },
          required: ['objectSourceUrl', 'source', 'lockHandle']
        }
      }
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'getObjectSource':
        return this.handleGetObjectSource(args);
      case 'setObjectSource':
        return this.handleSetObjectSource(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown object source tool: ${toolName}`);
    }
  }

  async handleGetObjectSource(args: any): Promise<any> {
    
    const startTime = performance.now();
    try {
      const source = await this.adtclient.getObjectSource(args.objectSourceUrl, args.options);
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              source
            })
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get object source: ${error.message || 'Unknown error'}`
      );
    }
  }

  async handleSetObjectSource(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // Library auto-resets stateful=stateless on dropSession/logout. Restore here
      // so write operations get the correct X-sap-adt-sessiontype header.
      this.adtclient.stateful = session_types.stateful;
      await this.adtclient.setObjectSource(
        args.objectSourceUrl,
        args.source,
        args.lockHandle,
        args.transport
      );
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              updated: true
            })
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to set object source: ${error.message || 'Unknown error'}`
      );
    }
  }
}
