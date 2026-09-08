import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient, isClassStructure } from 'abap-adt-api';
import { SAFE_OUTPUT_CHARS, shrinkToFit } from '../lib/responseSizing.js';

// SAP link/xml:base metadata is verbose and rarely needed for a structural
// overview of a class - strip it before sizing/serializing the response.
function stripVerboseFields(node: any): any {
    if (!node || typeof node !== 'object') {
        return node;
    }
    const { links, 'xml:base': _xmlBase, components, ...rest } = node;
    return {
        ...rest,
        ...(Array.isArray(components) ? { components: components.map(stripVerboseFields) } : {})
    };
}

export class ClassHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'classIncludes',
                description: 'Get class includes structure (maps include type to its ADT URL)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        clas: {
                            type: 'string',
                            description: 'The class name'
                        }
                    },
                    required: ['clas']
                }
            },
            {
                name: 'classComponents',
                description: 'List class components (methods, attributes, types). For large classes, use startIndex/maxComponents to page through the top-level component list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the class'
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the top-level component to start from (default 0). Use with maxComponents to page through large component lists.',
                            optional: true
                        },
                        maxComponents: {
                            type: 'number',
                            description: 'Maximum number of top-level components to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['url']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'classIncludes':
                return this.handleClassIncludes(args);
            case 'classComponents':
                return this.handleClassComponents(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown class tool: ${toolName}`);
        }
    }

    async handleClassIncludes(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            // ADTClient.classIncludes() is a static helper that derives include
            // URLs from an already-fetched class structure - it does not accept
            // a class name and does not itself call SAP. Fetch the structure
            // first, then hand it to the helper.
            const classUrl = `/sap/bc/adt/oo/classes/${encodeURIComponent(String(args.clas).toLowerCase())}`;
            const structure = await this.adtclient.objectStructure(classUrl);
            if (!isClassStructure(structure)) {
                throw new McpError(ErrorCode.InvalidParams, `${args.clas} does not resolve to a class with an includes structure`);
            }
            const includesMap = ADTClient.classIncludes(structure);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result: Object.fromEntries(includesMap)
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
                `Failed to get class includes: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleClassComponents(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.classComponents(args.url);
            this.trackRequest(startTime, true);

            const lean = stripVerboseFields(result);
            const requestedPaging = args.startIndex !== undefined || args.maxComponents !== undefined;

            if (!requestedPaging) {
                const text = JSON.stringify({ status: 'success', result: lean });
                if (text.length <= SAFE_OUTPUT_CHARS) {
                    return { content: [{ type: 'text', text }] };
                }
            }

            const allComponents: any[] = Array.isArray(lean.components) ? lean.components : [];
            const totalComponents = allComponents.length;
            const startIndex = Math.max(0, Number(args.startIndex) || 0);
            const initialMaxComponents = args.maxComponents !== undefined
                ? Math.max(0, Number(args.maxComponents))
                : totalComponents - startIndex;

            const text = shrinkToFit(initialMaxComponents, (count, capped) => {
                const endIndex = Math.min(startIndex + count, totalComponents);
                const payload: any = {
                    status: 'success',
                    result: { ...lean, components: allComponents.slice(startIndex, endIndex) },
                    totalComponents,
                    startIndex,
                    returnedComponents: Math.max(0, endIndex - startIndex),
                    hasMore: endIndex < totalComponents
                };
                if (!requestedPaging) {
                    payload.autoPaged = true;
                }
                if (capped) {
                    payload.capped = true;
                    payload.note = 'Requested/default range exceeded the safe response size and was shrunk to fit. Pass a smaller maxComponents (or a later startIndex) to continue.';
                }
                return payload;
            });

            return { content: [{ type: 'text', text }] };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get class components: ${error.message || 'Unknown error'}`
            );
        }
    }

}
