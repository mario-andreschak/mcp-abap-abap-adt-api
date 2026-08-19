import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { ADTClient, UnitTestRunFlags } from 'abap-adt-api';
import { SAFE_OUTPUT_CHARS, shrinkToFit } from '../lib/responseSizing.js';

// Unit test alerts can carry long call stacks (UnitTestAlert.stack) for
// failed/critical assertions - trim those per-alert before the top-level
// array-level paging below, since a handful of methods with deep stacks can
// dominate the payload size even when the number of test methods is small.
const MAX_ALERT_STACK_ENTRIES = 15;

function trimAlerts(alerts: any): any {
    if (!Array.isArray(alerts)) {
        return alerts;
    }
    return alerts.map((alert: any) => {
        const stack = Array.isArray(alert?.stack) ? alert.stack : undefined;
        if (!stack || stack.length <= MAX_ALERT_STACK_ENTRIES) {
            return alert;
        }
        return {
            ...alert,
            stack: stack.slice(0, MAX_ALERT_STACK_ENTRIES),
            stackTruncated: true,
            stackTotalEntries: stack.length
        };
    });
}

function trimUnitTestMethod(method: any): any {
    if (!method || typeof method !== 'object') {
        return method;
    }
    return { ...method, alerts: trimAlerts(method.alerts) };
}

function trimUnitTestClass(cls: any): any {
    if (!cls || typeof cls !== 'object') {
        return cls;
    }
    return {
        ...cls,
        testmethods: Array.isArray(cls.testmethods) ? cls.testmethods.map(trimUnitTestMethod) : cls.testmethods,
        alerts: trimAlerts(cls.alerts)
    };
}

export class UnitTestHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'unitTestRun',
                description: 'Runs unit tests. For large results (many test classes), use startIndex/maxItems to page through the top-level test-class list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the object to test.'
                        },
                        flags: {
                            type: 'string',
                            description: 'Flags for the unit test run.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the top-level test-class list to start from (default 0). Use with maxItems to page through large test runs.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of test classes to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['url']
                }
            },
            {
                name: 'unitTestEvaluation',
                description: 'Evaluates unit test results. For large results (many test methods), use startIndex/maxItems to page through the top-level test-method list instead of retrieving it all at once.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        clas: {
                            type: 'string',
                            description: 'The class to evaluate.'
                        },
                        flags: {
                            type: 'string',
                            description: 'Flags for the unit test evaluation.',
                            optional: true
                        },
                        startIndex: {
                            type: 'number',
                            description: '0-based index of the top-level test-method list to start from (default 0). Use with maxItems to page through large evaluations.',
                            optional: true
                        },
                        maxItems: {
                            type: 'number',
                            description: 'Maximum number of test methods to return from startIndex. Omit to return the rest.',
                            optional: true
                        }
                    },
                    required: ['clas']
                }
            },
            {
                name: 'unitTestOccurrenceMarkers',
                description: 'Retrieves unit test occurrence markers.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the object.'
                        },
                        source: {
                            type: 'string',
                            description: 'The source code.'
                        }
                    },
                    required: ['url', 'source']
                }
            },
            {
                name: 'createTestInclude',
                description: 'Creates a test include for a class.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        clas: {
                            type: 'string',
                            description: 'The class name.'
                        },
                        lockHandle: {
                            type: 'string',
                            description: 'The lock handle.'
                        },
                        transport: {
                            type: 'string',
                            description: 'The transport.',
                            optional: true
                        }
                    },
                    required: ['clas', 'lockHandle']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'unitTestRun':
                return this.handleUnitTestRun(args);
            case 'unitTestEvaluation':
                return this.handleUnitTestEvaluation(args);
            case 'unitTestOccurrenceMarkers':
                return this.handleUnitTestOccurrenceMarkers(args);
            case 'createTestInclude':
                return this.handleCreateTestInclude(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown unit test tool: ${toolName}`);
        }
    }

    async handleUnitTestRun(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.unitTestRun(args.url, args.flags);
            this.trackRequest(startTime, true);
            const trimmed = Array.isArray(result) ? result.map(trimUnitTestClass) : result;
            return this.buildPagedItemsResponse(trimmed, args);
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to run unit test: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleUnitTestEvaluation(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.unitTestEvaluation(args.clas, args.flags);
            this.trackRequest(startTime, true);
            const trimmed = Array.isArray(result) ? result.map(trimUnitTestMethod) : result;
            return this.buildPagedItemsResponse(trimmed, args);
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to evaluate unit test: ${error.message || 'Unknown error'}`
            );
        }
    }

    // Shared response shaping for unitTestRun (UnitTestClass[]) and
    // unitTestEvaluation (UnitTestMethod[]) - both return a top-level array
    // that can grow large across many test classes/methods, on top of the
    // per-alert stack trimming already applied above. Same paginate-then-
    // shrink pattern as ClassHandlers' classComponents.
    private buildPagedItemsResponse(result: any, args: any): any {
        const requestedPaging = args.startIndex !== undefined || args.maxItems !== undefined;

        if (!requestedPaging) {
            const text = JSON.stringify({ status: 'success', result });
            if (text.length <= SAFE_OUTPUT_CHARS) {
                return { content: [{ type: 'text', text }] };
            }
        }

        const allItems: any[] = Array.isArray(result) ? result : [];
        const totalItems = allItems.length;
        const startIndex = Math.max(0, Number(args.startIndex) || 0);
        const initialMaxItems = args.maxItems !== undefined
            ? Math.max(0, Number(args.maxItems))
            : totalItems - startIndex;

        const text = shrinkToFit(initialMaxItems, (count, capped) => {
            const endIndex = Math.min(startIndex + count, totalItems);
            const payload: any = {
                status: 'success',
                result: allItems.slice(startIndex, endIndex),
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
    }

    async handleUnitTestOccurrenceMarkers(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const markers = await this.adtclient.unitTestOccurrenceMarkers(args.url, args.source);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            markers
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to get unit test markers: ${error.message || 'Unknown error'}`
            );
        }
    }

    async handleCreateTestInclude(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.createTestInclude(args.clas, args.lockHandle, args.transport);
            this.trackRequest(startTime, true);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'success',
                            result,
                            message: 'Test include created successfully'
                        })
                    }
                ]
            };
        } catch (error: any) {
            this.trackRequest(startTime, false);
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to create test include: ${error.message || 'Unknown error'}`
            );
        }
    }
}
