/**
 * NeoLibrary — Shared Navigation Component
 * Renders sidebar, topbar, and manages mobile overlay for all app pages.
 * Usage: include this script after auth.js and ui.js on any app page.
 * Call: window.NavComponent.init({ activePage: 'dashboard' });
 */

window.NavComponent = {
  /**
   * @param {object} opts
   * @param {string} opts.activePage - Key for the active nav item
   * @param {string} [opts.pageTitle] - Title shown in topbar
   */
  init({ activePage = '', pageTitle = '' } = {}) {
    const user = window.Auth.getUser();
    if (!user) return;

    this._renderSidebar(activePage, user);
    this._renderTopbar(pageTitle, user);
    this._setupMobileToggle();
    this._setupScrollClass();
  },

  _navItems(user) {
    const isLibrarian = window.Auth.isLibrarian();

    const core = [
      { key: 'dashboard',     href: '/pages/dashboard.html',    icon: 'ph-squares-four',       label: 'Overview' },
      { key: 'catalog',       href: '/pages/books.html',         icon: 'ph-book-open',           label: 'Catalog' },
      { key: 'borrowings',    href: '/pages/borrowings.html',    icon: 'ph-bookmark-simple',     label: 'My Borrowings' },
      { key: 'reservations',  href: '/pages/reservations.html',  icon: 'ph-clock',               label: 'Reservations' },
      { key: 'profile',       href: '/pages/profile.html',       icon: 'ph-user-circle',         label: 'My Profile' },
    ];

    const admin = isLibrarian ? [
      { key: 'book-management',  href: '/pages/admin/book-management.html',  icon: 'ph-books',      label: 'Books Matrix' },
      { key: 'user-management',  href: '/pages/admin/user-management.html',  icon: 'ph-users',      label: 'Patrons Matrix' },
      { key: 'reports',          href: '/pages/admin/reports.html',           icon: 'ph-chart-bar',  label: 'Analytics' },
      { key: 'settings',         href: '/pages/admin/settings.html',          icon: 'ph-sliders',    label: 'Settings' },
    ] : [];

    return { core, admin, isLibrarian };
  },

  _renderSidebar(activePage, user) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const { core, admin, isLibrarian } = this._navItems(user);

    const renderItem = (item) => `
      <a href="${item.href}" class="nav-item${item.key === activePage ? ' active' : ''}">
        <i class="ph ${item.icon}"></i>
        <span>${item.label}</span>
      </a>
    `;

    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <a href="/">
          <i class="ph ph-books"></i>
          <span>NeoLibrary</span>
        </a>
      </div>

      <nav class="sidebar-nav" id="sidebar-nav">
        <div class="sidebar-section-label">Main</div>
        ${core.map(renderItem).join('')}

        ${isLibrarian ? `
          <div class="sidebar-section-label" style="margin-top: 0.75rem;">Management</div>
          ${admin.map(renderItem).join('')}
        ` : ''}

        <div style="flex: 1;"></div>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user-chip">
          <img src="${user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.full_name)}`}" 
               alt="Avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.8rem;font-weight:600;color:var(--clr-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.full_name}</div>
            <div style="font-size:0.7rem;color:var(--clr-text-faint);text-transform:capitalize;">${user.role}</div>
          </div>
          <button class="btn btn-icon btn-ghost" style="flex-shrink:0;" onclick="window.Auth.logout()" title="Logout">
            <i class="ph ph-sign-out" style="color:var(--clr-danger);"></i>
          </button>
        </div>
      </div>
    `;

    // Add sidebar user chip styles if not present
    if (!document.getElementById('nav-chip-style')) {
      const style = document.createElement('style');
      style.id = 'nav-chip-style';
      style.textContent = `
        .sidebar-user-chip {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--clr-bg-card);
          border: 1px solid var(--clr-border);
          border-radius: var(--radius-md);
          cursor: default;
        }
      `;
      document.head.appendChild(style);
    }
  },

  _renderTopbar(pageTitle, user) {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Avoid re-rendering if topbar was already custom-built in HTML
    if (topbar.dataset.managed) return;
    topbar.dataset.managed = 'true';

    topbar.innerHTML = `
      <div class="topbar-left">
        <button class="sidebar-toggle-btn" id="sidebar-toggle" title="Toggle Sidebar">
          <i class="ph ph-list"></i>
        </button>
        <h2>${pageTitle || document.title.split(' - ')[0] || 'Dashboard'}</h2>
      </div>

      <div class="topbar-right">
        <a href="/pages/books.html" class="btn btn-ghost btn-sm" style="gap:0.375rem;">
          <i class="ph ph-magnifying-glass"></i>
          <span class="topbar-user-name">Search Catalog</span>
        </a>
        <div class="topbar-user">
          <span class="topbar-user-name">${user.full_name.split(' ')[0]}</span>
          <img id="topbar-avatar"
               src="${user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.full_name)}`}"
               alt="Avatar"
               onerror="this.src='https://api.dicebear.com/7.x/initials/svg?seed=User'">
        </div>
      </div>
    `;
  },

  _setupMobileToggle() {
    // Give a small delay so sidebar DOM is ready
    setTimeout(() => {
      const toggleBtn = document.getElementById('sidebar-toggle');
      const sidebar   = document.getElementById('sidebar');
      if (!toggleBtn || !sidebar) return;

      toggleBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');

        // Create/remove overlay
        if (isOpen) {
          const overlay = document.createElement('div');
          overlay.className = 'sidebar-overlay';
          overlay.id = 'sidebar-overlay';
          document.body.appendChild(overlay);
          overlay.addEventListener('click', () => this._closeSidebar());
        } else {
          this._closeSidebar();
        }
      });
    }, 50);
  },

  _closeSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.remove();
  },

  _setupScrollClass() {
    // For public navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const handler = () => {
      if (window.scrollY > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    handler(); // run once on load
  },
};
