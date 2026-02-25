import fs from 'fs';
import path from 'path';
import { XsuaaConfig } from './XsuaaAuthProvider.js';

export type AuthMode = 'basic' | 'xsuaa';

export interface ServiceKey {
  uaa: {
    url: string;
    clientid: string;
    clientsecret: string;
    [key: string]: any;
  };
  url: string;
  [key: string]: any;
}

export interface AuthConfig {
  mode: AuthMode;
  sapUrl: string;
  sapClient?: string;
  sapLanguage?: string;

  // Basic auth
  username?: string;
  password?: string;

  // XSUAA auth
  xsuaa?: XsuaaConfig;
}

/**
 * Load and parse the service key from file or environment
 */
function loadServiceKey(): ServiceKey | null {
  // Try to load from SERVICE_KEY_PATH environment variable
  const serviceKeyPath = process.env.SERVICE_KEY_PATH;

  if (serviceKeyPath) {
    try {
      const absolutePath = path.resolve(serviceKeyPath);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error: any) {
      throw new Error(`Failed to load service key from ${serviceKeyPath}: ${error.message}`);
    }
  }

  // Try to load from SERVICE_KEY environment variable (JSON string)
  const serviceKeyJson = process.env.SERVICE_KEY;
  if (serviceKeyJson) {
    try {
      return JSON.parse(serviceKeyJson);
    } catch (error: any) {
      throw new Error(`Failed to parse SERVICE_KEY JSON: ${error.message}`);
    }
  }

  return null;
}

/**
 * Load authentication configuration from environment
 * Auto-detects authentication mode based on available environment variables
 */
export function loadAuthConfig(): AuthConfig {
  // Try to load service key first
  const serviceKey = loadServiceKey();

  // Auto-detect mode: if service key is available and valid, use XSUAA
  if (serviceKey &&
      serviceKey.uaa &&
      serviceKey.uaa.url &&
      serviceKey.uaa.clientid &&
      serviceKey.uaa.clientsecret &&
      serviceKey.url) {

    // XSUAA authentication mode (auto-detected)
    // Check if cloud user credentials are provided for password grant flow
    const cloudUsername = process.env.SAP_CLOUD_USER || process.env.SAP_USER;
    const cloudPassword = process.env.SAP_CLOUD_PASSWORD || process.env.SAP_PASSWORD;

    return {
      mode: 'xsuaa',
      sapUrl: serviceKey.url,
      sapClient: process.env.SAP_CLIENT,
      sapLanguage: process.env.SAP_LANGUAGE,
      xsuaa: {
        url: serviceKey.uaa.url,
        clientid: serviceKey.uaa.clientid,
        clientsecret: serviceKey.uaa.clientsecret,
        // Include user credentials if provided (for password grant flow)
        // Prefers SAP_CLOUD_USER/SAP_CLOUD_PASSWORD, falls back to SAP_USER/SAP_PASSWORD
        username: cloudUsername,
        password: cloudPassword
      }
    };
  }

  // Fallback to basic authentication mode
  const missingVars = ['SAP_URL', 'SAP_USER', 'SAP_PASSWORD'].filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    throw new Error(
      `No valid service key found and missing required environment variables for basic auth: ${missingVars.join(', ')}\n` +
      `Either provide SERVICE_KEY_PATH/SERVICE_KEY for XSUAA auth, or SAP_URL, SAP_USER, SAP_PASSWORD for basic auth.`
    );
  }

  return {
    mode: 'basic',
    sapUrl: process.env.SAP_URL as string,
    sapClient: process.env.SAP_CLIENT,
    sapLanguage: process.env.SAP_LANGUAGE,
    username: process.env.SAP_USER,
    password: process.env.SAP_PASSWORD
  };
}
