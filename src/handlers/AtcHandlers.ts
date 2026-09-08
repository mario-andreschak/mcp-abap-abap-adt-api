import { ADTClient } from 'abap-adt-api';
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { AtcProposal } from 'abap-adt-api';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { shrinkToFit, SAFE_OUTPUT_CHARS } from '../lib/responseSizing.js';

export class AtcHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'atcCustomizing',
                description: 'Retrieves ATC customizing information.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'atcCheckVariant',
                description: 'Retrieves information about an ATC check variant.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        variant: {
                            type: 'string',
                            description: 'The name of the ATC check variant.'
                        }
                    },
                    required: ['variant']
                }
            },
            {
                name: 'createAtcRun',
                description: 'Creates an ATC run.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        variant: {
                            type: 'string',
                            description: 'The name of the ATC check variant.'
                        },
                        mainUrl: {
                            type: 'string',
                            description: 'The main URL for the ATC run.'
                        },
                        maxResults: {
                            type: 'number',
                            description: 'The maximum number of results to retrieve.',
                            optional: true
                        }
                    },
                    required: ['variant', 'mainUrl']
                }
            },
            {
                name: 'atcWorklists',
                description: 'Retrieves ATC worklists. For runs covering many objects, use startIndex/maxItems to page through the findings-per-object list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        runResultId: {
                            type: 'string',
                            description: 'The ID of the ATC run result.'
                        },
                        timestamp: {
                            type: 'number',
                            description: 'The timestamp.',
                            optional: true
                        },
                        usedObjectSet: {
                            type: 'string',
                            description: 'The used object set.',
                            optional: true
                        },
                        includeExempted: {
                            type: 'boolean',
                            description: 'Whether to include exempted findings.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the object (with its findings) to start from (default 0). Use with maxItems to page through large worklists.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of objects (each with its findings) to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['runResultId']
                }
            },
            {
                name: 'atcUsers',
                description: 'Retrieves a list of ATC users.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'atcExemptProposal',
                description: 'Retrieves an ATC exemption proposal.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        markerId: {
                            type: 'string',
                            description: 'The ID of the marker.'
                        }
                    },
                    required: ['markerId']
                }
            },
            {
                name: 'atcRequestExemption',
                description: 'Requests an ATC exemption.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        proposal: {
                            type: 'object',
                            description: 'The ATC exemption proposal.'
                        }
                    },
                    required: ['proposal']
                }
            },
            {
                name: 'isProposalMessage',
                description: 'Checks if a given object is a proposal message.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        proposal: {
                            type: 'object',
                            description: 'The ATC exemption proposal.'
                        }
                    },
                    required: ['proposal']
                }
            },
            {
                name: 'atcContactUri',
                description: 'Retrieves the contact URI for an ATC finding.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        findingUri: {
                            type: 'string',
                            description: 'The URI of the ATC finding.'
                        }
                    },
                    required: ['findingUri']
                }
            },
            {
                name: 'atcChangeContact',
                description: 'Changes the contact for an ATC finding.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        itemUri: {
                            type: 'string',
                            description: 'The URI of the item.'
                        },
                        userId: {
                            type: 'string',
                            description: 'The ID of the user.'
                        }
                    },
                    required: ['itemUri', 'userId']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'atcCustomizing':
                return this.handleAtcCustomizing(args);
            case 'atcCheckVariant':
                return this.handleAtcCheckVariant(args);
            case 'createAtcRun':
                return this.handleCreateAtcRun(args);
            case 'atcWorklists':
                return this.handleAtcWorklists(args);
            case 'atcUsers':
                return this.handleAtcUsers(args);
            case 'atcExemptProposal':
                return this.handleAtcExemptProposal(args);
            case 'atcRequestExemption':
                return this.handleAtcRequestExemption(args);
            case 'isProposalMessage':
                return this.handleIsProposalMessage(args);
            case 'atcContactUri':
                return this.handleAtcContactUri(args);
            case 'atcChangeContact':
                return this.handleAtcChangeContact(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown ATC tool: ${toolName}`);
        }
    }

    async handleAtcCustomizing(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcCustomizing();
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
                `Failed to get ATC customizing: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAtcCheckVariant(args: { variant: string }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcCheckVariant(args.variant);
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
                `Failed to get ATC check variant: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleCreateAtcRun(args: { variant: string, mainUrl: string, maxResults?: number }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.createAtcRun(args.variant, args.mainUrl, args.maxResults);
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
                `Failed to create ATC run: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAtcWorklists(args: { runResultId: string, timestamp?: number, usedObjectSet?: string, includeExempted?: boolean, startIndex?: number, maxItems?: number }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcWorklists(args.runResultId, args.timestamp || 0, args.usedObjectSet || "", args.includeExempted);
            this.trackRequest(startTime, true);

            const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const allObjects: any[] = Array.isArray(result.objects) ? result.objects : [];
            const totalObjects = allObjects.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxItems = args.maxItems !== undefined
                ? Math.max(0, Number(args.maxItems))
                : totalObjects - startIndex;

            const text = shrinkToFit(initialMaxItems, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalObjects);
                const paged = { ...result, objects: allObjects.slice(startIndex, endIndex) };
                const payload: any = {
                    status: 'success',
                    result: paged,
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
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get ATC worklists: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAtcUsers(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcUsers();
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
                `Failed to get ATC users: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAtcExemptProposal(args: { markerId: string }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcExemptProposal(args.markerId);
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
                `Failed to get ATC exempt proposal: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAtcRequestExemption(args: { proposal: AtcProposal }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcRequestExemption(args.proposal);
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
                `Failed to request ATC exemption: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleIsProposalMessage(args: { proposal: AtcProposal }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.isProposalMessage(args.proposal);
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
                `Failed to check if proposal message: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAtcContactUri(args: { findingUri: string }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcContactUri(args.findingUri);
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
                `Failed to get ATC contact URI: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleAtcChangeContact(args: { itemUri: string, userId: string }): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.atcChangeContact(args.itemUri, args.userId);
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
                `Failed to change ATC contact: ${error.message || 'Unknown error'}`
            );
        }
    }
}
