import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient, session_types } from "abap-adt-api";

export class ObjectDeletionHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'deleteObject',
        description: 'Deletes an ABAP object from the system',
        inputSchema: {
          type: 'object',
          properties: {
            objectUrl: { 
              type: 'string',
              description: 'URL of the object to delete'
            },
            lockHandle: { 
              type: 'string',
              description: 'Lock handle for the object'
            },
            transport: { 
              type: 'string',
              description: 'Transport request number',
              optional: true
            }
          },
          required: ['objectUrl', 'lockHandle']
        }
      }
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'deleteObject':
        return this.handleDeleteObject(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown object deletion tool: ${toolName}`);
    }
  }

  async handleDeleteObject(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      this.adtclient.stateful = session_types.stateful;
      const result = await this.adtclient.deleteObject(
        args.objectUrl,
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
              result,
              message: 'Object deleted successfully'
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      const errorMessage = error.message || 'Unknown error';
      const detailedError = error.response?.data?.message || errorMessage;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete object: ${detailedError}`
      );
    }
  }
}
