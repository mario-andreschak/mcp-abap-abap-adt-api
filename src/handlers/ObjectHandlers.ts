import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient } from "abap-adt-api";
import { SAFE_OUTPUT_CHARS, shrinkToFit, hardTruncateJson } from '../lib/responseSizing.js';

// SAP link/xml:base metadata is verbose and rarely needed for a structural
// overview of an object - strip it (at any nesting level) before sizing.
function stripVerboseFields(node: any): any {
    if (Array.isArray(node)) {
        return node.map(stripVerboseFields);
    }
    if (!node || typeof node !== 'object') {
        return node;
    }
    const { links, 'xml:base': _xmlBase, ...rest } = node;
    const result: any = {};
    for (const key of Object.keys(rest)) {
        result[key] = stripVerboseFields(rest[key]);
    }
    return result;
}

// objectStructure can return very different shapes depending on object type
// (AbapSimpleStructure vs AbapClassStructure, see abap-adt-api's
// objectstructure.d.ts). Only some shapes (e.g. a class's `includes` list)
// have a top-level array that scales with object complexity and can be
// paged; find it generically rather than hard-coding one field name.
function findPageableArrayField(obj: any): string | undefined {
    if (!obj || typeof obj !== 'object') {
        return undefined;
    }
    if (Array.isArray(obj.includes)) {
        return 'includes';
    }
    for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
            return key;
        }
    }
    return undefined;
}

export class ObjectHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'objectStructure',
                description: 'Get object structure details. For large/complex objects (e.g. classes with many includes), use startIndex/maxItems to page through the structure\'s top-level array instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectUrl: {
                            type: 'string',
                            description: 'URL of the object'
                        },
                        version: {
                            type: 'string',
                            description: 'Version of the object',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the top-level array item (e.g. class includes) to start from (default 0). Only applies when the structure has a pageable array; ignored otherwise.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of top-level array items to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['objectUrl']
                }
            },
            {
                name: 'searchObject',
                description: 'Search for objects',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query string'
                        },
                        objType: {
                            type: 'string',
                            description: 'Object type filter',
                            optional: true
                        },
                        max: {
                            type: 'number',
                            description: 'Maximum number of results',
                            optional: true
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'findObjectPath',
                description: 'Find path for an object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        objectUrl: {
                            type: 'string',
                            description: 'URL of the object to find path for'
                        }
                    },
                    required: ['objectUrl']
                }
            },
            {
                name: 'objectTypes',
                description: 'Retrieves object types.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'reentranceTicket',
                description: 'Retrieves a reentrance ticket.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'objectStructure':
                return this.handleObjectStructure(args);
            case 'findObjectPath':
                return this.handleFindObjectPath(args);
            case 'searchObject':
                return this.handleSearchObject(args);
            case 'objectTypes':
                return this.handleObjectTypes(args);
            case 'reentranceTicket':
                return this.handleReentranceTicket(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown object tool: ${toolName}`);
        }
    }

    async handleObjectStructure(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const structure = await this.adtclient.objectStructure(args.objectUrl, args.version);
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            // Keep old behavior (unpaginated, unstripped result) when it
            // already fits and the caller didn't ask for paging.
            if (!requestedPaging) {
                const text = JSON.stringify({
                    status: 'success',
                    structure,
                    message: 'Object structure retrieved successfully'
                }, null, 2);
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            // Too large (or paging explicitly requested): strip verbose link
            // metadata first, then page the top-level array if there is one.
            const lean = stripVerboseFields(structure);
            const fieldName = findPageableArrayField(lean);

            if (!fieldName) {
                // No natural array to page over (e.g. a simple program/CDS
                // structure with just objectUrl/metaData) - hard truncate.
                const text = hardTruncateJson({
                    status: 'success',
                    structure: lean,
                    message: 'Object structure retrieved successfully'
                });
                return { content: [{ type: 'text', text }] };
            }

            const items: any[] = lean[fieldName];
            const totalItems = items.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalItems - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalItems);
                const paged = { ...lean, [fieldName]: items.slice(startIndex, endIndex) };
                const payload: any = {
                    status: 'success',
                    structure: paged,
                    message: 'Object structure retrieved successfully',
                    pagedField: fieldName,
                    totalItems,
                    startIndex,
                    returnedItems: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalItems
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
            const errorMessage = error.message || 'Unknown error';
            const detailedError = error.response?.data?.message || errorMessage;
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get object structure: ${detailedError}`
            );
        }
    }

    async handleFindObjectPath(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const path = await this.adtclient.findObjectPath(args.objectUrl);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            path,
                            message: 'Object path found successfully'
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
                `Failed to find object path: ${detailedError}`
            );
        }
    }

    async handleSearchObject(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const results = await this.adtclient.searchObject(
                args.query,
                args.objType,
                args.max
            );
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            results,
                            message: 'Object search completed successfully'
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
                `Failed to search objects: ${detailedError}`
            );
        }
    }

    async handleObjectTypes(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const types = await this.adtclient.objectTypes();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            types,
                            message: 'Object types retrieved successfully'
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
                `Failed to get object types: ${detailedError}`
            );
        }
    }

    async handleReentranceTicket(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const ticket = await this.adtclient.reentranceTicket();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            ticket,
                            message: 'Reentrance ticket retrieved successfully'
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
                `Failed to get reentrance ticket: ${detailedError}`
            );
        }
    }
}
