#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import { ADTClient, session_types } from "abap-adt-api";
import path from 'path';
import { AuthHandlers } from './handlers/AuthHandlers.js';
import { TransportHandlers } from './handlers/TransportHandlers.js';
import { ObjectHandlers } from './handlers/ObjectHandlers.js';
import { ClassHandlers } from './handlers/ClassHandlers.js';
import { CodeAnalysisHandlers } from './handlers/CodeAnalysisHandlers.js';
import { ObjectLockHandlers } from './handlers/ObjectLockHandlers.js';
import { ObjectSourceHandlers } from './handlers/ObjectSourceHandlers.js';
import { ObjectDeletionHandlers } from './handlers/ObjectDeletionHandlers.js';
import { ObjectManagementHandlers } from './handlers/ObjectManagementHandlers.js';
import { ObjectRegistrationHandlers } from './handlers/ObjectRegistrationHandlers.js';
import { NodeHandlers } from './handlers/NodeHandlers.js';
import { DiscoveryHandlers } from './handlers/DiscoveryHandlers.js';
import { UnitTestHandlers } from './handlers/UnitTestHandlers.js';
import { PrettyPrinterHandlers } from './handlers/PrettyPrinterHandlers.js';
import { GitHandlers } from './handlers/GitHandlers.js';
import { DdicHandlers } from './handlers/DdicHandlers.js';
import { ServiceBindingHandlers } from './handlers/ServiceBindingHandlers.js';
import { QueryHandlers } from './handlers/QueryHandlers.js';
import { FeedHandlers } from './handlers/FeedHandlers.js';
import { DebugHandlers } from './handlers/DebugHandlers.js';
import { RenameHandlers } from './handlers/RenameHandlers.js';
import { AtcHandlers } from './handlers/AtcHandlers.js';
import { TraceHandlers } from './handlers/TraceHandlers.js';
import { RefactorHandlers } from './handlers/RefactorHandlers.js';
import { RevisionHandlers } from './handlers/RevisionHandlers.js';


// ---------------------------------------------------------------------------
// Error diagnostics and session recovery
//
// Two problems this addresses, both observed against an on-premise ABAP system:
//
// 1. Diagnostics. When the underlying HTTP layer wraps a failure, `message`
//    can collapse to "Request failed with status code 400" and the response
//    body SAP actually returned is dropped. Callers then have nothing to go on.
//    `mcpEnrichError` appends the body and the ADT exception fields to the
//    message, leaving the original error object otherwise untouched.
//
// 2. Session loss. When the stateful session is dropped, only stateful calls
//    fail (lock, createTransport, transportInfo, ...) while plain reads keep
//    working. That asymmetry makes it look like a build or permission problem.
//    `resilientClient` re-authenticates and retries such a call exactly once.
//
// Deliberately NOT retried:
//   - network-level failures (the server may already have applied the request),
//   - ADT business errors, which carry a specific exception `type`,
//   - login/logout/dropSession themselves, to avoid recursion.
// ---------------------------------------------------------------------------
const SESSION_NO_RETRY = new Set(["login", "logout", "dropSession", "statelessClone"]);

export function mcpErrStatus(e: any): number | undefined {
  const s = e?.response?.status ?? e?.parent?.response?.status ?? e?.status ?? e?.err;
  return typeof s === "number" ? s : undefined;
}

/** Best-effort extraction of the response body SAP returned. */
export function mcpErrBody(e: any): string {
  const d = e?.response?.data ?? e?.parent?.response?.data ?? e?.response?.body ?? e?.parent?.response?.body;
  if (d === undefined || d === null) return "";
  let t: string;
  if (typeof d === "string") t = d;
  else { try { t = JSON.stringify(d); } catch { t = String(d); } }
  const m = t.match(/<message[^>]*>([\s\S]*?)<\/message>/i);
  if (m) t = m[1];
  return t.replace(/\s+/g, " ").trim();
}

/** Appends what SAP actually returned to `message`. Returns the same error object. */
export function mcpEnrichError(e: any): any {
  if (!e || typeof e !== "object" || e.__mcpEnriched) return e;
  const msg = String(e.message ?? "");
  const bits: string[] = [];
  const st = mcpErrStatus(e);
  if (st && !msg.includes(String(st))) bits.push("HTTP " + st);
  for (const k of ["type", "namespace"]) {
    const v = e[k];
    if (typeof v === "string" && v && !msg.includes(v)) bits.push(k + "=" + v);
  }
  const lm = e.localizedMessage;
  if (typeof lm === "string" && lm && lm !== msg && !msg.includes(lm)) bits.push("localized=" + lm);
  let body = mcpErrBody(e);
  if (body) {
    if (body.length > 700) body = body.slice(0, 700) + "...(truncated)";
    if (!msg.includes(body.slice(0, 40))) bits.push("SAP: " + body);
  }
  if (bits.length) {
    // AdtHttpException exposes `message` as a prototype getter with no setter,
    // so plain assignment is silently ignored. Define an own property instead.
    try {
      Object.defineProperty(e, "message", {
        value: msg + " [" + bits.join(" | ") + "]",
        writable: true,
        configurable: true
      });
    } catch { /* frozen error object */ }
  }
  try { Object.defineProperty(e, "__mcpEnriched", { value: true, enumerable: false }); } catch { /* frozen */ }
  return e;
}

