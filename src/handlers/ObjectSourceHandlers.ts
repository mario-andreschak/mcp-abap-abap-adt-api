import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler';
import type { ToolDefinition } from '../types/tools';
import { session_types } from "abap-adt-api";
import { sourceCache } from '../lib/sourceCache';
import { SAFE_OUTPUT_CHARS, shrinkToFit } from '../lib/responseSizing';

function buildPagedSourcePayload(lines: string[], totalLines: number, startLine: number, initialMaxLines: number, requestedPaging: boolean): string {
  const startIndex = startLine - 1;
  return shrinkToFit(initialMaxLines, (count, capped) => {
    const endIndex = Math.min(startIndex + count, totalLines);
    const payload: any = {
      status: 'success',
      source: lines.slice(startIndex, endIndex).join('\n'),
      totalLines,
      startLine,
      returnedLines: Math.max(0, endIndex - startIndex),
      hasMore: endIndex < totalLines
    };
    if (!requestedPaging) {
      payload.autoPaged = true;
    }
    if (capped) {
      payload.capped = true;
      payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxLines (or a later startLine) to continue.';
    }
    return payload;
  });
}

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
        name: 'setObjectSource',
        description: 'Sets source code for ABAP objects. For a targeted change to a large object, prefer editObjectSource instead of resending the full source.',
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
      },
      {
        name: 'editObjectSource',
        description: 'Applies a targeted line-range edit to an ABAP object without sending the full source. Always re-fetches the current source from SAP first (so the edit is guaranteed to apply on top of the latest remote version), replaces lines [startLine, endLine] (inclusive, 1-based) with newText, and writes the result back. To insert without deleting anything, set endLine = startLine - 1. Pass expectedText (the exact current content of that line range, joined with \\n) to fail fast instead of silently overwriting if the object changed since you last read it.',
        inputSchema: {
          type: 'object',
          properties: {
            objectSourceUrl: { type: 'string' },
            startLine: {
              type: 'number',
              description: '1-based first line to replace (inclusive).'
            },
            endLine: {
              type: 'number',
              description: '1-based last line to replace (inclusive). Use startLine - 1 to insert without replacing any existing line.'
            },
            newText: {
              type: 'string',
              description: 'Replacement text for the given line range (use \\n for multiple lines). Use an empty string to delete the range.'
            },
            expectedText: {
              type: 'string',
              description: 'Optional safety check: exact current text of lines [startLine, endLine] joined with \\n. If it does not match what SAP currently has, the edit is rejected instead of applied.',
              optional: true
            },
            lockHandle: { type: 'string' },
            transport: { type: 'string', optional: true }
          },
          required: ['objectSourceUrl', 'startLine', 'endLine', 'newText', 'lockHandle']
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
      case 'editObjectSource':
        return this.handleEditObjectSource(args);
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

      // Optional pagination for large sources (issue #4). When the caller
      // didn't ask for paging but the source is large enough to risk
      // exceeding the host's tool-output limit, page automatically instead
      // of returning everything and having the host discard it.
      const requestedPaging = args.startLine !== undefined || args.maxLines !== undefined;

      if (!requestedPaging && fullSource.length <= SAFE_OUTPUT_CHARS) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'success',
                source: fullSource,
                totalLines,
                startLine: 1,
                returnedLines: totalLines,
                hasMore: false
              })
            }
          ]
        };
      }

      const startLine = Math.max(1, Number(args.startLine) || 1);
      const startIndex = startLine - 1;
      const initialMaxLines = args.maxLines !== undefined
        ? Math.max(0, Number(args.maxLines))
        : totalLines - startIndex;

      const text = buildPagedSourcePayload(lines, totalLines, startLine, initialMaxLines, requestedPaging);

      return {
        content: [
          {
            type: 'text',
            text
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
      // dropSession/logout reset the client to stateless; writing source requires a stateful session
      this.adtclient.stateful = session_types.stateful;
      await this.adtclient.setObjectSource(
        args.objectSourceUrl,
        args.source,
        args.lockHandle,
        args.transport
      );
      // Cache the just-written source so a follow-up syntaxCheckCode can reuse it
      // without the caller re-sending it (issue #2).
      sourceCache.set(args.objectSourceUrl, args.source);
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

  async handleEditObjectSource(args: any): Promise<any> {
    const startTime = performance.now();
    try {
      // Always re-fetch from SAP (never from sourceCache) so the edit is
      // guaranteed to be based on the current remote version, not a stale
      // local copy from earlier in the conversation.
      const fullSource = await this.adtclient.getObjectSource(args.objectSourceUrl);
      const lines = fullSource.split('\n');
      const totalLines = lines.length;

      const startLine = Number(args.startLine);
      const endLine = Number(args.endLine);

      if (!Number.isInteger(startLine) || startLine < 1) {
        throw new McpError(ErrorCode.InvalidParams, `startLine must be a positive integer, got ${args.startLine}`);
      }
      if (!Number.isInteger(endLine) || endLine < startLine - 1) {
        throw new McpError(ErrorCode.InvalidParams, `endLine must be an integer >= startLine - 1, got ${args.endLine}`);
      }
      if (startLine > totalLines + 1) {
        throw new McpError(ErrorCode.InvalidParams, `startLine ${startLine} is beyond the end of the source (${totalLines} lines)`);
      }

      const startIndex = startLine - 1;
      const endIndex = Math.min(endLine, totalLines);

      if (args.expectedText !== undefined) {
        const actualText = lines.slice(startIndex, endIndex).join('\n');
        if (actualText !== args.expectedText) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `expectedText did not match the current content of lines ${startLine}-${endLine} on SAP. The object may have changed since you last read it. Actual content:\n${actualText}`
          );
        }
      }

      const newLines = args.newText.length === 0 ? [] : String(args.newText).split('\n');
      lines.splice(startIndex, endIndex - startIndex, ...newLines);
      const newSource = lines.join('\n');

      this.adtclient.stateful = session_types.stateful;
      await this.adtclient.setObjectSource(
        args.objectSourceUrl,
        newSource,
        args.lockHandle,
        args.transport
      );
      sourceCache.set(args.objectSourceUrl, newSource);
      this.trackRequest(startTime, true);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              updated: true,
              totalLinesBefore: totalLines,
              totalLinesAfter: lines.length,
              linesReplaced: endIndex - startIndex,
              linesInserted: newLines.length
            })
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to edit object source: ${error.message || 'Unknown error'}`
      );
    }
  }
}
