import { stringify } from "../lib/results.js";
import { McpError, ErrorCode } from "../lib/errors.js";
import { BaseHandler } from "./BaseHandler.js";
import type { ToolDefinition } from "../types/tools.js";
import { session_types } from "abap-adt-api";
import fs from "fs";
import path from "path";

export class ObjectSourceHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: "getObjectSource",
        description:
          "Retrieves source code for ABAP objects. For large objects, use startLine/maxLines to page through the source instead of retrieving it all at once.",
        inputSchema: {
          type: "object",
          properties: {
            objectSourceUrl: { type: "string" },
            options: { type: "string" },
            startLine: {
              type: "number",
              description:
                "1-based line number to start from (default 1). Use with maxLines to page through large sources.",
              optional: true,
            },
            maxLines: {
              type: "number",
              description:
                "Maximum number of lines to return from startLine. Omit to return the rest of the source.",
              optional: true,
            },
          },
          required: ["objectSourceUrl"],
        },
      },
      {
        name: "setObjectSource",
        description:
          "Sets source code for ABAP objects. Pass source inline, or filePath to read the source from a local file (for large files - bypasses context).",
        inputSchema: {
          type: "object",
          properties: {
            objectSourceUrl: { type: "string" },
            source: {
              type: "string",
              description: "Source code to set (inline). Mutually exclusive with filePath.",
              optional: true,
            },
            filePath: {
              type: "string",
              description:
                "Local file path to read source from (for large files - bypasses context). Mutually exclusive with source.",
              optional: true,
            },
            lockHandle: { type: "string" },
            transport: { type: "string" },
          },
          required: ["objectSourceUrl", "lockHandle"],
        },
      },
      {
        name: "downloadObjectSource",
        description:
          "Downloads ABAP source code to a local file to avoid context overflow",
        inputSchema: {
          type: "object",
          properties: {
            objectSourceUrl: { type: "string" },
            filePath: { type: "string" },
            options: { type: "string" },
          },
          required: ["objectSourceUrl", "filePath"],
        },
      },
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "getObjectSource":
        return this.handleGetObjectSource(args);
      case "downloadObjectSource":
        return this.handleDownloadObjectSource(args);
      case "setObjectSource":
        return this.handleSetObjectSource(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown object source tool: ${toolName}`,
        );
    }
  }

  async handleDownloadObjectSource(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const fullSource = await this.adtclient.getObjectSource(
        args.objectSourceUrl,
        args.options,
      );
      const dir = path.dirname(args.filePath);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(args.filePath, fullSource, "utf8");
      this.trackRequest(startTime, true);
      const totalLines = fullSource.split("\n").length;
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              savedTo: args.filePath,
              totalLines,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleGetObjectSource(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      const fullSource = await this.adtclient.getObjectSource(
        args.objectSourceUrl,
        args.options,
      );
      // Remember the source so a later syntaxCheckCode on the same URL can reuse
      // it without the caller re-sending it (issue #2).
      this.sourceCache.set(args.objectSourceUrl, fullSource);
      this.trackRequest(startTime, true);

      const lines = fullSource.split("\n");
      const totalLines = lines.length;

      // Optional pagination for large sources (issue #4). When neither
      // parameter is provided, behaviour is unchanged: the whole source is returned.
      const hasPaging =
        args.startLine !== undefined || args.maxLines !== undefined;
      const startLine = Math.max(1, Number(args.startLine) || 1);
      const startIndex = startLine - 1;
      const endIndex =
        args.maxLines !== undefined
          ? startIndex + Math.max(0, Number(args.maxLines))
          : totalLines;
      const source = hasPaging
        ? lines.slice(startIndex, endIndex).join("\n")
        : fullSource;
      const returnedLines = hasPaging
        ? Math.min(endIndex, totalLines) - startIndex
        : totalLines;

      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              source,
              totalLines,
              startLine: hasPaging ? startLine : 1,
              returnedLines: Math.max(0, returnedLines),
              hasMore: hasPaging ? endIndex < totalLines : false,
            }),
          },
        ],
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw error;
    }
  }

  async handleSetObjectSource(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // Exactly one of source (inline) or filePath (local file) must be provided.
      if (!args.source && !args.filePath) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Either source or filePath must be provided",
        );
      }
      if (args.source && args.filePath) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Cannot use both source and filePath. Use one or the other.",
        );
      }

      let sourceContent = args.source;
      if (args.filePath) {
        try {
          sourceContent = fs.readFileSync(args.filePath, "utf-8");
        } catch (err: any) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Failed to read file ${args.filePath}: ${err.message}`,
          );
        }
        this.logger.info("Source loaded from file", {
          filePath: args.filePath,
        });
      }

      // dropSession/logout reset the client to stateless; writing source requires a stateful session
      this.adtclient.stateful = session_types.stateful;
      await this.adtclient.setObjectSource(
        args.objectSourceUrl,
        sourceContent,
        args.lockHandle,
        args.transport,
      );
      // Cache the just-written source so a follow-up syntaxCheckCode can reuse it
      // without the caller re-sending it (issue #2).
      this.sourceCache.set(args.objectSourceUrl, sourceContent);
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: "text",
            text: stringify({
              status: "success",
              updated: true,
              sourceLoadedFrom: args.filePath
                ? `File: ${args.filePath}`
                : "Context (direct source)",
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
