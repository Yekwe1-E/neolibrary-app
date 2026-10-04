/**
 * UI Utilities (Toasts, Navigation State, Modals)
 */

window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'ph-info';
  if (type === 'success') iconClass = 'ph-check-circle';
  if (type === 'error') iconClass = 'ph-warning-circle';
  if (type === 'warning') iconClass = 'ph-warning';

  toast.innerHTML = `
    <i class="ph ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('hiding');
    toast.addEventListener('animationend', () => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    });
  }, 3000);
}

// Format Dates globally
window.formatDate = function(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Global UI Setup on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Setup Navigation Auth State
  const authSection = document.getElementById('auth-section');
  const dashboardLink = document.getElementById('nav-dashboard');

  if (window.Auth && window.Auth.isAuthenticated()) {
    const user = window.Auth.getUser();
    if (dashboardLink) dashboardLink.style.display = 'inline-flex';
    
    if (authSection) {
      const avatarSrc = user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.full_name)}`;
      authSection.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <a href="/pages/dashboard.html" class="user-chip" title="Go to Dashboard">
            <img src="${avatarSrc}" alt="Avatar">
            <span>${user.full_name.split(' ')[0]}</span>
          </a>
          <button class="btn btn-outline" onclick="window.Auth.logout()" style="padding: 0.4rem 0.85rem; font-size: 0.8rem;">Logout</button>
        </div>
      `;
    }
  }

  // 2. Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navbarInner = document.querySelector('.navbar-inner');
  if (mobileMenuBtn && navbarInner) {
    mobileMenuBtn.addEventListener('click', () => {
      navbarInner.classList.toggle('nav-menu-open');
    });
  }

  // 3. Setup Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }
});

