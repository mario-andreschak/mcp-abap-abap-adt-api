type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export function createLogger(name: string) {
  return {
    error: (message: string, meta?: Record<string, unknown>) => 
      log('error', name, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => 
      log('warn', name, message, meta),
    info: (message: string, meta?: Record<string, unknown>) => 
      log('info', name, message, meta),
    debug: (message: string, meta?: Record<string, unknown>) => 
      log('debug', name, message, meta)
  };
}

function log(level: LogLevel, name: string, message: string, meta?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    service: name,
    message,
    ...meta
  };
  
  const logString = JSON.stringify(logEntry);

  // Always write to stderr. On a stdio MCP server, stdout carries the JSON-RPC
  // protocol; any log written there corrupts the message stream and the client
  // fails with "SyntaxError in JSON" (see issue #11). console.info/warn/debug
  // all write to stdout, so route every level through stderr instead.
  process.stderr.write(logString + '\n');
}

export type Logger = ReturnType<typeof createLogger>;
