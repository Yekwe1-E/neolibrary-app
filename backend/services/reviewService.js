const mockDb = require('../database/mockDb');
const { supabase, supabaseAdmin } = require('../config/supabase');

class ReviewService {
  async getBookReviews(bookId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const rList = mockDb.data.reviews.filter(r => r.book_id === bookId);
      return rList.map(r => {
        const patron = mockDb.data.profiles.find(x => x.id === r.patron_id);
        return {
          ...r,
          patron: patron ? { full_name: patron.full_name, email: patron.email, avatar_url: patron.avatar_url } : null
        };
      });
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, patron:profiles(full_name, email, avatar_url)')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    }
  }

  async getReviewById(id) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      return mockDb.data.reviews.find(r => r.id === id) || null;
    } else {
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code === 'PGRST116') return null;
      if (error) throw new Error(error.message);
      return data;
    }
  }

  async addReview(bookId, patronId, rating, comment) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      // Check existing unique constraint
      const existing = mockDb.data.reviews.find(r => r.book_id === bookId && r.patron_id === patronId);
      if (existing) throw new Error("You have already reviewed this book. Please edit your existing review instead.");

      const newReview = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 17),
        book_id: bookId,
        patron_id: patronId,
        rating: parseInt(rating),
        comment,
        created_at: new Date().toISOString()
      };

      mockDb.data.reviews.push(newReview);
      mockDb.save();
      return newReview;
    } else {
      const newReview = {
        book_id: bookId,
        patron_id: patronId,
        rating: parseInt(rating),
        comment
      };

      const { data, error } = await supabaseAdmin
        .from('reviews')
        .insert(newReview)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error("You have already reviewed this book. Please edit your existing review instead.");
        }
        throw new Error(error.message);
      }

      return data;
    }
  }

  async updateReview(id, patronId, rating, comment) {
    const review = await this.getReviewById(id);
    if (!review) throw new Error("Review not found.");
    if (review.patron_id !== patronId) throw new Error("Access denied. You can only update your own reviews.");

    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.reviews.findIndex(r => r.id === id);
      mockDb.data.reviews[idx].rating = parseInt(rating);
      mockDb.data.reviews[idx].comment = comment;
      mockDb.save();
      return mockDb.data.reviews[idx];
    } else {
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .update({ rating: parseInt(rating), comment })
        .eq('id', id)
        .eq('patron_id', patronId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    }
  }

  async deleteReview(id, patronId, role) {
    const review = await this.getReviewById(id);
    if (!review) throw new Error("Review not found.");

    const isOwner = review.patron_id === patronId;
    const isAdmin = role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error("Access denied. Direct deletions are restricted to the review author or administrators.");
    }

    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.reviews.findIndex(r => r.id === id);
      mockDb.data.reviews.splice(idx, 1);
      mockDb.save();
      return true;
    } else {
      const { error } = await supabaseAdmin
        .from('reviews')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return true;
    }
  }
}

module.exports = new ReviewService();
