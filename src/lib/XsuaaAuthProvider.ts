import { XsuaaService } from '@sap/xssec';

export interface XsuaaConfig {
  url: string;
  clientid: string;
  clientsecret: string;
  username?: string;  // For password grant flow
  password?: string;  // For password grant flow
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  jti: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

/**
 * XSUAA Authentication Provider for SAP BTP
 * Supports both:
 * - Client Credentials Flow (machine-to-machine)
 * - Password Grant Flow (user authentication)
 */
export class XsuaaAuthProvider {
  private xsuaaService: XsuaaService;
  private tokenCache: TokenCache | null = null;
  private username?: string;
  private password?: string;

  constructor(config: XsuaaConfig) {
    // Initialize XsuaaService with credentials
    this.xsuaaService = new XsuaaService(config);
    this.username = config.username;
    this.password = config.password;
  }

  /**
   * Get a valid access token, using cache if available
   * @returns Bearer token string (without 'Bearer ' prefix)
   */
  async getToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 60 second buffer for safety)
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.token;
    }

    // Fetch new token
    const tokenResponse = await this.fetchToken();

    // Cache the token
    this.tokenCache = {
      token: tokenResponse.access_token,
      expiresAt: now + (tokenResponse.expires_in * 1000)
    };

    return this.tokenCache.token;
  }

  /**
   * Fetch a new access token from XSUAA
   * Uses password grant flow if username/password provided, otherwise client credentials
   */
  private async fetchToken(): Promise<TokenResponse> {
    try {
      let response;

      if (this.username && this.password) {
        // Password Grant Flow - for user authentication
        console.error('[XSUAA] Using password grant flow for user authentication');
        response = await this.xsuaaService.fetchPasswordToken(this.username, this.password);
      } else {
        // Client Credentials Flow - for machine-to-machine
        console.error('[XSUAA] Using client credentials flow');
        response = await this.xsuaaService.fetchClientCredentialsToken();
      }

      return response as TokenResponse;
    } catch (error: any) {
      throw new Error(`Failed to fetch XSUAA token: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Clear the token cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.tokenCache = null;
  }

  /**
   * Get the Authorization header value
   * @returns Complete Authorization header value (e.g., "Bearer abc123...")
   */
  async getAuthorizationHeader(): Promise<string> {
    const token = await this.getToken();
    return `Bearer ${token}`;
  }
}
