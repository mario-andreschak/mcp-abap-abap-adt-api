import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient } from "abap-adt-api";
import { SAFE_OUTPUT_CHARS, shrinkToFit } from '../lib/responseSizing.js';

export class PrettyPrinterHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'prettyPrinterSetting',
                description: 'Retrieves the pretty printer settings.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'setPrettyPrinterSetting',
                description: 'Sets the pretty printer settings.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        indent: {
                            type: 'boolean',
                            description: 'Whether to indent the code.'
                        },
                        style: {
                            type: 'string',
                            description: 'The pretty printer style.'
                        }
                    },
                    required: ['indent', 'style']
                }
            },
            {
                name: 'prettyPrinter',
                description: 'Formats ABAP code using the pretty printer. For large sources, use startLine/maxLines to page through the reformatted result instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        source: {
                            type: 'string',
                            description: 'The ABAP source code to format.'
                        },
                        startLine: {
                            type: 'number',
                            description: '1-based line number to start from (default 1). Use with maxLines to page through a large reformatted result.',
                            optional: true
                        },
                        maxLines: {
                            type: 'number',
                            description: 'Maximum number of lines to return from startLine. Omit to return the rest of the reformatted source.',
                            optional: true
                        }
                    },
                    required: ['source']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'prettyPrinterSetting':
                return this.handlePrettyPrinterSetting(args);
            case 'setPrettyPrinterSetting':
                return this.handleSetPrettyPrinterSetting(args);
            case 'prettyPrinter':
                return this.handlePrettyPrinter(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown pretty printer tool: ${toolName}`);
        }
    }

    async handlePrettyPrinterSetting(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const settings = await this.adtclient.prettyPrinterSetting();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            settings
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get pretty printer settings: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleSetPrettyPrinterSetting(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.setPrettyPrinterSetting(args.indent, args.style);
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
                `Failed to set pretty printer settings: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handlePrettyPrinter(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const fullSource = await this.adtclient.prettyPrinter(args.source);
            this.trackRequest(startTime, true);

            const lines = fullSource.split('\n');
            const totalLines = lines.length;
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

            const text = shrinkToFit(initialMaxLines, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalLines);
                const paged: any = {
                    status: 'success',
                    source: lines.slice(startIndex, endIndex).join('\n'),
                    totalLines,
                    startLine,
                    returnedLines: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalLines
                };
                if (!requestedPaging) {
                    paged.autoPaged = true;
                }
                if (capped) {
                    paged.capped = true;
                    paged.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxLines (or a later startLine) to continue.';
                }
                return paged;
            });

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
                `Failed to format ABAP code: ${error.message || 'Unknown error'}`
            );
        }
    }
}
