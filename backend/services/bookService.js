const mockDb = require('../database/mockDb');
const { supabase, supabaseAdmin } = require('../config/supabase');

class BookService {
  async getBooks(filters = {}) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      let books = [...mockDb.data.books];

      // Exclude archived unless requested
      if (!filters.includeArchived) {
        books = books.filter(b => b.status !== 'archived');
      }

      // Search keyword filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        books = books.filter(b => 
          b.title.toLowerCase().includes(query) || 
          b.author.toLowerCase().includes(query) || 
          (b.isbn && b.isbn.includes(query))
        );
      }

      // Genre filter
      if (filters.genre) {
        books = books.filter(b => b.genre && b.genre.some(g => g.toLowerCase() === filters.genre.toLowerCase()));
      }

      // Availability filter
      if (filters.availability) {
        if (filters.availability === 'available') {
          books = books.filter(b => b.available_copies > 0);
        } else if (filters.availability === 'out_of_stock') {
          books = books.filter(b => b.available_copies === 0);
        }
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const startIndex = (page - 1) * limit;
      const paginatedBooks = books.slice(startIndex, startIndex + limit);

      return {
        books: paginatedBooks,
        total: books.length,
        page,
        limit,
        pages: Math.ceil(books.length / limit)
      };
    } else {
      // Supabase Query Builder
      let query = supabase.from('books').select('*', { count: 'exact' });

      if (!filters.includeArchived) {
        query = query.neq('status', 'archived');
      }

      if (filters.search) {
        const term = `%${filters.search}%`;
        query = query.or(`title.ilike.${term},author.ilike.${term},isbn.ilike.${term}`);
      }

      if (filters.genre) {
        // genre column is TEXT[]
        query = query.contains('genre', [filters.genre]);
      }

      if (filters.availability) {
        if (filters.availability === 'available') {
          query = query.gt('available_copies', 0);
        } else if (filters.availability === 'out_of_stock') {
          query = query.eq('available_copies', 0);
        }
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, count, error } = await query
        .order('title', { ascending: true })
        .range(from, to);

      if (error) throw new Error(error.message);

      return {
        books: data || [],
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit)
      };
    }
  }

  async getBookById(id) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const book = mockDb.data.books.find(b => b.id === id);
      return book || null;
    } else {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code === 'PGRST116') return null; // Not found
      if (error) throw new Error(error.message);
      return data;
    }
  }

  async createBook(bookData, userId) {
    const isMock = process.env.MOCK_MODE === 'true';
    const newBook = {
      ...bookData,
      id: isMock ? (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 17)) : undefined,
      available_copies: bookData.total_copies,
      status: bookData.status || 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (!isMock) delete newBook.id;

    if (isMock) {
      // Check ISBN uniqueness
      const existing = mockDb.data.books.find(b => b.isbn === bookData.isbn && b.status !== 'archived');
      if (existing) throw new Error(`Book with ISBN ${bookData.isbn} already exists.`);

      mockDb.data.books.push(newBook);
      mockDb.logActivity(userId, 'create_book', 'books', newBook.id, { title: newBook.title });
      mockDb.save();
      return newBook;
    } else {
      // Real database check via service client
      const { data: existing } = await supabaseAdmin
        .from('books')
        .select('id')
        .eq('isbn', bookData.isbn)
        .neq('status', 'archived')
        .maybeSingle();

      if (existing) throw new Error(`Book with ISBN ${bookData.isbn} already exists.`);

      const { data, error } = await supabaseAdmin
        .from('books')
        .insert(newBook)
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Audit Log
      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'create_book',
        entity_type: 'books',
        entity_id: data.id,
        details: { title: data.title }
      });

      return data;
    }
  }

  async updateBook(id, bookData, userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const index = mockDb.data.books.findIndex(b => b.id === id);
      if (index === -1) return null;

      // Check ISBN uniqueness if altered
      if (bookData.isbn && bookData.isbn !== mockDb.data.books[index].isbn) {
        const existing = mockDb.data.books.find(b => b.isbn === bookData.isbn && b.id !== id && b.status !== 'archived');
        if (existing) throw new Error(`Another book with ISBN ${bookData.isbn} already exists.`);
      }

      // Compute status based on stock adjustments
      const currentBook = mockDb.data.books[index];
      const newTotal = bookData.total_copies !== undefined ? parseInt(bookData.total_copies) : currentBook.total_copies;
      const copiesDiff = newTotal - currentBook.total_copies;
      let newAvailable = currentBook.available_copies + copiesDiff;
      if (newAvailable < 0) newAvailable = 0;

      const updated = {
        ...currentBook,
        ...bookData,
        available_copies: newAvailable,
        status: newAvailable > 0 ? 'available' : 'borrowed',
        updated_at: new Date().toISOString()
      };

      mockDb.data.books[index] = updated;
      mockDb.logActivity(userId, 'update_book', 'books', id, { title: updated.title });
      mockDb.save();
      return updated;
    } else {
      const current = await this.getBookById(id);
      if (!current) return null;

      if (bookData.isbn && bookData.isbn !== current.isbn) {
        const { data: existing } = await supabaseAdmin
          .from('books')
          .select('id')
          .eq('isbn', bookData.isbn)
          .neq('id', id)
          .neq('status', 'archived')
          .maybeSingle();

        if (existing) throw new Error(`Another book with ISBN ${bookData.isbn} already exists.`);
      }

      const newTotal = bookData.total_copies !== undefined ? parseInt(bookData.total_copies) : current.total_copies;
      const copiesDiff = newTotal - current.total_copies;
      let newAvailable = current.available_copies + copiesDiff;
      if (newAvailable < 0) newAvailable = 0;

      const payload = {
        ...bookData,
        available_copies: newAvailable,
        status: newAvailable > 0 ? 'available' : 'borrowed',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('books')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'update_book',
        entity_type: 'books',
        entity_id: id,
        details: { title: data.title }
      });

      return data;
    }
  }

  async deleteBook(id, userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const book = mockDb.data.books.find(b => b.id === id);
      if (!book) return false;

      // Soft delete: status -> archived
      book.status = 'archived';
      book.updated_at = new Date().toISOString();
      mockDb.logActivity(userId, 'archive_book', 'books', id, { title: book.title });
      mockDb.save();
      return true;
    } else {
      const { data, error } = await supabaseAdmin
        .from('books')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return false;

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'archive_book',
        entity_type: 'books',
        entity_id: id,
        details: { title: data.title }
      });

      return true;
    }
  }

  async updateBookCover(id, coverUrl, userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const book = mockDb.data.books.find(b => b.id === id);
      if (!book) return null;

      book.cover_image_url = coverUrl;
      book.updated_at = new Date().toISOString();
      mockDb.logActivity(userId, 'upload_cover', 'books', id, { cover_image_url: coverUrl });
      mockDb.save();
      return book;
    } else {
      const { data, error } = await supabaseAdmin
        .from('books')
        .update({ cover_image_url: coverUrl, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'upload_cover',
        entity_type: 'books',
        entity_id: id,
        details: { cover_image_url: coverUrl }
      });

      return data;
    }
  }
}

module.exports = new BookService();
