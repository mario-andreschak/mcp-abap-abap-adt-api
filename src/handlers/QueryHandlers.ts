import { ADTClient } from 'abap-adt-api';
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { SAFE_OUTPUT_CHARS, shrinkToFit } from '../lib/responseSizing.js';

// SAP-side cap on rows requested from the ADT service itself (tableContents/
// runQuery `rowNumber` param). Independent from the JSON-output-size
// safeguard below: even with a modest row count, wide/large-cell rows can
// still blow past SAFE_OUTPUT_CHARS, so both caps are needed. Applied only
// when the caller omits rowNumber - an explicit rowNumber is still honoured
// SAP-side (the output-size shrink loop below is the backstop for that case).
const DEFAULT_ROW_NUMBER = 100;

export class QueryHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'tableContents',
                description: `Retrieves the contents of an ABAP table. rowNumber caps how many rows are requested from SAP itself (default ${DEFAULT_ROW_NUMBER} if omitted). For large results, use startRow/maxRows to page through the returned rows instead of retrieving them all at once.`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        ddicEntityName: {
                            type: 'string',
                            description: 'The name of the DDIC entity (table or view).'
                        },
                        rowNumber: {
                            type: 'number',
                            description: `The maximum number of rows to retrieve from SAP. Defaults to ${DEFAULT_ROW_NUMBER} if omitted.`,
                            optional: true
                        },
                        decode: {
                            type: 'boolean',
                            description: 'Whether to decode the data.',
                            optional: true
                        },
                        sqlQuery: {
                            type: 'string',
                            description: 'An optional SQL query to filter the data.',
                            optional: true
                        },
                        startRow: {
                            type: 'number',
                            description: '0-based index of the returned row to start from (default 0). Use with maxRows to page through a large result set.',
                            optional: true
                        },
                        maxRows: {
                            type: 'number',
                            description: 'Maximum number of rows to return from startRow. Omit to return the rest of the retrieved rows.',
                            optional: true
                        }
                    },
                    required: ['ddicEntityName']
                }
            },
            {
                name: 'runQuery',
                description: `Runs a SQL query on the target system. rowNumber caps how many rows are requested from SAP itself (default ${DEFAULT_ROW_NUMBER} if omitted). For large results, use startRow/maxRows to page through the returned rows instead of retrieving them all at once.`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        sqlQuery: {
                            type: 'string',
                            description: 'The SQL query to execute.'
                        },
                        rowNumber: {
                            type: 'number',
                            description: `The maximum number of rows to retrieve from SAP. Defaults to ${DEFAULT_ROW_NUMBER} if omitted.`,
                            optional: true
                        },
                        decode: {
                            type: 'boolean',
                            description: 'Whether to decode the data.',
                            optional: true
                        },
                        startRow: {
                            type: 'number',
                            description: '0-based index of the returned row to start from (default 0). Use with maxRows to page through a large result set.',
                            optional: true
                        },
                        maxRows: {
                            type: 'number',
                            description: 'Maximum number of rows to return from startRow. Omit to return the rest of the retrieved rows.',
                            optional: true
                        }
                    },
                    required: ['sqlQuery']
                }
            }
        ];
    }

    async handle(toolName: string, arguments_: any): Promise<any> {
        switch (toolName) {
            case 'tableContents':
                return this.handleTableContents(arguments_);
            case 'runQuery':
                return this.handleRunQuery(arguments_);
            default:
                throw new Error(`Tool ${toolName} not implemented in QueryHandlers`);
        }
    }

    async handleTableContents(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const rowNumber = args.rowNumber !== undefined ? args.rowNumber : DEFAULT_ROW_NUMBER;
            const result = await this.adtclient.tableContents(
                args.ddicEntityName,
                rowNumber,
                args.decode,
                args.sqlQuery
            );
            this.trackRequest(startTime, true);
            return this.buildQueryResultResponse(result, args);
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new Error(`Failed to retrieve table contents: ${error.message || 'Unknown error'}`);
        }
    }

    async handleRunQuery(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const rowNumber = args.rowNumber !== undefined ? args.rowNumber : DEFAULT_ROW_NUMBER;
            const result = await this.adtclient.runQuery(
                args.sqlQuery,
                rowNumber,
                args.decode
            );
            this.trackRequest(startTime, true);
            return this.buildQueryResultResponse(result, args);
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new Error(`Failed to run query: ${error.message || 'Unknown error'}`);
        }
    }

    // Shared response shaping for tableContents/runQuery, which both return a
    // QueryResult ({ columns, values }). `values` is the row array that can
    // grow large enough (row count x wide/large cells) to blow past the
    // host's tool-output limit even when the SAP-side rowNumber cap is
    // reasonable, so it gets the same paginate-then-shrink treatment as
    // ObjectSourceHandlers' source lines / ClassHandlers' components.
    private buildQueryResultResponse(result: any, args: any): any {
        const allValues: any[] = Array.isArray(result?.values) ? result.values : [];
        const totalRows = allValues.length;
        const requestedPaging = args.startRow !== undefined || args.maxRows !== undefined;

        if (!requestedPaging) {
            const text = JSON.stringify({ status: 'success', result });
            if (text.length <= SAFE_OUTPUT_CHARS) {
                return { content: [{ type: 'text', text }] };
            }
        }

        const startRow = Math.max(0, Number(args.startRow) || 0);
        const initialMaxRows = args.maxRows !== undefined
            ? Math.max(0, Number(args.maxRows))
            : totalRows - startRow;

        const text = shrinkToFit(initialMaxRows, (count, capped) => {
            const endRow = Math.min(startRow + count, totalRows);
            const pagedResult = { ...result, values: allValues.slice(startRow, endRow) };
            const payload: any = {
                status: 'success',
                result: pagedResult,
                totalRows,
                startRow,
                returnedRows: Math.max(0, endRow - startRow),
                hasMore: endRow < totalRows
            };
            if (!requestedPaging) {
                payload.autoPaged = true;
            }
            if (capped) {
                payload.capped = true;
                payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxRows (or a later startRow) to continue.';
            }
            return payload;
        });

        return { content: [{ type: 'text', text }] };
    }
}
