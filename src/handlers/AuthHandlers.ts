import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { BaseHandler } from './BaseHandler.js';
import type { ToolDefinition } from '../types/tools.js';

export class AuthHandlers extends BaseHandler {
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'login',
        description: 'Authenticate with ABAP system',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'logout',
        description: 'Terminate ABAP session',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'dropSession',
        description: 'Clear local session cache',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  async handle(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case 'login':
        return this.handleLogin(args);
      case 'logout':
        return this.handleLogout(args);
      case 'dropSession':
        return this.handleDropSession(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown auth tool: ${toolName}`);
    }
  }

  private async handleLogin(args: any) {
    const startTime = performance.now();
    try {
      const loginResult = await this.adtclient.login();
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: 'text',
            // ADTClient.login() resolves with undefined when the session is already
            // authenticated. JSON.stringify(undefined) returns undefined, which makes
            // the SDK reject the tool result as invalid (MCP error -32602).
            text: JSON.stringify(loginResult ?? { status: 'logged in' })
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw new McpError(
        ErrorCode.InternalError,
        `Login failed: ${error.message || 'Unknown error'}`
      );
    }
  }

  private async handleLogout(args: any) {
    const startTime = performance.now();
    try {
      await this.adtclient.logout();
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ status: 'Logged out successfully' })
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw new McpError(
        ErrorCode.InternalError,
        `Logout failed: ${error.message || 'Unknown error'}`
      );
    }
  }

  private async handleDropSession(args: any) {
    const startTime = performance.now();
    try {
      await this.adtclient.dropSession();
      this.trackRequest(startTime, true);
      return {
        content: [
          {
            type: 'text', 
            text: JSON.stringify({ status: 'Session cleared' })
          }
        ]
      };
    } catch (error: any) {
      this.trackRequest(startTime, false);
      throw new McpError(
        ErrorCode.InternalError,
        `Drop session failed: ${error.message || 'Unknown error'}`
      );
    }
  }
}