/** Heuristic: does this failure look like a dropped session rather than a real error? */
export function mcpLooksLikeSessionLoss(e: any): boolean {
  const code = String(e?.code ?? e?.parent?.code ?? "");
  // Network-level failures are not retried: the request may already have been applied.
  if (/ECONNABORTED|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ERR_BAD_RESPONSE/.test(code)) return false;
  const text = String(e?.message ?? "") + " " + mcpErrBody(e);
  if (/session|csrf|stateful|timed out/i.test(text)) return true;
  // A specific ADT exception type means a business error; retrying changes nothing.
  if (typeof e?.type === "string" && e.type) return false;
  return mcpErrStatus(e) === 400;
}

/**
 * Wraps an ADTClient so every tool gets error enrichment and one-shot session
 * recovery. Methods are invoked with the raw client as `this`, so internal
 * calls do not re-enter the proxy.
 */
export function resilientClient(client: ADTClient): ADTClient {
  return new Proxy(client as any, {
    get(target: any, prop: string | symbol) {
      const val = Reflect.get(target, prop, target);
      if (typeof val !== "function" || typeof prop !== "string") return val;
      return function (...args: any[]) {
        let out: any;
        try { out = val.apply(target, args); }
        catch (e) { throw mcpEnrichError(e); }
        if (!out || typeof out.then !== "function") return out;
        return Promise.resolve(out).catch(async (err: any) => {
          const first = mcpEnrichError(err);
          if (SESSION_NO_RETRY.has(prop) || !mcpLooksLikeSessionLoss(err)) throw first;
          console.error(JSON.stringify({
            level: "warn",
            service: "resilience",
            message: "session loss suspected - re-login and retry once",
            tool: prop,
            error: String(first?.message ?? "").slice(0, 300)
          }));
          try { await target.login(); }
          catch { throw first; }
          try { return await val.apply(target, args); }
          catch (e2: any) { throw mcpEnrichError(e2); }
        });
      };
    }
  }) as ADTClient;
}

config({ path: path.resolve(__dirname, '../.env') });

export class AbapAdtServer extends Server {
  private adtClient: ADTClient;
  private authHandlers: AuthHandlers;
  private transportHandlers: TransportHandlers;
  private objectHandlers: ObjectHandlers;
  private classHandlers: ClassHandlers;
  private codeAnalysisHandlers: CodeAnalysisHandlers;
  private objectLockHandlers: ObjectLockHandlers;
  private objectSourceHandlers: ObjectSourceHandlers;
  private objectDeletionHandlers: ObjectDeletionHandlers;
  private objectManagementHandlers: ObjectManagementHandlers;
  private objectRegistrationHandlers: ObjectRegistrationHandlers;
    private nodeHandlers: NodeHandlers;
    private discoveryHandlers: DiscoveryHandlers;
    private unitTestHandlers: UnitTestHandlers;
    private prettyPrinterHandlers: PrettyPrinterHandlers;
    private gitHandlers: GitHandlers;
    private ddicHandlers: DdicHandlers;
    private serviceBindingHandlers: ServiceBindingHandlers;
    private queryHandlers: QueryHandlers;
    private feedHandlers: FeedHandlers;
    private debugHandlers: DebugHandlers;
    private renameHandlers: RenameHandlers;
    private atcHandlers: AtcHandlers;
    private traceHandlers: TraceHandlers;
    private refactorHandlers: RefactorHandlers;
    private revisionHandlers: RevisionHandlers;

