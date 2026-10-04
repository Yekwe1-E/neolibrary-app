/**
 * Main JS - Logic for landing page (index.html)
 */

document.addEventListener('DOMContentLoaded', async () => {
  
  // Handle Search Input in Hero
  const searchBtn = document.getElementById('hero-search-btn');
  const searchInput = document.getElementById('hero-search-input');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const q = searchInput.value.trim();
      if (q) {
        window.location.href = `/pages/books.html?search=${encodeURIComponent(q)}`;
      }
    });
    
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchBtn.click();
    });
  }

  // Load Trending / Popular Books preview
  const popContainer = document.getElementById('popular-books-container');
  if (popContainer) {
    try {
      const res = await window.api.get('/books?limit=4');
      if (res && res.books && res.books.length > 0) {
        let html = '';
        res.books.forEach(book => {
          const isAvailable = book.available_copies > 0;
          const statusBadge = isAvailable
            ? `<div class="status-badge status-available"><i class="ph ph-check-circle"></i> Available</div>`
            : `<div class="status-badge status-borrowed"><i class="ph ph-clock"></i> On Loan</div>`;

          html += `
            <div class="card book-card">
              <a href="/pages/book-detail.html?id=${book.id}" class="book-cover-wrap">
                ${statusBadge}
                <img src="${book.cover_image_url || 'https://images-na.ssl-images-amazon.com/images/I/41xShCOr8sL._SX379_BO1,204,203,200_.jpg'}" alt="${book.title} Cover" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'420\' viewBox=\'0 0 300 420\'><rect width=\'100%\' height=\'100%\' fill=\'%23161924\'/><text x=\'50%\' y=\'45%\' fill=\'%23a1a1aa\' font-size=\'22\' font-family=\'sans-serif\' font-weight=\'bold\' text-anchor=\'middle\'>NeoLibrary</text></svg>';">
              </a>
              <div class="book-info">
                <a href="/pages/book-detail.html?id=${book.id}"><h3 class="book-title">${book.title}</h3></a>
                <p class="book-author">By ${book.author}</p>
                <div class="book-actions">
                  <span class="badge ${isAvailable ? 'badge-success' : 'badge-warning'}">${isAvailable ? book.available_copies + ' Copies left' : 'Reserved'}</span>
                  <a href="/pages/book-detail.html?id=${book.id}" class="btn btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;"><i class="ph ph-eye"></i> View</a>
                </div>
              </div>
            </div>
          `;
        });
        popContainer.innerHTML = html;
      } else {
        popContainer.innerHTML = '<p class="text-muted text-center" style="grid-column: 1/-1; padding: 2rem;">No books currently featured.</p>';
      }
    } catch (e) {
      console.error('Error fetching popular books:', e);
      popContainer.innerHTML = '<p class="text-muted text-center" style="grid-column: 1/-1; padding: 2rem;">Failed to load catalog previews.</p>';
    }
  }

  // Render Genres / Categories
  const catContainer = document.getElementById('categories-container');
  if (catContainer) {
    const cats = [
      { name: "Science & Tech", icon: "ph-desktop-tower", colorClass: "cat-icon-tech", desc: "Digital systems, CS & Computing" },
      { name: "History & Archives", icon: "ph-bank", colorClass: "cat-icon-history", desc: "World events & historical chronicles" },
      { name: "Classic Fiction", icon: "ph-sparkle", colorClass: "cat-icon-fiction", desc: "Timeless literary masterpieces" },
      { name: "Self Improvement", icon: "ph-brain", colorClass: "cat-icon-self", desc: "Mindset, habits & personal growth" }
    ];

    catContainer.innerHTML = cats.map(c => `
      <div class="category-card" onclick="window.location.href='/pages/books.html?genre=${encodeURIComponent(c.name)}'">
        <div class="category-icon ${c.colorClass}">
          <i class="ph ${c.icon}"></i>
        </div>
        <h3 class="category-title">${c.name}</h3>
        <p style="font-size: 0.8rem; color: var(--clr-text-faint); margin-top: 0.25rem;">${c.desc}</p>
      </div>
    `).join('');
  }
});

