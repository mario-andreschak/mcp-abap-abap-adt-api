import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';

export class DiscoveryHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'featureDetails',
                description: 'Retrieves details for a given feature.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: {
                            type: 'string',
                            description: 'The title of the feature.'
                        }
                    },
                    required: ['title']
                }
            },
            {
                name: 'collectionFeatureDetails',
                description: 'Retrieves details for a given collection feature.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the collection feature.'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'findCollectionByUrl',
                description: 'Finds a collection by its URL.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the collection.'
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'loadTypes',
                description: 'Loads object types.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'adtDiscovery',
                description: 'Performs ADT discovery.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'adtCoreDiscovery',
                description: 'Performs ADT core discovery.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'adtCompatibiliyGraph',
                description: 'Retrieves the ADT compatibility graph.',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'featureDetails':
                return this.handleFeatureDetails(args);
            case 'collectionFeatureDetails':
                return this.handleCollectionFeatureDetails(args);
            case 'findCollectionByUrl':
                return this.handleFindCollectionByUrl(args);
            case 'loadTypes':
                return this.handleLoadTypes(args);
            case 'adtDiscovery':
                return this.handleAdtDiscovery(args);
            case 'adtCoreDiscovery':
                return this.handleAdtCoreDiscovery(args);
            case 'adtCompatibiliyGraph':
                return this.handleAdtCompatibilityGraph(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown discovery tool: ${toolName}`);
        }
    }

    async handleFeatureDetails(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const details = await this.adtclient.featureDetails(args.title);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            details
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get feature details: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleCollectionFeatureDetails(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const details = await this.adtclient.collectionFeatureDetails(args.url);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            details
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get collection feature details: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleFindCollectionByUrl(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const collection = await this.adtclient.findCollectionByUrl(args.url);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            collection
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to find collection by URL: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleLoadTypes(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const types = await this.adtclient.loadTypes();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            types
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to load types: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleAdtDiscovery(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const discovery = await this.adtclient.adtDiscovery();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            discovery
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to perform ADT discovery: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleAdtCoreDiscovery(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const discovery = await this.adtclient.adtCoreDiscovery();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            discovery
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to perform ADT core discovery: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleAdtCompatibilityGraph(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const graph = await this.adtclient.adtCompatibiliyGraph();
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            graph
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get ADT compatibility graph: ${this.formatAdtError(error)}`
            );
        }
    }
}