    constructor() {
    super(
      {
        name: "mcp-abap-abap-adt-api",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const missingVars = ['SAP_URL', 'SAP_USER', 'SAP_PASSWORD'].filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    this.adtClient = resilientClient(new ADTClient(
      process.env.SAP_URL as string,
      process.env.SAP_USER as string,
      process.env.SAP_PASSWORD as string,
      process.env.SAP_CLIENT as string,
      process.env.SAP_LANGUAGE as string
    ));
    this.adtClient.stateful = session_types.stateful
    
    // Initialize handlers
    this.authHandlers = new AuthHandlers(this.adtClient);
    this.transportHandlers = new TransportHandlers(this.adtClient);
    this.objectHandlers = new ObjectHandlers(this.adtClient);
    this.classHandlers = new ClassHandlers(this.adtClient);
    this.codeAnalysisHandlers = new CodeAnalysisHandlers(this.adtClient);
    this.objectLockHandlers = new ObjectLockHandlers(this.adtClient);
    this.objectSourceHandlers = new ObjectSourceHandlers(this.adtClient);
    this.objectDeletionHandlers = new ObjectDeletionHandlers(this.adtClient);
    this.objectManagementHandlers = new ObjectManagementHandlers(this.adtClient);
    this.objectRegistrationHandlers = new ObjectRegistrationHandlers(this.adtClient);
    this.nodeHandlers = new NodeHandlers(this.adtClient);
    this.discoveryHandlers = new DiscoveryHandlers(this.adtClient);
    this.unitTestHandlers = new UnitTestHandlers(this.adtClient);
    this.prettyPrinterHandlers = new PrettyPrinterHandlers(this.adtClient);
    this.gitHandlers = new GitHandlers(this.adtClient);
    this.ddicHandlers = new DdicHandlers(this.adtClient);
    this.serviceBindingHandlers = new ServiceBindingHandlers(this.adtClient);
    this.queryHandlers = new QueryHandlers(this.adtClient);
    this.feedHandlers = new FeedHandlers(this.adtClient);
    this.debugHandlers = new DebugHandlers(this.adtClient);
    this.renameHandlers = new RenameHandlers(this.adtClient);
    this.atcHandlers = new AtcHandlers(this.adtClient);
    this.traceHandlers = new TraceHandlers(this.adtClient);
    this.refactorHandlers = new RefactorHandlers(this.adtClient);
    this.revisionHandlers = new RevisionHandlers(this.adtClient);


        // Setup tool handlers
    this.setupToolHandlers();
  }

  private serializeResult(result: any) {
    try {
      // Handlers already return a well-formed MCP tool result
      // ({ content: [...] }). Re-wrapping it would double-serialize the payload
      // (every quote in the data gets escaped again), needlessly inflating large
      // responses such as object source (issue #4). Pass those through as-is and
      // only wrap raw values (e.g. the healthcheck object).
      if (result && Array.isArray(result.content)) {
        return result;
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )
        }]
      };
    } catch (error) {
      return this.handleError(new McpError(
        ErrorCode.InternalError,
        'Failed to serialize result'
      ));
    }
  }

  private handleError(error: unknown) {
    if (!(error instanceof Error)) {
      error = new Error(String(error));
    }
    if (error instanceof McpError) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            code: error.code
          })
        }],
        isError: true
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Internal server error',
          code: ErrorCode.InternalError
        })
      }],
      isError: true
    };
  }

  private setupToolHandlers() {
    this.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          ...this.authHandlers.getTools(),
          ...this.transportHandlers.getTools(),
          ...this.objectHandlers.getTools(),
          ...this.classHandlers.getTools(),
          ...this.codeAnalysisHandlers.getTools(),
          ...this.objectLockHandlers.getTools(),
          ...this.objectSourceHandlers.getTools(),
          ...this.objectDeletionHandlers.getTools(),
          ...this.objectManagementHandlers.getTools(),
          ...this.objectRegistrationHandlers.getTools(),
            ...this.nodeHandlers.getTools(),
            ...this.discoveryHandlers.getTools(),
            ...this.unitTestHandlers.getTools(),
            ...this.prettyPrinterHandlers.getTools(),
            ...this.gitHandlers.getTools(),
            ...this.ddicHandlers.getTools(),
            ...this.serviceBindingHandlers.getTools(),
            ...this.queryHandlers.getTools(),
            ...this.feedHandlers.getTools(),
            ...this.debugHandlers.getTools(),
            ...this.renameHandlers.getTools(),
            ...this.atcHandlers.getTools(),
            ...this.traceHandlers.getTools(),
            ...this.refactorHandlers.getTools(),
            ...this.revisionHandlers.getTools(),
            {
            name: 'healthcheck',
            description: 'Check server health and connectivity',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    this.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        let result: any;
        
        switch (request.params.name) {
            case 'login':
            case 'logout':
            case 'dropSession':
                result = await this.authHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'transportInfo':
            case 'createTransport':
            case 'hasTransportConfig':
            case 'transportConfigurations':
            case 'getTransportConfiguration':
            case 'setTransportsConfig':
            case 'createTransportsConfig':
            case 'userTransports':
            case 'transportsByConfig':
            case 'transportDelete':
            case 'transportRelease':
            case 'transportSetOwner':
            case 'transportAddUser':
            case 'systemUsers':
            case 'transportReference':
                result = await this.transportHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'lock':
            case 'unLock':
                result = await this.objectLockHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'objectStructure':
            case 'searchObject':
            case 'findObjectPath':
            case 'objectTypes':
            case 'reentranceTicket':
                result = await this.objectHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'classIncludes':
            case 'classComponents':
                result = await this.classHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'syntaxCheckCode':
            case 'syntaxCheckCdsUrl':
            case 'codeCompletion':
            case 'findDefinition':
            case 'usageReferences':
            case 'syntaxCheckTypes':
            case 'codeCompletionFull':
            case 'runClass':
            case 'codeCompletionElement':
            case 'usageReferenceSnippets':
            case 'fixProposals':
            case 'fixEdits':
            case 'fragmentMappings':
            case 'abapDocumentation':
                result = await this.codeAnalysisHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'getObjectSource':
            case 'setObjectSource':
                result = await this.objectSourceHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'deleteObject':
                result = await this.objectDeletionHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'activateObjects':
            case 'activateByName':
            case 'inactiveObjects':
                result = await this.objectManagementHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'objectRegistrationInfo':
            case 'validateNewObject':
            case 'createObject':
                result = await this.objectRegistrationHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'nodeContents':
            case 'mainPrograms':
                result = await this.nodeHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'featureDetails':
            case 'collectionFeatureDetails':
            case 'findCollectionByUrl':
            case 'loadTypes':
            case 'adtDiscovery':
            case 'adtCoreDiscovery':
            case 'adtCompatibiliyGraph':
                result = await this.discoveryHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'unitTestRun':
            case 'unitTestEvaluation':
            case 'unitTestOccurrenceMarkers':
            case 'createTestInclude':
                result = await this.unitTestHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'prettyPrinterSetting':
            case 'setPrettyPrinterSetting':
            case 'prettyPrinter':
                result = await this.prettyPrinterHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'gitRepos':
            case 'gitExternalRepoInfo':
            case 'gitCreateRepo':
            case 'gitPullRepo':
            case 'gitUnlinkRepo':
            case 'stageRepo':
            case 'pushRepo':
            case 'checkRepo':
            case 'remoteRepoInfo':
            case 'switchRepoBranch':
                result = await this.gitHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'annotationDefinitions':
            case 'ddicElement':
            case 'ddicRepositoryAccess':
            case 'packageSearchHelp':
                result = await this.ddicHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'publishServiceBinding':
            case 'unPublishServiceBinding':
            case 'bindingDetails':
                result = await this.serviceBindingHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'tableContents':
            case 'runQuery':
                result = await this.queryHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'feeds':
            case 'dumps':
                result = await this.feedHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'debuggerListeners':
            case 'debuggerListen':
            case 'debuggerDeleteListener':
            case 'debuggerSetBreakpoints':
            case 'debuggerDeleteBreakpoints':
            case 'debuggerAttach':
            case 'debuggerSaveSettings':
            case 'debuggerStackTrace':
            case 'debuggerVariables':
            case 'debuggerChildVariables':
            case 'debuggerStep':
            case 'debuggerGoToStack':
            case 'debuggerSetVariableValue':
                result = await this.debugHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'renameEvaluate':
            case 'renamePreview':
            case 'renameExecute':
                result = await this.renameHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'atcCustomizing':
            case 'atcCheckVariant':
            case 'createAtcRun':
            case 'atcWorklists':
            case 'atcUsers':
            case 'atcExemptProposal':
            case 'atcRequestExemption':
            case 'isProposalMessage':
            case 'atcContactUri':
            case 'atcChangeContact':
                result = await this.atcHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'tracesList':
            case 'tracesListRequests':
            case 'tracesHitList':
            case 'tracesDbAccess':
            case 'tracesStatements':
            case 'tracesSetParameters':
            case 'tracesCreateConfiguration':
            case 'tracesDeleteConfiguration':
            case 'tracesDelete':
                result = await this.traceHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'extractMethodEvaluate':
            case 'extractMethodPreview':
            case 'extractMethodExecute':
                result = await this.refactorHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'revisions':
                result = await this.revisionHandlers.handle(request.params.name, request.params.arguments);
                break;
            case 'healthcheck':
                result = { status: 'healthy', timestamp: new Date().toISOString() };
                break;
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }

        return this.serializeResult(result);
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.connect(transport);
    console.error('MCP ABAP ADT API server running on stdio');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      await this.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.close();
      process.exit(0);
    });
    
    // Handle errors
    this.onerror = (error) => {
      console.error('[MCP Error]', error);
    };
  }
}

// Create and run server instance
const server = new AbapAdtServer();
server.run().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
