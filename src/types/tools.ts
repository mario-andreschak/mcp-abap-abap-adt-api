export interface ToolPropertySchema {
  type: string;
  description?: string;
  optional?: boolean;
  items?: unknown;
  additionalProperties?: unknown;
  properties?: Record<string, unknown>;
  required?: string[];
  enum?: string[];
  maxLength?: number;
  [key: string]: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, ToolPropertySchema>;
    required?: string[];
  };
}
