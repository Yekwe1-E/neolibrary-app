/**
 * Authentication State Manager
 */

const Auth = {
  getUser() {
    const userData = localStorage.getItem('library_user');
    return userData ? JSON.parse(userData) : null;
  },

  getToken() {
    return localStorage.getItem('library_auth_token');
  },

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  getRole() {
    return this.getUser()?.role;
  },

  isAdmin() {
    return this.getRole() === 'admin';
  },

  isLibrarian() {
    return ['admin', 'librarian'].includes(this.getRole());
  },

  setSession(token, user) {
    localStorage.setItem('library_auth_token', token);
    localStorage.setItem('library_user', JSON.stringify(user));
  },

  logout() {
    // Fire api logout call optionally, but definitely clear local state
    window.api.post('/auth/logout', {}).catch(e => console.log('Logout API fail ignored', e))
    .finally(() => {
      localStorage.removeItem('library_auth_token');
      localStorage.removeItem('library_user');
      window.location.href = '/pages/login.html';
    });
  },

  // Route Guards - Call this in the script of protected HTML pages
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/pages/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    }
  },

  requireAdminOrLibrarian() {
    this.requireAuth();
    if (!this.isLibrarian()) {
      window.location.href = '/pages/dashboard.html'; // Redirect to Patron dashboard
    }
  },

  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = '/pages/dashboard.html';
    }
  }
};

window.Auth = Auth;
