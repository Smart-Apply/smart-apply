/**
 * CSRF Token Management
 * Implements Double Submit Cookie Pattern for CSRF protection
 * 
 * The token is fetched from the server and included in all state-changing requests.
 * Stored in memory (not localStorage) for security.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// In-memory storage for CSRF token (not localStorage for security)
let csrfToken: string | null = null;
let tokenFetchPromise: Promise<void> | null = null;

/**
 * Fetch CSRF token from the server
 * Uses a singleton pattern to prevent concurrent requests
 */
export async function fetchCsrfToken(): Promise<void> {
  // If already fetching, return the existing promise
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  // Create new fetch promise
  tokenFetchPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include', // Include cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if CSRF is disabled on backend
      if (data.csrfToken === 'csrf-disabled') {
        csrfToken = null;
        if (process.env.NODE_ENV === 'development') {
          console.log('ℹ️  CSRF protection disabled on backend');
        }
        return;
      }
      
      csrfToken = data.csrfToken;
      
      // Log success (dev only)
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ CSRF token fetched successfully');
      }
    } catch (error) {
      console.error('❌ Failed to fetch CSRF token:', error);
      // Reset token on error
      csrfToken = null;
      throw error;
    } finally {
      // Reset promise so next call creates a new one
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}

/**
 * Get the current CSRF token
 * Returns null if not initialized
 */
export function getCsrfToken(): string | null {
  return csrfToken;
}

/**
 * Clear the CSRF token (e.g., on logout)
 */
export function clearCsrfToken(): void {
  csrfToken = null;
}

/**
 * Check if CSRF token is initialized
 */
export function isCsrfTokenInitialized(): boolean {
  return csrfToken !== null;
}

/**
 * Refresh CSRF token (e.g., after 403 CSRF error)
 */
export async function refreshCsrfToken(): Promise<void> {
  csrfToken = null; // Clear existing token
  return fetchCsrfToken();
}
