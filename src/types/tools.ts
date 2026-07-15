export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      optional?: boolean;
      properties?: Record<string, {
        type: string;
        description?: string;
        optional?: boolean;
        properties?: any;  // Allow deeper nesting
        required?: string[];
      }>;
      required?: string[];
    }>;
    required?: string[];
  };
}
