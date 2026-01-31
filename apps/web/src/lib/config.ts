/**
 * Runtime configuration
 * Fetches API URL dynamically from config endpoint with caching
 */

const STORAGE_KEY = 'smart_apply_api_url';
const defaultUrl = 'http://localhost:3000/api/v1';

let API_BASE_URL: string = '';
let configPromise: Promise<string> | null = null;

/**
 * Load cached API URL from localStorage
 */
function loadCachedUrl(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Save API URL to localStorage for future sessions
 */
function saveCachedUrl(url: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch (error) {
    console.warn('Failed to cache API URL:', error);
  }
}

/**
 * Fetch config from server
 */
async function fetchConfig(): Promise<string> {
  try {
    const response = await fetch('/api/config', {
      cache: 'force-cache', // Browser caches the response
    });
    
    if (!response.ok) {
      throw new Error(`Config endpoint returned ${response.status}`);
    }
    
    const config = await response.json();
    const url = config.apiUrl || defaultUrl;
    
    // Cache for future sessions
    saveCachedUrl(url);
    API_BASE_URL = url;
    
    return url;
  } catch (error) {
    console.warn('Failed to fetch runtime config, using default:', error);
    
    // Use cached URL as fallback
    const cached = loadCachedUrl();
    const fallbackUrl = cached || defaultUrl;
    
    API_BASE_URL = fallbackUrl;
    return fallbackUrl;
  }
}

/**
 * Get API base URL with singleton pattern and caching
 * - First call: checks localStorage cache
 * - If no cache: fetches from /api/config endpoint
 * - Subsequent calls: returns in-memory cached value
 */
export async function getApiBaseUrl(): Promise<string> {
  // Return in-memory cached value immediately
  if (API_BASE_URL) return API_BASE_URL;
  
  // Check localStorage cache first (from previous session)
  const cached = loadCachedUrl();
  if (cached) {
    API_BASE_URL = cached;
    return cached;
  }
  
  // Singleton pattern: only one fetch request per session
  if (!configPromise) {
    configPromise = fetchConfig();
  }
  
  return configPromise;
}

/**
 * Get API base URL synchronously (for OAuth redirects and other sync contexts)
 * Returns cached value or default URL - never waits for async fetch
 */
export function getApiBaseUrlSync(): string {
  if (API_BASE_URL) return API_BASE_URL;
  
  const cached = loadCachedUrl();
  if (cached) {
    API_BASE_URL = cached;
    return cached;
  }
  
  return defaultUrl;
}
