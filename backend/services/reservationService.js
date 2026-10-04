const mockDb = require('../database/mockDb');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { BUSINESS_RULES } = require('../utils/constants');
const bookService = require('./bookService');

class ReservationService {
  async getReservations(userId, role, filters = {}) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      let rList = [...mockDb.data.reservations];

      if (role === 'patron') {
        rList = rList.filter(r => r.patron_id === userId);
      } else if (filters.patron_id) {
        rList = rList.filter(r => r.patron_id === filters.patron_id);
      }

      const populated = rList.map(r => {
        const book = mockDb.data.books.find(x => x.id === r.book_id);
        const patron = mockDb.data.profiles.find(x => x.id === r.patron_id);
        return {
          ...r,
          book: book ? { title: book.title, author: book.author, cover_image_url: book.cover_image_url, isbn: book.isbn } : null,
          patron: patron ? { full_name: patron.full_name, email: patron.email } : null
        };
      });

      // Sort by date desc
      populated.sort((a, b) => new Date(b.reservation_date) - new Date(a.reservation_date));
      return populated;
    } else {
      let query = supabaseAdmin.from('reservations').select(`
        *,
        book:books(title, author, cover_image_url, isbn),
        patron:profiles(full_name, email)
      `);

      if (role === 'patron') {
        query = query.eq('patron_id', userId);
      } else if (filters.patron_id) {
        query = query.eq('patron_id', filters.patron_id);
      }

      const { data, error } = await query.order('reservation_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }
  }

  async getReservationById(id) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const r = mockDb.data.reservations.find(x => x.id === id);
      return r || null;
    } else {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code === 'PGRST116') return null;
      if (error) throw new Error(error.message);
      return data;
    }
  }

  async createReservation(patronId, bookId, userId) {
    const book = await bookService.getBookById(bookId);
    if (!book) throw new Error("Target book not found.");
    if (book.status === 'archived') throw new Error("This book is archived and cannot be reserved.");
    
    // Rule: Can only reserve if available_copies == 0
    if (book.available_copies > 0) {
      throw new Error(`This book has ${book.available_copies} copies currently available on shelves. Please borrow the book directly rather than reserving.`);
    }

    const isMock = process.env.MOCK_MODE === 'true';
    let activeReservations = [];

    if (isMock) {
      activeReservations = mockDb.data.reservations.filter(r => r.patron_id === patronId && r.status === 'pending');
    } else {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('id')
        .eq('patron_id', patronId)
        .eq('status', 'pending');
      
      if (error) throw new Error(error.message);
      activeReservations = data || [];
    }

    // Rule: Max 3 active reservations per patron
    if (activeReservations.length >= BUSINESS_RULES.MAX_ACTIVE_RESERVATIONS) {
      throw new Error(`Reservation limit reached. You can only have up to ${BUSINESS_RULES.MAX_ACTIVE_RESERVATIONS} active pending reservations.`);
    }

    const isAlreadyReserved = isMock 
      ? mockDb.data.reservations.some(r => r.book_id === bookId && r.patron_id === patronId && r.status === 'pending')
      : (await supabaseAdmin.from('reservations').select('id').eq('book_id', bookId).eq('patron_id', patronId).eq('status', 'pending')).data?.length > 0;

    if (isAlreadyReserved) {
      throw new Error("You already have an active pending reservation for this book.");
    }

    const newReservation = {
      book_id: bookId,
      patron_id: patronId,
      reservation_date: new Date().toISOString(),
      status: 'pending',
      notification_sent: false
    };

    if (isMock) {
      const reservationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 17);
      const resObj = {
        id: reservationId,
        ...newReservation,
        created_at: new Date().toISOString()
      };
      
      mockDb.data.reservations.push(resObj);
      mockDb.logActivity(userId, 'create_reservation', 'reservations', reservationId, { book_title: book.title });
      mockDb.save();
      return resObj;
    } else {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .insert(newReservation)
        .select()
        .single();
      
      if (error) throw new Error(error.message);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'create_reservation',
        entity_type: 'reservations',
        entity_id: data.id,
        details: { book_title: book.title }
      });

      return data;
    }
  }

  async cancelReservation(reservationId, patronId) {
    const reservation = await this.getReservationById(reservationId);
    if (!reservation) throw new Error("Reservation not found.");
    if (reservation.patron_id !== patronId) throw new Error("Access denied. You can only cancel your own reservations.");
    if (reservation.status !== 'pending' && reservation.status !== 'fulfilled') {
      throw new Error(`Cannot cancel reservation current status is: '${reservation.status}'`);
    }

    const isMock = process.env.MOCK_MODE === 'true';

    // If reservation was 'fulfilled' (copy was held for them) and gets cancelled, we must trigger next-in-queue or increment stock!
    if (isMock) {
      const idx = mockDb.data.reservations.findIndex(r => r.id === reservationId);
      const rObj = mockDb.data.reservations[idx];
      const oldStatus = rObj.status;
      rObj.status = 'cancelled';

      const book = mockDb.data.books.find(x => x.id === rObj.book_id);

      if (oldStatus === 'fulfilled') {
        const nextPending = mockDb.data.reservations
          .filter(nr => nr.book_id === rObj.book_id && nr.status === 'pending')
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

      mockDb.logActivity(patronId, 'cancel_reservation', 'reservations', reservationId, { book_title: book?.title });
      mockDb.save();
      return rObj;
    } else {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);

      // Trigger next in queue if cancelled was fulfilled
      if (reservation.status === 'fulfilled') {
        const { data: nextQueue } = await supabaseAdmin
          .from('reservations')
          .select('*')
          .eq('book_id', reservation.book_id)
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
          // Put back in public stock
          const { data: book } = await supabaseAdmin.from('books').select('available_copies, total_copies').eq('id', reservation.book_id).single();
          if (book) {
            const copies = Math.min(book.total_copies, book.available_copies + 1);
            await supabaseAdmin.from('books').update({ available_copies: copies, status: 'available' }).eq('id', reservation.book_id);
          }
        }
      }

      await supabaseAdmin.from('activity_logs').insert({
        user_id: patronId,
        action: 'cancel_reservation',
        entity_type: 'reservations',
        entity_id: reservationId
      });

      return data;
    }
  }

  async fulfillReservation(reservationId, userId) {
    // Allows admin/librarians to mark a reservation as fulfilled manually
    const reservation = await this.getReservationById(reservationId);
    if (!reservation) throw new Error("Reservation not found.");
    if (reservation.status !== 'pending') throw new Error(`Cannot fulfill reservation that is in status '${reservation.status}'`);

    const expiry = new Date();
    expiry.setHours(expiry.getHours() + BUSINESS_RULES.RESERVATION_EXPIRY_HOURS);

    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.reservations.findIndex(r => r.id === reservationId);
      const rObj = mockDb.data.reservations[idx];
      rObj.status = 'fulfilled';
      rObj.expiry_date = expiry.toISOString();

      const book = mockDb.data.books.find(x => x.id === rObj.book_id);
      book.status = 'reserved';

      mockDb.notify(
        rObj.patron_id, 
        'reservation_ready', 
        'Reservation Ready', 
        `Your reservation for "${book.title}" is ready! You have 48 hours to collect it.`
      );

      mockDb.logActivity(userId, 'fulfill_reservation', 'reservations', reservationId, { book_title: book.title });
      mockDb.save();
      return rObj;
    } else {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'fulfilled',
          expiry_date: expiry.toISOString()
        })
        .eq('id', reservationId)
        .select()
        .single();
      
      if (error) throw new Error(error.message);

      await supabaseAdmin.from('notifications').insert({
        user_id: data.patron_id,
        type: 'reservation_ready',
        title: 'Reservation Ready',
        message: 'Your reservation has been fulfilled by system staff. You have 48 hours to pick up the book.'
      });

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'fulfill_reservation',
        entity_type: 'reservations',
        entity_id: reservationId
      });

      return data;
    }
  }
}

module.exports = new ReservationService();
