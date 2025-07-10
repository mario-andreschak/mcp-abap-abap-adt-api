# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server for ABAP-ADT-API that provides tools for interacting with SAP systems via ADT (ABAP Development Tools) APIs. The server enables ABAP object management, transport handling, code analysis, and development workflows.

## Development Commands

### Build and Run
```bash
npm run build          # Compile TypeScript to JavaScript
npm run start          # Start the MCP server
npm run dev            # Start with MCP inspector for development
```

### Testing
```bash
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode  
npm run test:coverage  # Run tests with coverage report
```

## Architecture

### Core Components

**Main Server (`src/index.ts`)**
- `AbapAdtServer` class extends MCP SDK Server
- Manages ADT client connection and session state
- Routes tool calls to appropriate handlers
- Handles authentication, error serialization, and shutdown

**Handler Architecture**
- Each handler extends `BaseHandler` (`src/handlers/BaseHandler.ts`)
- Provides rate limiting, metrics tracking, and logging
- Handlers are organized by functional area:
  - `AuthHandlers` - Authentication and session management
  - `ObjectHandlers` - Object search and metadata
  - `ObjectSourceHandlers` - Source code retrieval/modification
  - `TransportHandlers` - Transport request management
  - `CodeAnalysisHandlers` - Syntax checking and code completion
  - 15+ specialized handlers for specific SAP features

**Configuration**
- Environment variables loaded from `.env` file
- Required: `SAP_URL`, `SAP_USER`, `SAP_PASSWORD`
- Optional: `SAP_CLIENT`, `SAP_LANGUAGE`

### Key Technical Details

**ADT Client Integration**
- Uses `abap-adt-api` library for SAP connectivity
- Stateful session management enabled
- Session caching and cleanup handled by AuthHandlers

**Tool Registration**
- Each handler exposes tools via `getTools()` method
- Tools are registered in main server's `ListToolsRequestSchema` handler
- Tool execution routed through unified switch statement

**Error Handling**
- MCP-compliant error serialization
- Custom error codes and structured error responses
- Comprehensive logging via custom logger utility

## Working with ABAP Objects

### Standard Workflow
1. **Authentication**: Use `login` tool to establish session
2. **Object Search**: Use `searchObject` to find ABAP objects
3. **Source Access**: Use `getObjectSource` with `/source/main` suffix
4. **Modification**: Lock object, modify source, perform syntax check
5. **Activation**: Activate objects and release locks

### Important Patterns
- Object URLs require `/source/main` suffix for source operations
- Lock handles are required for source modifications
- Transport requests needed for tracked changes
- All operations return JSON responses with error handling

## Development Guidelines

### Code Organization
- Handlers should extend `BaseHandler` for consistency
- Use the logger utility for structured logging
- Implement proper error handling with MCP error types
- Follow existing patterns for tool registration

### Testing
- Tests are configured for `src/**/__tests__/**/*.test.ts` pattern
- Use Jest with ts-jest preset
- Coverage reporting enabled by default

### Environment Setup
- Copy `.env.example` to `.env` and configure SAP connection
- Ensure TypeScript compilation works before running
- Use `npm run dev` for development with MCP inspector

## MCP Integration

This server integrates with MCP clients like Claude Desktop and Cline. Key integration points:

**Configuration Example (for Cline)**:
```json
{
  "mcp-abap-abap-adt-api": {
    "command": "node",
    "args": ["PATH_TO_YOUR/mcp-abap-abap-adt-api/dist/index.js"]
  }
}
```

**Tool Categories**:
- Authentication: `login`, `logout`, `dropSession`
- Object Management: `searchObject`, `getObjectSource`, `setObjectSource`
- Transport: `transportInfo`, `createTransport`, `userTransports`
- Code Analysis: `syntaxCheckCode`, `codeCompletion`, `findDefinition`
- Development: `lock`, `unLock`, `activateObjects`

## Important Notes

- This is experimental software - use with caution in production
- The server maintains stateful sessions with SAP systems
- Rate limiting is implemented per handler (1 second minimum between requests)
- All SAP operations require proper authentication and authorization
- Source modifications require object locking and transport assignment