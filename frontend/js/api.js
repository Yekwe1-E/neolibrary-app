/**
 * Core API Client
 * Wraps fetch to auto-inject JWT tokens and handle standardized JSON error payloads.
 */

const API_BASE = '/api'; // Relative route, relies on proxy or served from same origin

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('library_auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle FormData (multipart/form-data) properly by not setting Content-Type
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - Clear session and redirect to login unless we are already on login page
        console.warn("Session expired or unauthorized. Redirecting...");
        localStorage.removeItem('library_auth_token');
        localStorage.removeItem('library_user');
        if (!window.location.pathname.includes('/pages/login.html')) {
          window.location.href = '/pages/login.html?expired=true';
        }
      }
      
      const errorMsg = data?.message || 'An unexpected server error occurred';
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    if (window.showToast) {
      // Optional auto-toast for network level errors
      if (error.message === 'Failed to fetch') {
        window.showToast("Network Error: Could not reach the server.", "error");
      }
    }
    throw error;
  }
}

window.api = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) => apiRequest(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body: body ? JSON.stringify(body) : null }),
  delete: (url) => apiRequest(url, { method: 'DELETE' })
};
