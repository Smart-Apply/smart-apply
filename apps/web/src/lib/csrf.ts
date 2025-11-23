/**
 * CSRF Token Management
 * Implements Double Submit Cookie Pattern for CSRF protection
 * 
 * The token is fetched from the server and included in all state-changing requests.
 * Stored in memory (not localStorage) for security.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Storage keys
const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_TIMESTAMP_KEY = 'csrf_token_timestamp';
const CSRF_TOKEN_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// In-memory storage for CSRF token (with localStorage backup for persistence across HMR)
let csrfToken: string | null = null;
let tokenFetchPromise: Promise<void> | null = null;

/**
 * Check if cached token is still valid
 */
function isCachedTokenValid(): boolean {
  try {
    const timestamp = localStorage.getItem(CSRF_TOKEN_TIMESTAMP_KEY);
    if (!timestamp) return false;
    
    const age = Date.now() - parseInt(timestamp, 10);
    return age < CSRF_TOKEN_TTL;
  } catch {
    return false;
  }
}

/**
 * Load token from localStorage if valid
 */
function loadCachedToken(): boolean {
  try {
    if (isCachedTokenValid()) {
      const cached = localStorage.getItem(CSRF_TOKEN_KEY);
      if (cached) {
        csrfToken = cached;
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Using cached CSRF token');
        }
        return true;
      }
    }
  } catch {
    // localStorage not available or error reading
  }
  return false;
}

/**
 * Fetch CSRF token from the server
 * Uses a singleton pattern to prevent concurrent requests
 * Caches token in localStorage for 1 hour to reduce requests
 */
export async function fetchCsrfToken(): Promise<void> {
  // Try to load from cache first
  if (loadCachedToken()) {
    return;
  }

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
        localStorage.removeItem(CSRF_TOKEN_KEY);
        localStorage.removeItem(CSRF_TOKEN_TIMESTAMP_KEY);
        if (process.env.NODE_ENV === 'development') {
          console.log('ℹ️  CSRF protection disabled on backend');
        }
        return;
      }
      
      csrfToken = data.csrfToken;
      
      // Cache in localStorage with timestamp
      if (csrfToken) {
        try {
          localStorage.setItem(CSRF_TOKEN_KEY, csrfToken);
          localStorage.setItem(CSRF_TOKEN_TIMESTAMP_KEY, Date.now().toString());
        } catch {
          // localStorage not available, continue without caching
        }
      }
      
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
  try {
    localStorage.removeItem(CSRF_TOKEN_KEY);
    localStorage.removeItem(CSRF_TOKEN_TIMESTAMP_KEY);
  } catch {
    // localStorage not available
  }
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
  try {
    localStorage.removeItem(CSRF_TOKEN_KEY);
    localStorage.removeItem(CSRF_TOKEN_TIMESTAMP_KEY);
  } catch {
    // localStorage not available
  }
  return fetchCsrfToken();
}
