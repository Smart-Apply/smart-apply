/**
 * Runtime configuration
 * Fetches API URL dynamically from config endpoint
 */

let API_BASE_URL: string = '';

export async function getApiBaseUrl(): Promise<string> {
  if (API_BASE_URL) return API_BASE_URL;
  
  const defaultUrl = 'http://localhost:3000/api/v1';
  
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    API_BASE_URL = config.apiUrl || defaultUrl;
    return API_BASE_URL;
  } catch (error) {
    console.warn('Failed to fetch runtime config, using default:', error);
    API_BASE_URL = defaultUrl;
    return API_BASE_URL;
  }
}
