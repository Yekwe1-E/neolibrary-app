const mockDb = require('../database/mockDb');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { calculateFine } = require('../utils/helpers');

class DashboardService {
  async getSystemStats() {
    const isMock = process.env.MOCK_MODE === 'true';
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    if (isMock) {
      const totalBooks = mockDb.data.books.filter(b => b.status !== 'archived').length;
      const activeBorrowings = mockDb.data.borrowings.filter(b => b.return_date === null).length;
      const overdueCount = mockDb.data.borrowings.filter(b => b.return_date === null && new Date(b.due_date) < now).length;
      const newPatrons = mockDb.data.profiles.filter(p => new Date(p.membership_date) >= thirtyDaysAgo && p.role === 'patron').length;

      // Unpaid fines total
      const totalFinesUnpaid = mockDb.data.borrowings.reduce((sum, b) => {
        const excess = b.return_date ? 0 : calculateFine(b.due_date);
        return sum + parseFloat(b.fine_amount) + excess;
      }, 0);

      // Genre distribution
      const genreCounts = {};
      mockDb.data.books.filter(b => b.status !== 'archived').forEach(b => {
        if (b.genre && Array.isArray(b.genre)) {
          b.genre.forEach(g => {
            genreCounts[g] = (genreCounts[g] || 0) + b.total_copies;
          });
        }
      });

      return {
        total_books: totalBooks,
        active_borrowings: activeBorrowings,
        overdue_loans: overdueCount,
        new_patrons_30d: newPatrons,
        outstanding_fines: totalFinesUnpaid,
        genre_distribution: genreCounts
      };
    } else {
      // 1. Total books count (non archived)
      const { count: totalBooks } = await supabaseAdmin.from('books').select('*', { count: 'exact', head: true }).neq('status', 'archived');
      
      // 2. Active borrowings
      const { count: activeBorrowings } = await supabaseAdmin.from('borrowings').select('*', { count: 'exact', head: true }).is('return_date', null);
      
      // 3. Overdues
      const { count: overdueCount } = await supabaseAdmin.from('borrowings').select('*', { count: 'exact', head: true }).is('return_date', null).lt('due_date', now.toISOString());
      
      // 4. New Patrons
      const { count: newPatrons } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'patron').gte('membership_date', thirtyDaysAgo.toISOString());

      // 5. Total outstanding fines
      const { data: unpaidLoans } = await supabaseAdmin.from('borrowings').select('due_date, fine_amount').is('return_date', null);
      const outstandingFines = (unpaidLoans || []).reduce((sum, b) => {
        const excess = calculateFine(b.due_date);
        return sum + parseFloat(b.fine_amount || 0) + excess;
      }, 0);

      // 6. Genres distribution
      const { data: allBooks } = await supabaseAdmin.from('books').select('genre, total_copies').neq('status', 'archived');
      const genreCounts = {};
      if (allBooks) {
        allBooks.forEach(b => {
          if (b.genre && Array.isArray(b.genre)) {
            b.genre.forEach(g => {
              genreCounts[g] = (genreCounts[g] || 0) + b.total_copies;
            });
          }
        });
      }

      return {
        total_books: totalBooks || 0,
        active_borrowings: activeBorrowings || 0,
        overdue_loans: overdueCount || 0,
        new_patrons_30d: newPatrons || 0,
        outstanding_fines: outstandingFines,
        genre_distribution: genreCounts
      };
    }
  }

  async getRecentActivity(limit = 10) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const logs = mockDb.data.activity_logs.slice(0, limit);
      return logs.map(l => {
        const user = mockDb.data.profiles.find(u => u.id === l.user_id);
        return {
          ...l,
          user: user ? { full_name: user.full_name, email: user.email } : null
        };
      });
    } else {
      const { data, error } = await supabaseAdmin
        .from('activity_logs')
        .select('*, user:profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return data || [];
    }
  }

  async generateReport(type) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      if (type === 'popular_books') {
        const checkouts = {};
        mockDb.data.borrowings.forEach(b => {
          checkouts[b.book_id] = (checkouts[b.book_id] || 0) + 1;
        });

        const list = Object.keys(checkouts).map(bookId => {
          const book = mockDb.data.books.find(x => x.id === bookId);
          return {
            book_id: bookId,
            title: book ? book.title : "Unknown Book",
            author: book ? book.author : "Unknown",
            checkout_count: checkouts[bookId]
          };
        });

        return list.sort((a, b) => b.checkout_count - a.checkout_count);
      } 
      
      if (type === 'borrowing_trends') {
        // Group borrowing transactions by day/month
        const trends = {};
        mockDb.data.borrowings.forEach(b => {
          const dateStr = b.borrow_date.substring(0, 10); // YYYY-MM-DD
          trends[dateStr] = (trends[dateStr] || 0) + 1;
        });

        return Object.keys(trends).map(d => ({ date: d, count: trends[d] })).sort((a,b) => a.date.localeCompare(b.date));
      }

      if (type === 'overdue_analysis') {
        const now = new Date();
        const overdues = mockDb.data.borrowings.filter(b => b.return_date === null && new Date(b.due_date) < now);
        return overdues.map(b => {
          const book = mockDb.data.books.find(x => x.id === b.book_id);
          const patron = mockDb.data.profiles.find(x => x.id === b.patron_id);
          return {
            borrowing_id: b.id,
            book_title: book?.title,
            patron_name: patron?.full_name,
            due_date: b.due_date,
            days_overdue: Math.ceil((now.getTime() - new Date(b.due_date).getTime()) / (1000 * 3600 * 24)),
            fine_accumulated: calculateFine(b.due_date)
          };
        });
      }

      throw new Error(`Report type '${type}' not recognized.`);
    } else {
      if (type === 'popular_books') {
        // SQL query to group filings by checkout
        const { data, error } = await supabaseAdmin.rpc('get_popular_books_report');
        if (!error && data) return data;

        // Fallback in JS if RPC is not loaded in Supabase
        const { data: borrowings } = await supabaseAdmin.from('borrowings').select('book_id, book:books(title, author)');
        const checkouts = {};
        if (borrowings) {
          borrowings.forEach(b => {
            if (b.book_id) {
              if (!checkouts[b.book_id]) {
                checkouts[b.book_id] = { title: b.book?.title, author: b.book?.author, count: 0 };
              }
              checkouts[b.book_id].count++;
            }
          });
        }
        return Object.keys(checkouts).map(id => ({
          book_id: id,
          title: checkouts[id].title,
          author: checkouts[id].author,
          checkout_count: checkouts[id].count
        })).sort((a, b) => b.checkout_count - a.checkout_count);
      }

      if (type === 'borrowing_trends') {
        const { data: borrowings } = await supabaseAdmin.from('borrowings').select('borrow_date');
        const trends = {};
        if (borrowings) {
          borrowings.forEach(b => {
            const dateStr = b.borrow_date.substring(0, 10);
            trends[dateStr] = (trends[dateStr] || 0) + 1;
          });
        }
        return Object.keys(trends).map(d => ({ date: d, count: trends[d] })).sort((a,b) => a.date.localeCompare(b.date));
      }

      if (type === 'overdue_analysis') {
        const now = new Date();
        const { data: overdues } = await supabaseAdmin
          .from('borrowings')
          .select('id, due_date, book:books(title), patron:profiles(full_name)')
          .is('return_date', null)
          .lt('due_date', now.toISOString());

        return (overdues || []).map(b => {
          const daysOverdue = Math.ceil((now.getTime() - new Date(b.due_date).getTime()) / (1000 * 3600 * 24));
          return {
            borrowing_id: b.id,
            book_title: b.book?.title,
            patron_name: b.patron?.full_name,
            due_date: b.due_date,
            days_overdue: daysOverdue,
            fine_accumulated: daysOverdue * 50
          };
        });
      }

      throw new Error(`Report type '${type}' not recognized.`);
    }
  }
}

module.exports = new DashboardService();
