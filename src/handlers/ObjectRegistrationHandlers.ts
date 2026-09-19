import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";

export class ObjectRegistrationHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "objectRegistrationInfo",
        description: "Get registration information for an ABAP object",
        inputSchema: {
          type: "object",
          properties: {
            objectUrl: { type: "string" },
          },
          required: ["objectUrl"],
        },
      },
      {
        name: "validateNewObject",
        description:
          "Validate parameters for a new ABAP object. Supports different object types: programs (PROG/P), classes (CLAS/OC), interfaces (INTF/OI), function groups (FUGR/F), function modules (FUGR/FF), packages (DEVC/K), service bindings (SRVB/SVB), etc.",
        inputSchema: {
          type: "object",
          properties: {
            objtype: {
              type: "string",
              description:
                "Object type (e.g., PROG/P for program, CLAS/OC for class, DEVC/K for package, SRVB/SVB for service binding)",
            },
            objname: {
              type: "string",
              description: "Object name",
            },
            description: {
              type: "string",
              description: "Object description",
            },
            packagename: {
              type: "string",
              description:
                "Package name (for PROG/P, CLAS/OC, INTF/OI, etc.)",
            },
            fugrname: {
              type: "string",
              description: "Function group name (for FUGR/FF, FUGR/I)",
            },
            swcomp: {
              type: "string",
              description: "Software component (for DEVC/K)",
            },
            transportLayer: {
              type: "string",
              description: "Transport layer (for DEVC/K)",
            },
            packagetype: {
              type: "string",
              description:
                "Package type: development, structure, or main (for DEVC/K)",
            },
            serviceBindingVersion: {
              type: "string",
              description:
                "Service binding version, e.g., ODATA\\V2 (for SRVB/SVB)",
            },
            serviceDefinition: {
              type: "string",
              description: "Service definition name (for SRVB/SVB)",
            },
            package: {
              type: "string",
              description: "Package name (for SRVB/SVB)",
            },
          },
          required: ["objtype", "objname", "description"],
        },
      },
      {
        name: "createObject",
        description: "Create a new ABAP object",
        inputSchema: {
          type: "object",
          properties: {
            objtype: { type: "string" },
            name: { type: "string" },
            parentName: { type: "string" },
            description: { type: "string" },
            parentPath: { type: "string" },
            responsible: { type: "string", optional: true },
            transport: { type: "string", optional: true },
            language: {
              type: "string",
              optional: true,
              description:
                "Language code for the object (e.g., ZH for Chinese); needed in non-English systems where the server default would otherwise fail object creation",
            },
            masterLanguage: {
              type: "string",
              optional: true,
              description: "Master language code for the object",
            },
            masterSystem: {
              type: "string",
              optional: true,
              description: "Master system ID for the object",
            },
          },
          required: [
            "objtype",
            "name",
            "parentName",
            "description",
            "parentPath",
          ],
        },
      },
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "objectRegistrationInfo":
        return this.handleObjectRegistrationInfo(args);
      case "validateNewObject":
        return this.handleValidateNewObject(args);
      case "createObject":
        return this.handleCreateObject(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown object registration tool: ${toolName}`,
        );
    }
  }

  async handleObjectRegistrationInfo(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const info = await this.adtclient.objectRegistrationInfo(args.objectUrl);
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              info,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleValidateNewObject(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // Structured args double as the client's ValidateOptions; the client
      // picks the validation variant from objtype.
      const result = await this.adtclient.validateNewObject(args);
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              result,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleCreateObject(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // Options-object overload: language settings are required on
      // non-English systems; without them object creation can fail server
      // side and leave a stale lock record.
      const result = await this.adtclient.createObject({
        objtype: args.objtype,
        name: args.name,
        parentName: args.parentName,
        description: args.description,
        parentPath: args.parentPath,
        responsible: args.responsible,
        transport: args.transport,
        language: args.language,
        masterLanguage: args.masterLanguage,
        masterSystem: args.masterSystem,
      });
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              result,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }
}
