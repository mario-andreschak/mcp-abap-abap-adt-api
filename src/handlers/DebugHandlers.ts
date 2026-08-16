import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';
import { DebuggingMode, DebuggerScope, DebugBreakpoint, DebugSettings } from 'abap-adt-api';

export class DebugHandlers extends BaseHandler {
    getTools(): ToolDefinition[] {
        return [
            {
                name: 'debuggerListeners',
                description: 'Retrieves a list of debugger listeners.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        debuggingMode: {
                            type: 'string',
                            description: 'The debugging mode.'
                        },
                        terminalId: {
                            type: 'string',
                            description: 'The terminal ID.'
                        },
                        ideId: {
                            type: 'string',
                            description: 'The IDE ID.'
                        },
                        user: {
                            type: 'string',
                            description: 'The user.'
                        },
                        checkConflict: {
                            type: 'boolean',
                            description: 'Whether to check for conflicts.',
                            optional: true
                        }
                    },
                    required: ['debuggingMode', 'terminalId', 'ideId', 'user']
                }
            },
            {
                name: 'debuggerListen',
                description: 'Listens for debugging events.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        debuggingMode: {
                            type: 'string',
                            description: 'The debugging mode.'
                        },
                        terminalId: {
                            type: 'string',
                            description: 'The terminal ID.'
                        },
                        ideId: {
                            type: 'string',
                            description: 'The IDE ID.'
                        },
                        user: {
                            type: 'string',
                            description: 'The user.'
                        },
                        checkConflict: {
                            type: 'boolean',
                            description: 'Whether to check for conflicts.',
                            optional: true
                        },
                        isNotifiedOnConflict: {
                            type: 'boolean',
                            description: 'Whether to be notified on conflict.',
                            optional: true
                        }
                    },
                    required: ['debuggingMode', 'terminalId', 'ideId', 'user']
                }
            },
            {
                name: 'debuggerDeleteListener',
                description: 'Stops a debug listener.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        debuggingMode: {
                            type: 'string',
                            description: 'The debugging mode.'
                        },
                        terminalId: {
                            type: 'string',
                            description: 'The terminal ID.'
                        },
                        ideId: {
                            type: 'string',
                            description: 'The IDE ID.'
                        },
                        user: {
                            type: 'string',
                            description: 'The user.'
                        }
                    },
                    required: ['debuggingMode', 'terminalId', 'ideId', 'user']
                }
            },
            {
                name: 'debuggerSetBreakpoints',
                description: 'Sets breakpoints.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        debuggingMode: {
                            type: 'string',
                            description: 'The debugging mode.'
                        },
                        terminalId: {
                            type: 'string',
                            description: 'The terminal ID.'
                        },
                        ideId: {
                            type: 'string',
                            description: 'The IDE ID.'
                        },
                        clientId: {
                            type: 'string',
                            description: 'The client ID.'
                        },
                        breakpoints: {
                            type: 'array',
                            description: 'An array of breakpoints.'
                        },
                        user: {
                            type: 'string',
                            description: 'The user.'
                        },
                        scope: {
                            type: 'string',
                            description: 'The debugger scope.',
                            optional: true
                        },
                        systemDebugging: {
                            type: 'boolean',
                            description: 'Whether to enable system debugging.',
                            optional: true
                        },
                        deactivated: {
                            type: 'boolean',
                            description: 'Whether to deactivate the breakpoints.',
                            optional: true
                        },
                        syncScupeUrl: {
                            type: 'string',
                            description: 'The URL for scope synchronization.',
                            optional: true
                        }
                    },
                    required: ['debuggingMode', 'terminalId', 'ideId', 'clientId', 'breakpoints', 'user']
                }
            },
            {
                name: 'debuggerDeleteBreakpoints',
                description: 'Deletes breakpoints.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        breakpoint: {
                            type: 'object',
                            description: 'The breakpoint to delete.'
                        },
                        debuggingMode: {
                            type: 'string',
                            description: 'The debugging mode.'
                        },
                        terminalId: {
                            type: 'string',
                            description: 'The terminal ID.'
                        },
                        ideId: {
                            type: 'string',
                            description: 'The IDE ID.'
                        },
                        requestUser: {
                            type: 'string',
                            description: 'The requesting user.'
                        },
                        scope: {
                            type: 'string',
                            description: 'The debugger scope.',
                            optional: true
                        }
                    },
                    required: ['breakpoint', 'debuggingMode', 'terminalId', 'ideId', 'requestUser']
                }
            },
            {
                name: 'debuggerAttach',
                description: 'Attaches the debugger.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        debuggingMode: {
                            type: 'string',
                            description: 'The debugging mode.'
                        },
                        debuggeeId: {
                            type: 'string',
                            description: 'The ID of the debuggee.'
                        },
                        user: {
                            type: 'string',
                            description: 'The user.'
                        },
                        dynproDebugging: {
                            type: 'boolean',
                            description: 'Whether to enable Dynpro debugging.',
                            optional: true
                        }
                    },
                    required: ['debuggingMode', 'debuggeeId', 'user']
                }
            },
            {
                name: 'debuggerSaveSettings',
                description: 'Saves debugger settings.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        settings: {
                            type: 'string',
                            description: 'The debugger settings.'
                        }
                    },
                    required: ['settings']
                }
            },
            {
                name: 'debuggerStackTrace',
                description: 'Retrieves the debugger stack trace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        semanticURIs: {
                            type: 'boolean',
                            description: 'Whether to use semantic URIs.',
                            optional: true
                        }
                    }
                }
            },
            {
                name: 'debuggerVariables',
                description: 'Retrieves debugger variables.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        parents: {
                            type: 'array',
                            description: 'An array of parent variable names.'
                        }
                    },
                    required: ['parents']
                }
            },
            {
                name: 'debuggerChildVariables',
                description: 'Retrieves child variables of a debugger variable.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        parent: {
                            type: 'array',
                            description: 'The parent variable name.',
                            optional: true
                        }
                    }
                }
            },
            {
                name: 'debuggerStep',
                description: 'Performs a debugger step.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        steptype: {
                            type: 'string',
                            description: 'The type of step to perform.'
                        },
                        url: {
                            type: 'string',
                            description: 'The URL for step types "stepRunToLine" or "stepJumpToLine".',
                            optional: true
                        }
                    },
                    required: ['steptype']
                }
            },
            {
                name: 'debuggerGoToStack',
                description: 'Navigates to a specific stack entry in the debugger.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        urlOrPosition: {
                            type: 'string',
                            description: 'The URL or position of the stack entry.'
                        }
                    },
                    required: ['urlOrPosition']
                }
            },
            {
                name: 'debuggerSetVariableValue',
                description: 'Sets the value of a debugger variable.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        variableName: {
                            type: 'string',
                            description: 'The name of the variable.'
                        },
                        value: {
                            type: 'string',
                            description: 'The new value of the variable.'
                        }
                    },
                    required: ['variableName', 'value']
                }
            }
        ];
    }

    async handle(toolName: string, args: any): Promise<any> {
        switch (toolName) {
            case 'debuggerListeners':
                return this.handleDebuggerListeners(args);
            case 'debuggerListen':
                return this.handleDebuggerListen(args);
            case 'debuggerDeleteListener':
                return this.handleDebuggerDeleteListener(args);
            case 'debuggerSetBreakpoints':
                return this.handleDebuggerSetBreakpoints(args);
            case 'debuggerDeleteBreakpoints':
                return this.handleDebuggerDeleteBreakpoints(args);
            case 'debuggerAttach':
                return this.handleDebuggerAttach(args);
            case 'debuggerSaveSettings':
                return this.handleDebuggerSaveSettings(args);
            case 'debuggerStackTrace':
                return this.handleDebuggerStackTrace(args);
            case 'debuggerVariables':
                return this.handleDebuggerVariables(args);
            case 'debuggerChildVariables':
                return this.handleDebuggerChildVariables(args);
            case 'debuggerStep':
                return this.handleDebuggerStep(args);
            case 'debuggerGoToStack':
                return this.handleDebuggerGoToStack(args);
            case 'debuggerSetVariableValue':
                return this.handleDebuggerSetVariableValue(args);
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown debug tool: ${toolName}`);
        }
    }

    async handleDebuggerListeners(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerListeners(
                args.debuggingMode,
                args.terminalId,
                args.ideId,
                args.user,
                args.checkConflict
            );
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
                `Failed to get debugger listeners: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerListen(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerListen(
                args.debuggingMode,
                args.terminalId,
                args.ideId,
                args.user,
                args.checkConflict,
                args.isNotifiedOnConflict
            );
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
                `Failed to start debugger listener: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerDeleteListener(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerDeleteListener(
                args.debuggingMode,
                args.terminalId,
                args.ideId,
                args.user
            );
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
                `Failed to delete debugger listener: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerSetBreakpoints(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerSetBreakpoints(
                args.debuggingMode,
                args.terminalId,
                args.ideId,
                args.clientId,
                args.breakpoints,
                args.user,
                args.scope,
                args.systemDebugging,
                args.deactivated,
                args.syncScupeUrl
            );
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
                `Failed to set breakpoints: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerDeleteBreakpoints(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerDeleteBreakpoints(
                args.breakpoint,
                args.debuggingMode,
                args.terminalId,
                args.ideId,
                args.requestUser,
                args.scope
            );
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
                `Failed to delete breakpoints: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerAttach(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerAttach(
                args.debuggingMode,
                args.debuggeeId,
                args.user,
                args.dynproDebugging
            );
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
                `Failed to attach debugger: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerSaveSettings(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerSaveSettings(args.settings);
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
                `Failed to save debugger settings: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerStackTrace(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerStackTrace(args.semanticURIs);
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
                `Failed to get stack trace: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerVariables(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerVariables(args.parents);
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
                `Failed to get variables: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerChildVariables(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerChildVariables(args.parent);
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
                `Failed to get child variables: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerStep(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerStep(args.steptype, args.url);
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
                `Failed to perform debug step: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerGoToStack(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerGoToStack(args.urlOrPosition);
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
                `Failed to go to stack position: ${this.formatAdtError(error)}`
            );
        }
    }

    async handleDebuggerSetVariableValue(args: any): Promise<any> {
        const startTime = performance.now();
        try {
            const result = await this.adtclient.debuggerSetVariableValue(args.variableName, args.value);
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
                `Failed to set variable value: ${this.formatAdtError(error)}`
            );
        }
    }
}
