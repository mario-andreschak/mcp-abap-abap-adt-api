import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler';
import type { ToolDefinition } from '../types/tools';
import { performance } from 'perf_hooks';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { session_types } from "abap-adt-api";
import { sourceCache } from '../lib/sourceCache';

export class ObjectSourceHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'getObjectSource',
        description: 'Retrieves source code for ABAP objects. For large objects, use startLine/maxLines to page through the source instead of retrieving it all at once.',
        inputSchema: {
          type: 'object',
          properties: {
            objectSourceUrl: { type: 'string' },
            options: { type: 'string' },
            startLine: {
              type: 'number',
              description: '1-based line number to start from (default 1). Use with maxLines to page through large sources.',
              optional: true
            },
            maxLines: {
              type: 'number',
              description: 'Maximum number of lines to return from startLine. Omit to return the rest of the source.',
              optional: true
            }
          },
          required: ['objectSourceUrl']
        }
      },
      {
        name: 'downloadObjectSource',
        description: 'Downloads ABAP source code to a local file to avoid context overflow',
        inputSchema: {
          type: 'object',
          properties: {
            objectSourceUrl: {
              type: 'string',
              description: 'The object source URL (e.g., /sap/bc/adt/oo/classes/zcl_example/source/main)'
            },
            filePath: {
              type: 'string',
              description: 'Local file path to save source to'
            },
            options: {
              type: 'string',
              description: 'Optional query parameters'
            }
          },
          required: ['objectSourceUrl', 'filePath']
        }
      },
      {
        name: 'setObjectSource',
        description: 'Sets source code for ABAP objects. Use filePath for large files to avoid context overflow.',
        inputSchema: {
          type: 'object',
          properties: {
            objectSourceUrl: {
              type: 'string',
              description: 'The object source URL (e.g., /sap/bc/adt/oo/classes/zcl_example/source/main)'
            },
            source: {
              type: 'string',
              description: 'Source code content (for small files - will be included in context)'
            },
            filePath: {
              type: 'string',
              description: 'Local file path to read source from (for large files - bypasses context)'
            },
            lockHandle: {
              type: 'string',
              description: 'Lock handle obtained from lock operation'
            },
            transport: {
              type: 'string',
              description: 'Transport request number (optional)'
            }
          },
          required: ['objectSourceUrl', 'lockHandle']
        }
      }
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'getObjectSource':
        return this.handleGetObjectSource(args);
      case 'downloadObjectSource':
        return this.handleDownloadObjectSource(args);
      case 'setObjectSource':
        return this.handleSetObjectSource(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown object source tool: ${toolName}`);
    }
  }

  async handleGetObjectSource(args: any): Promise<any> {
    
    const startTime = performance.now();
    try {
      const fullSource = await this.adtclient.getObjectSource(args.objectSourceUrl, args.options);
      // Remember the source so a later syntaxCheckCode on the same URL can reuse
      // it without the caller re-sending it (issue #2).
      sourceCache.set(args.objectSourceUrl, fullSource);
      this.trackRequest(startTime, true);

      const lines = fullSource.split('\n');
      const totalLines = lines.length;

      // Optional pagination for large sources (issue #4). When neither
      // parameter is provided, behaviour is unchanged: the whole source is returned.
      const hasPaging = args.startLine !== undefined || args.maxLines !== undefined;
      const startLine = Math.max(1, Number(args.startLine) || 1);
      const startIndex = startLine - 1;
      const endIndex = args.maxLines !== undefined
        ? startIndex + Math.max(0, Number(args.maxLines))
        : totalLines;
      const source = hasPaging ? lines.slice(startIndex, endIndex).join('\n') : fullSource;
      const returnedLines = hasPaging ? Math.min(endIndex, totalLines) - startIndex : totalLines;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              source,
              totalLines,
              startLine: hasPaging ? startLine : 1,
              returnedLines: Math.max(0, returnedLines),
              hasMore: hasPaging ? endIndex < totalLines : false
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

  async handleDownloadObjectSource(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // Get source from SAP
      const source = await this.adtclient.getObjectSource(args.objectSourceUrl, args.options);
      // Remember the source so a later syntaxCheckCode on the same URL can reuse
      // it without the caller re-sending it (issue #2).
      sourceCache.set(args.objectSourceUrl, source);

      // Ensure directory exists
      const dir = dirname(args.filePath);
      try {
        await mkdir(dir, { recursive: true });
      } catch (err: any) {
        // Ignore error if directory already exists
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }

      // Write to file
      await writeFile(args.filePath, source, 'utf-8');

      // Calculate stats
      const lines = source.split('\n').length;
      const size = Buffer.byteLength(source, 'utf-8');

      this.trackRequest(startTime, true);
      this.logger.info('Source downloaded to file', { filePath: args.filePath, lines, size });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              savedTo: args.filePath,
              lines,
              size
            })
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to download object source: ${error.message || 'Unknown error'}`
      );
    }
  }

  async handleSetObjectSource(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // Validate that either source or filePath is provided
      if (!args.source && !args.filePath) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Either source or filePath must be provided'
        );
      }

      // Validate that not both are provided
      if (args.source && args.filePath) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Cannot use both source and filePath. Use one or the other.'
        );
      }

      let sourceContent: string;

      if (args.filePath) {
        // Read from file (for large files - bypasses context)
        try {
          sourceContent = await readFile(args.filePath, 'utf-8');
          this.logger.info('Source loaded from file', { filePath: args.filePath });
        } catch (err: any) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Failed to read file ${args.filePath}: ${err.message}`
          );
        }
      } else {
        // Use provided source (for small files - from context)
        sourceContent = args.source;
      }

      // dropSession/logout reset the client to stateless; writing source requires a stateful session
      this.adtclient.stateful = session_types.stateful;
      await this.adtclient.setObjectSource(
        args.objectSourceUrl,
        sourceContent,
        args.lockHandle,
        args.transport
      );
      // Cache the just-written source so a follow-up syntaxCheckCode can reuse it
      // without the caller re-sending it (issue #2).
      sourceCache.set(args.objectSourceUrl, sourceContent);
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              updated: true,
              sourceLoadedFrom: args.filePath ? `File: ${args.filePath}` : 'Context (direct source)'
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
