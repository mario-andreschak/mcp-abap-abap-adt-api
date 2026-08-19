import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler';
import type { ToolDefinition } from '../types/tools';
import { shrinkToFit, SAFE_OUTPUT_CHARS } from '../lib/responseSizing';

interface InactiveObject {
  "adtcore:uri": string;
  "adtcore:type": string;
  "adtcore:name": string;
  "adtcore:parentUri": string;
}

interface ActivationResultMessage {
  objDescr: string;
  type: string;
  line: number;
  href: string;
  forceSupported: boolean;
  shortText: string;
}

interface ActivationResult {
  success: boolean;
  messages: ActivationResultMessage[];
  inactive: InactiveObjectRecord[];
}

interface InactiveObjectElement extends InactiveObject {
  user: string;
  deleted: boolean;
}

interface InactiveObjectRecord {
  object?: InactiveObjectElement;
  transport?: InactiveObjectElement;
}

export class ObjectManagementHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'activateObjects',
        description: 'Activate ABAP objects using object references',
        inputSchema: {
          type: 'object',
          properties: {
            objects: { 
              type: 'string',
              description: 'JSON array of objects to activate. Each object must have adtcore:uri, adtcore:type, adtcore:name, and adtcore:parentUri properties'
            },
            preauditRequested: {
              type: 'boolean',
              description: 'Whether to perform pre-audit checks',
              optional: true
            }
          },
          required: ['objects']
        }
      },
      {
        name: 'activateByName',
        description: 'Activate an ABAP object using name and URL',
        inputSchema: {
          type: 'object',
          properties: {
            objectName: {
              type: 'string',
              description: 'Name of the object'
            },
            objectUrl: {
              type: 'string',
              description: 'URL of the object'
            },
            mainInclude: {
              type: 'string',
              description: 'Main include context',
              optional: true
            },
            preauditRequested: {
              type: 'boolean',
              description: 'Whether to perform pre-audit checks',
              optional: true
            }
          },
          required: ['objectName', 'objectUrl']
        }
      },
      {
        name: 'inactiveObjects',
        description: 'Get list of inactive objects. For systems with many inactive objects across users, use startIndex/maxItems to page through the list instead of retrieving it all at once.',
        inputSchema: {
          type: 'object',
          properties: {
            startIndex: {
              type: 'number',
              description: '0-based index of the inactive-object record to start from (default 0). Use with maxItems to page through a large list.',
              optional: true
            },
            maxItems: {
              type: 'number',
              description: 'Maximum number of inactive-object records to return from startIndex. Omit to return the rest.',
              optional: true
            }
          }
        }
      }
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'activateObjects':
        return this.handleActivateObjects(args);
      case 'activateByName':
        return this.handleActivateByName(args);
      case 'inactiveObjects':
        return this.handleInactiveObjects(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown object management tool: ${toolName}`);
    }
  }

  async handleActivateObjects(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      if (!args.objects || typeof args.objects !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, "objects parameter must be a JSON string");
      }

      let objects: InactiveObject[];
      try {
        objects = JSON.parse(args.objects);
        if (!Array.isArray(objects)) {
          throw new Error("Parsed objects must be an array");
        }
        
        // Validate each object has required properties
        objects.forEach((obj, index) => {
          if (!obj["adtcore:uri"] || !obj["adtcore:type"] || 
              !obj["adtcore:name"] || !obj["adtcore:parentUri"]) {
            throw new Error(`Object at index ${index} is missing required properties`);
          }
        });
      } catch (parseError: any) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid objects JSON: ${parseError.message}`
        );
      }

      const result = await this.adtclient.activate(objects, args.preauditRequested);
      this.trackRequest(startTime, true);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to activate objects: ${error.message || 'Unknown error'}`
      );
    }
  }

  async handleActivateByName(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      if (!args.objectName || !args.objectUrl) {
        throw new McpError(ErrorCode.InvalidParams, "objectName and objectUrl parameters are required");
      }

      const result = await this.adtclient.activate(
        args.objectName,
        args.objectUrl,
        args.mainInclude,
        args.preauditRequested
      );
      this.trackRequest(startTime, true);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result)
        }]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to activate object: ${error.message || 'Unknown error'}`
      );
    }
  }

  async handleInactiveObjects(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const result: InactiveObjectRecord[] = await this.adtclient.inactiveObjects();
      this.trackRequest(startTime, true);

      const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

      if (!requestedPaging) {
        const text = JSON.stringify(result);
        if (text.length <= SAFE_OUTPUT_CHARS) {
          return { content: [{ type: 'text', text }] };
        }
      }

      const totalObjects = result.length;
      const startIndex = Math.max(0, Number(args.startIndex) || 0);
      const initialMaxItems = args.maxItems !== undefined
        ? Math.max(0, Number(args.maxItems))
        : totalObjects - startIndex;

      const text = shrinkToFit(initialMaxItems, (count, capped) => {
        const endIndex = Math.min(startIndex + count, totalObjects);
        const payload: any = {
          status: 'success',
          result: result.slice(startIndex, endIndex),
          totalObjects,
          startIndex,
          returnedObjects: Math.max(0, endIndex - startIndex),
          hasMore: endIndex < totalObjects
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
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get inactive objects: ${error.message || 'Unknown error'}`
      );
    }
  }
}
