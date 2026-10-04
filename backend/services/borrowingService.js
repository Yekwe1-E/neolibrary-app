const mockDb = require('../database/mockDb');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { BUSINESS_RULES } = require('../utils/constants');
const { calculateFine } = require('../utils/helpers');
const bookService = require('./bookService');

class BorrowingService {
  async getBorrowings(userId, role, filters = {}) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      let bList = [...mockDb.data.borrowings];

      // Patron role filters borrowings to themselves only
      if (role === 'patron') {
        bList = bList.filter(b => b.patron_id === userId);
      } else if (filters.patron_id) {
        // Admin or Librarian filtering by specific patron
        bList = bList.filter(b => b.patron_id === filters.patron_id);
      }

      if (filters.status) {
        bList = bList.filter(b => b.status === filters.status);
      }

      // Populate books details for UI ease
      const populated = bList.map(b => {
        const book = mockDb.data.books.find(x => x.id === b.book_id);
        const patron = mockDb.data.profiles.find(x => x.id === b.patron_id);
        return {
          ...b,
          book: book ? { title: book.title, author: book.author, cover_image_url: book.cover_image_url, isbn: book.isbn } : null,
          patron: patron ? { full_name: patron.full_name, email: patron.email } : null
        };
      });

      // Sort by borrow date desc
      populated.sort((a, b) => new Date(b.borrow_date) - new Date(a.borrow_date));
      return populated;
    } else {
      let query = supabase.from('borrowings').select(`
        *,
        book:books(title, author, cover_image_url, isbn),
        patron:profiles(full_name, email)
      `);

      if (role === 'patron') {
        query = query.eq('patron_id', userId);
      } else if (filters.patron_id) {
        query = query.eq('patron_id', filters.patron_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('borrow_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }
  }

  async getBorrowingById(id) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const b = mockDb.data.borrowings.find(x => x.id === id);
      if (!b) return null;
      const book = mockDb.data.books.find(x => x.id === b.book_id);
      const patron = mockDb.data.profiles.find(x => x.id === b.patron_id);
      return {
        ...b,
        book: book ? { id: book.id, title: book.title, author: book.author, cover_image_url: book.cover_image_url } : null,
        patron: patron ? { id: patron.id, full_name: patron.full_name, email: patron.email } : null
      };
    } else {
      const { data, error } = await supabaseAdmin
        .from('borrowings')
        .select(`
          *,
          book:books(id, title, author, cover_image_url),
          patron:profiles(id, full_name, email)
        `)
        .eq('id', id)
        .single();
      
      if (error && error.code === 'PGRST116') return null;
      if (error) throw new Error(error.message);
      return data;
    }
  }

  // Pre-checkout eligibility checks
  async checkEligibility(patronId) {
    const isMock = process.env.MOCK_MODE === 'true';
    let activeLoans = [];
    let profilesTable = null;

    if (isMock) {
      activeLoans = mockDb.data.borrowings.filter(b => b.patron_id === patronId && b.return_date === null);
      const profile = mockDb.data.profiles.find(p => p.id === patronId);
      if (!profile) throw new Error("Patron profile not found.");

      // Calculate unpaid fines
      const totalFines = activeLoans.reduce((sum, b) => {
        const calculated = calculateFine(b.due_date);
        return sum + calculated + parseFloat(b.fine_amount || 0);
      }, 0);

      const hasOverdue = activeLoans.some(b => new Date(b.due_date) < new Date());

      return {
        activeCount: activeLoans.length,
        hasOverdue,
        totalFines,
        status: profile.status,
        eligible: activeLoans.length < BUSINESS_RULES.MAX_ACTIVE_BORROWINGS && 
                  !hasOverdue && 
                  totalFines <= BUSINESS_RULES.FINE_BLOCKED_AMOUNT &&
                  profile.status === 'active'
      };
    } else {
      // Fetch active borrowings
      const { data: loans, error: errLoans } = await supabaseAdmin
        .from('borrowings')
        .select('due_date, fine_amount')
        .eq('patron_id', patronId)
        .is('return_date', null);

      if (errLoans) throw new Error(errLoans.message);

      const { data: profile, error: errProf } = await supabaseAdmin
        .from('profiles')
        .select('status')
        .eq('id', patronId)
        .single();

      if (errProf) throw new Error(errProf.message);

      const totalFines = (loans || []).reduce((sum, b) => {
        const calculated = calculateFine(b.due_date);
        return sum + calculated + parseFloat(b.fine_amount || 0);
      }, 0);

      const hasOverdue = (loans || []).some(b => new Date(b.due_date) < new Date());

      return {
        activeCount: loans.length,
        hasOverdue,
        totalFines,
        status: profile.status,
        eligible: loans.length < BUSINESS_RULES.MAX_ACTIVE_BORROWINGS && 
                  !hasOverdue && 
                  totalFines <= BUSINESS_RULES.FINE_BLOCKED_AMOUNT &&
                  profile.status === 'active'
      };
    }
  }

  async checkoutBook(patronId, bookId, userId) {
    const eligibility = await this.checkEligibility(patronId);
    if (!eligibility.eligible) {
      if (eligibility.status !== 'active') throw new Error(`Borrowing failed. Patron account status is '${eligibility.status}'.`);
      if (eligibility.activeCount >= BUSINESS_RULES.MAX_ACTIVE_BORROWINGS) throw new Error(`Borrowing failed. Patron currently has ${eligibility.activeCount} active loans (limit is ${BUSINESS_RULES.MAX_ACTIVE_BORROWINGS}).`);
      if (eligibility.hasOverdue) throw new Error(`Borrowing failed. Patron has overdue books that must be returned.`);
      if (eligibility.totalFines > BUSINESS_RULES.FINE_BLOCKED_AMOUNT) throw new Error(`Borrowing failed. Patron has unpaid fines (₦${eligibility.totalFines}) exceeding the limit of ₦${BUSINESS_RULES.FINE_BLOCKED_AMOUNT}.`);
      throw new Error(`Borrowing failed helper check.`);
    }

    // Business Rule: Prevent patron from borrowing the same book twice (duplicate checkout guard)
    const isMockCheck = process.env.MOCK_MODE === 'true';
    if (isMockCheck) {
      const alreadyBorrowed = mockDb.data.borrowings.find(
        b => b.patron_id === patronId && b.book_id === bookId && b.return_date === null
      );
      if (alreadyBorrowed) {
        throw new Error('You already have an active loan for this book. Please return it before borrowing again.');
      }
    } else {
      const { data: existing } = await supabaseAdmin
        .from('borrowings')
        .select('id')
        .eq('patron_id', patronId)
        .eq('book_id', bookId)
        .is('return_date', null)
        .maybeSingle();
      if (existing) {
        throw new Error('You already have an active loan for this book. Please return it before borrowing again.');
      }
    }

    const book = await bookService.getBookById(bookId);
    if (!book) throw new Error("Target book not found.");
    if (book.status === 'archived') throw new Error("This book is archived and cannot be borrowed.");
    if (book.available_copies <= 0) {
      throw new Error(`This book has no available copies. Please reserve it instead.`);
    }

    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(borrowDate.getDate() + BUSINESS_RULES.STANDARD_LOAN_PERIOD_DAYS);

    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const borrowId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 17);
      const newBorrow = {
        id: borrowId,
        book_id: bookId,
        patron_id: patronId,
        borrow_date: borrowDate.toISOString(),
        due_date: dueDate.toISOString(),
        return_date: null,
        status: 'active',
        renewal_count: 0,
        fine_amount: 0.00,
        notes: `Checked out by librarian/admin ID: ${userId}`,
        created_at: new Date().toISOString()
      };

      // Postgres trigger mock: decrement available copies
      const bookIndex = mockDb.data.books.findIndex(b => b.id === bookId);
      mockDb.data.books[bookIndex].available_copies -= 1;
      if (mockDb.data.books[bookIndex].available_copies === 0) {
        mockDb.data.books[bookIndex].status = 'borrowed';
      }

      // Check if this patron had a pending/fulfilled reservation for this book, and mark it as fulfilled
      const reservation = mockDb.data.reservations.find(r => r.book_id === bookId && r.patron_id === patronId && ['pending', 'fulfilled'].includes(r.status));
      if (reservation) {
        reservation.status = 'fulfilled';
      }

      mockDb.data.borrowings.push(newBorrow);
      mockDb.logActivity(userId, 'checkout_book', 'borrowings', borrowId, { book_title: book.title, patron_id: patronId });
      mockDb.save();
      return newBorrow;
    } else {
      // In Supabase, the triggers execute decrementing available copies.
      const newBorrow = {
        book_id: bookId,
        patron_id: patronId,
        due_date: dueDate.toISOString(),
        status: 'active',
        notes: `Checked out by Admin/Staff ID: ${userId}`
      };

      // Fulfill any reservation if exists
      await supabaseAdmin
        .from('reservations')
        .update({ status: 'fulfilled' })
        .eq('book_id', bookId)
        .eq('patron_id', patronId)
        .in('status', ['pending', 'fulfilled']);

      const { data, error } = await supabaseAdmin
        .from('borrowings')
        .insert(newBorrow)
        .select()
        .single();
      
      if (error) throw new Error(error.message);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'checkout_book',
        entity_type: 'borrowings',
        entity_id: data.id,
        details: { book_title: book.title, patron_id: patronId }
      });

      return data;
    }
  }

  async returnBook(borrowingId, userId, notes = '') {
    const borrowing = await this.getBorrowingById(borrowingId);
    if (!borrowing) throw new Error("Borrowing transaction not found.");
    if (borrowing.return_date) throw new Error("This book has already been returned.");

    const returnDate = new Date();
    const mockFine = calculateFine(borrowing.due_date, returnDate);

    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.borrowings.findIndex(b => b.id === borrowingId);
      const bObj = mockDb.data.borrowings[idx];
      bObj.return_date = returnDate.toISOString();
      bObj.status = 'returned';
      bObj.fine_amount = parseFloat(bObj.fine_amount) + mockFine;
      if (notes) bObj.notes = (bObj.notes ? bObj.notes + " | " : "") + notes;

      // Increment copies
      const bookIdx = mockDb.data.books.findIndex(b => b.id === borrowing.book_id);
      const book = mockDb.data.books[bookIdx];
      
      // Auto reservation trigger mock: Check if there's a pending reservation for this book
      const reservations = mockDb.data.reservations
        .filter(r => r.book_id === borrowing.book_id && r.status === 'pending')
        .sort((a,b) => new Date(a.reservation_date) - new Date(b.reservation_date));

      if (reservations.length > 0) {
        // Hold the copy for the oldest reservation!
        const reservation = reservations[0];
        reservation.status = 'fulfilled';
        reservation.expiry_date = new Date(Date.now() + BUSINESS_RULES.RESERVATION_EXPIRY_HOURS * 3600 * 1000).toISOString();
        
        // Notify patron
        mockDb.notify(
          reservation.patron_id, 
          'reservation_ready', 
          'Reservation Ready', 
          `The book "${book.title}" you reserved is now available! Please borrow it within 48 hours.`
        );

        book.status = 'reserved';
      } else {
        book.available_copies += 1;
        book.status = 'available';
      }

      mockDb.logActivity(userId, 'return_book', 'borrowings', borrowingId, { book_title: book.title });
      mockDb.save();
      return bObj;
    } else {
      // In Supabase, database triggers increment standard copies automatically on return.
      const payload = {
        return_date: returnDate.toISOString(),
        status: 'returned',
        fine_amount: parseFloat(borrowing.fine_amount) + mockFine,
        notes: borrowing.notes ? `${borrowing.notes} | Returned info: ${notes}` : `Returned info: ${notes}`
      };

      const { data, error } = await supabaseAdmin
        .from('borrowings')
        .update(payload)
        .eq('id', borrowingId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);

      // Handle Reservation Queue: Find oldest pending reservation
      const { data: pendingReservations } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('book_id', borrowing.book_id)
        .eq('status', 'pending')
        .order('reservation_date', { ascending: true })
        .limit(1);

      if (pendingReservations && pendingReservations.length > 0) {
        const oldest = pendingReservations[0];
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + BUSINESS_RULES.RESERVATION_EXPIRY_HOURS);

        // Fulfill reservation and notify
        await supabaseAdmin
          .from('reservations')
          .update({ 
            status: 'fulfilled', 
            expiry_date: expiry.toISOString() 
          })
          .eq('id', oldest.id);

        // Notify patron via db triggers or manual insert
        await supabaseAdmin.from('notifications').insert({
          user_id: oldest.patron_id,
          type: 'reservation_ready',
          title: 'Reservation Ready',
          message: `The book you reserved is now available! You have 48 hours to pick it up.`
        });
      }

      // Add to activity logs
      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'return_book',
        entity_type: 'borrowings',
        entity_id: borrowingId,
        details: { book_title: borrowing.book?.title }
      });

      return data;
    }
  }

  async renewBook(borrowingId, patronId) {
    const borrowing = await this.getBorrowingById(borrowingId);
    if (!borrowing) throw new Error("Borrowing transaction not found.");
    if (borrowing.patron_id !== patronId) throw new Error("Access denied. You can only renew your own borrowings.");
    if (borrowing.return_date) throw new Error("This book has already been returned.");
    if (borrowing.renewal_count >= BUSINESS_RULES.MAX_RENEWALS) {
      throw new Error(`Renewal limit reached. You can only renew a book up to ${BUSINESS_RULES.MAX_RENEWALS} times.`);
    }

    // Block renewal if overdue or unpaid fines exist
    const isMock = process.env.MOCK_MODE === 'true';
    if (new Date(borrowing.due_date) < new Date()) {
      throw new Error("This book is already overdue and cannot be renewed. Please return it to the library.");
    }

    // Extended due date: 7 more days
    const currentDue = new Date(borrowing.due_date);
    currentDue.setDate(currentDue.getDate() + BUSINESS_RULES.RENEWAL_PERIOD_DAYS);

    if (isMock) {
      const idx = mockDb.data.borrowings.findIndex(b => b.id === borrowingId);
      const bObj = mockDb.data.borrowings[idx];
      bObj.due_date = currentDue.toISOString();
      bObj.renewal_count += 1;
      bObj.status = 'renewed';

      mockDb.logActivity(patronId, 'renew_book', 'borrowings', borrowingId, { book_title: borrowing.book?.title });
      mockDb.save();
      return bObj;
    } else {
      const { data, error } = await supabaseAdmin
        .from('borrowings')
        .update({
          due_date: currentDue.toISOString(),
          renewal_count: borrowing.renewal_count + 1,
          status: 'renewed'
        })
        .eq('id', borrowingId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: patronId,
        action: 'renew_book',
        entity_type: 'borrowings',
        entity_id: borrowingId,
        details: { book_title: borrowing.book?.title }
      });

      return data;
    }
  }

  async getOverdueBorrowings() {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const now = new Date();
      const overdue = mockDb.data.borrowings.filter(b => b.return_date === null && new Date(b.due_date) < now);
      
      return overdue.map(b => {
        const book = mockDb.data.books.find(x => x.id === b.book_id);
        const patron = mockDb.data.profiles.find(x => x.id === b.patron_id);
        return {
          ...b,
          fine_amount: parseFloat(b.fine_amount) + calculateFine(b.due_date),
          book: book ? { title: book.title, author: book.author, isbn: book.isbn } : null,
          patron: patron ? { full_name: patron.full_name, email: patron.email } : null
        };
      });
    } else {
      const loggerTime = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('borrowings')
        .select(`
          *,
          book:books(title, author, isbn),
          patron:profiles(full_name, email)
        `)
        .is('return_date', null)
        .lt('due_date', loggerTime);
      
      if (error) throw new Error(error.message);

      return (data || []).map(b => ({
        ...b,
        fine_amount: parseFloat(b.fine_amount) + calculateFine(b.due_date)
      }));
    }
  }

  async systemCalculateOverduesAndFines() {
    // Cron logic simulation
    const isMock = process.env.MOCK_MODE === 'true';
    console.log("Daily system cron calculation started...");

    if (isMock) {
      let fineUpdates = 0;
      const now = new Date();

      mockDb.data.borrowings.forEach(b => {
        if (b.return_date === null) {
          const due = new Date(b.due_date);
          if (due < now) {
            b.status = 'overdue';
            const oldFine = parseFloat(b.fine_amount || 0);
            const newFine = calculateFine(b.due_date);
            if (newFine !== oldFine) {
              b.fine_amount = newFine;
              fineUpdates++;
            }
          }
        }
      });

      // Daily check for expired reservations
      let expiredReservations = 0;
      mockDb.data.reservations.forEach(r => {
        if (r.status === 'fulfilled' && r.expiry_date && new Date(r.expiry_date) < now) {
          r.status = 'expired';
          expiredReservations++;
          
          // Re-adjust book status back to available or borrow next in queue
          const book = mockDb.data.books.find(x => x.id === r.book_id);
          if (book) {
            const nextPending = mockDb.data.reservations
              .filter(nr => nr.book_id === r.book_id && nr.status === 'pending')
              .sort((a,b) => new Date(a.reservation_date) - new Date(b.reservation_date));

            if (nextPending.length > 0) {
              const oldest = nextPending[0];
              oldest.status = 'fulfilled';
              oldest.expiry_date = new Date(Date.now() + BUSINESS_RULES.RESERVATION_EXPIRY_HOURS * 3600 * 1000).toISOString();
              
              mockDb.notify(oldest.patron_id, 'reservation_ready', 'Reservation Ready', `A reserved copy of "${book.title}" is ready for you! 48h collect window.`);
            } else {
              book.available_copies += 1;
              book.status = 'available';
            }
          }
        }

        // Send reminders 3 days and 1 day before due
        if (r.status === 'pending' && !r.notification_sent) {
          // generic notifications logic
        }
      });

      if (fineUpdates > 0 || expiredReservations > 0) {
        mockDb.save();
      }
      return { fineUpdates, expiredReservations };
    } else {
      // For Supabase, executing offline Javascript calculations
      const now = new Date();
      const loggerTime = now.toISOString();

      // Find active recordings past due date
      const { data: overdues } = await supabaseAdmin
        .from('borrowings')
        .select('*')
        .is('return_date', null)
        .lt('due_date', loggerTime);

      let fineUpdates = 0;
      if (overdues) {
        for (const item of overdues) {
          const expectedFine = calculateFine(item.due_date);
          if (expectedFine > 0) {
            await supabaseAdmin
              .from('borrowings')
              .update({ status: 'overdue', fine_amount: expectedFine })
              .eq('id', item.id);
            fineUpdates++;
          }
        }
      }

      // Expired reservations
      const { data: expiredList } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('status', 'fulfilled')
        .lt('expiry_date', loggerTime);

      let expiredReservations = 0;
      if (expiredList) {
        for (const res of expiredList) {
          await supabaseAdmin
            .from('reservations')
            .update({ status: 'expired' })
            .eq('id', res.id);
          expiredReservations++;

          // Check if another is in queue
          const { data: nextQueue } = await supabaseAdmin
            .from('reservations')
            .select('*')
            .eq('book_id', res.book_id)
            .eq('status', 'pending')
            .order('reservation_date', { ascending: true })
            .limit(1);

          if (nextQueue && nextQueue.length > 0) {
            const oldest = nextQueue[0];
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + BUSINESS_RULES.RESERVATION_EXPIRY_HOURS);

            await supabaseAdmin
              .from('reservations')
              .update({ status: 'fulfilled', expiry_date: expiry.toISOString() })
              .eq('id', oldest.id);

            await supabaseAdmin.from('notifications').insert({
              user_id: oldest.patron_id,
              type: 'reservation_ready',
              title: 'Reservation Ready',
              message: `The book you reserved is now available! Please pick it up within 48 hours.`
            });
          } else {
            // Increment book copies
            const { data: book } = await supabaseAdmin.from('books').select('available_copies, total_copies').eq('id', res.book_id).single();
            if (book) {
              const copies = Math.min(book.total_copies, book.available_copies + 1);
              await supabaseAdmin.from('books').update({ available_copies: copies, status: 'available' }).eq('id', res.book_id);
            }
          }
        }
      }

      return { fineUpdates, expiredReservations };
    }
  }
}

module.exports = new BorrowingService();
