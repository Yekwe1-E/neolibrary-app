const mockDb = require('../database/mockDb');
const { supabase, supabaseAdmin } = require('../config/supabase');

class UserService {
  async getUsers() {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      // Exclude passwords
      return mockDb.data.profiles.map(({ password_hash, ...u }) => u);
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw new Error(error.message);
      return data || [];
    }
  }

  async getUserById(id) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const user = mockDb.data.profiles.find(p => p.id === id);
      if (!user) return null;
      const { password_hash, ...safeUser } = user;
      return safeUser;
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code === 'PGRST116') return null;
      if (error) throw new Error(error.message);
      return data;
    }
  }

  async updateUser(id, userData, userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.profiles.findIndex(p => p.id === id);
      if (idx === -1) return null;

      const updated = {
        ...mockDb.data.profiles[idx],
        ...userData,
        updated_at: new Date().toISOString()
      };

      mockDb.data.profiles[idx] = updated;
      mockDb.logActivity(userId, 'update_user', 'profiles', id, { name: updated.full_name });
      mockDb.save();

      const { password_hash, ...safe } = updated;
      return safe;
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          ...userData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'update_user',
        entity_type: 'profiles',
        entity_id: id,
        details: { name: data.full_name }
      });

      return data;
    }
  }

  async updateUserRole(id, role, userId) {
    // Only 'admin' role can execute this
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.profiles.findIndex(p => p.id === id);
      if (idx === -1) return null;

      mockDb.data.profiles[idx].role = role;
      mockDb.data.profiles[idx].updated_at = new Date().toISOString();
      mockDb.logActivity(userId, 'change_role', 'profiles', id, { new_role: role });
      mockDb.save();

      const { password_hash, ...safe } = mockDb.data.profiles[idx];
      return safe;
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'change_role',
        entity_type: 'profiles',
        entity_id: id,
        details: { new_role: role }
      });

      return data;
    }
  }

  async deactivateUser(id, userId) {
    // Soft deletion by setting status to 'suspended'
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.profiles.findIndex(p => p.id === id);
      if (idx === -1) return false;

      mockDb.data.profiles[idx].status = 'suspended';
      mockDb.data.profiles[idx].updated_at = new Date().toISOString();
      mockDb.logActivity(userId, 'deactivate_user', 'profiles', id);
      mockDb.save();
      return true;
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return false;

      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'deactivate_user',
        entity_type: 'profiles',
        entity_id: id
      });

      return true;
    }
  }

  async getUserBorrowings(id) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      let bList = mockDb.data.borrowings.filter(b => b.patron_id === id);
      return bList.map(b => {
        const book = mockDb.data.books.find(x => x.id === b.book_id);
        return {
          ...b,
          book: book ? { title: book.title, author: book.author, cover_image_url: book.cover_image_url } : null
        };
      });
    } else {
      const { data, error } = await supabaseAdmin
        .from('borrowings')
        .select('*, book:books(title, author, cover_image_url)')
        .eq('patron_id', id)
        .order('borrow_date', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    }
  }

  async getUserFines(id) {
    // Overdue or active fines summary
    const borrowings = await this.getUserBorrowings(id);
    const fines = borrowings
      .filter(b => parseFloat(b.fine_amount) > 0 || (b.return_date === null && new Date(b.due_date) < new Date()))
      .map(b => {
        const excess = b.return_date ? 0 : calculateOverdueFine(b.due_date);
        return {
          borrowing_id: b.id,
          book_title: b.book?.title,
          due_date: b.due_date,
          return_date: b.return_date,
          fine_accumulated: parseFloat(b.fine_amount) + excess,
          status: b.status
        };
      });

    const total = fines.reduce((sum, item) => sum + item.fine_accumulated, 0);

    return {
      fines,
      total_fines: total
    };
  }

  async payFines(id, amount, userId) {
    // Clears or reduces accumulated fines by paying off active balances
    const isMock = process.env.MOCK_MODE === 'true';
    let paidAmount = parseFloat(amount);
    if (isNaN(paidAmount) || paidAmount <= 0) throw new Error("Payment amount must be a positive number.");

    if (isMock) {
      const patron = mockDb.data.profiles.find(p => p.id === id);
      if (!patron) throw new Error("Patron not found.");

      // Find borrowings with outstanding fines
      const loans = mockDb.data.borrowings.filter(b => b.patron_id === id && parseFloat(b.fine_amount) > 0);
      let balanceToClear = paidAmount;

      for (const item of loans) {
        if (balanceToClear <= 0) break;
        const currentFine = parseFloat(item.fine_amount);
        if (currentFine <= balanceToClear) {
          balanceToClear -= currentFine;
          item.fine_amount = 0.00;
        } else {
          item.fine_amount = (currentFine - balanceToClear).toFixed(2);
          balanceToClear = 0;
        }
      }

      mockDb.logActivity(userId, 'pay_fines', 'profiles', id, { amount: paidAmount });
      
      // If patron status was suspended due to fines and now fines balance <= 500, auto-activate if they were active
      const remainingFines = loans.reduce((sum, b) => sum + parseFloat(b.fine_amount), 0);
      if (patron.status === 'suspended' && remainingFines <= 500) {
        patron.status = 'active';
        mockDb.logActivity(userId, 'reactivate_user', 'profiles', id, { reason: "Fines settled below limit." });
      }

      mockDb.save();
      return { remaining_change: balanceToClear, original_paid: paidAmount };
    } else {
      // Fetch loans with outstanding fines
      const { data: loans, error: fetchErr } = await supabaseAdmin
        .from('borrowings')
        .select('*')
        .eq('patron_id', id)
        .gt('fine_amount', 0);

      if (fetchErr) throw new Error(fetchErr.message);

      let balanceToClear = paidAmount;
      if (loans) {
        for (const item of loans) {
          if (balanceToClear <= 0) break;
          const currentFine = parseFloat(item.fine_amount);
          let newFine = 0.00;

          if (currentFine <= balanceToClear) {
            balanceToClear -= currentFine;
            newFine = 0.00;
          } else {
            newFine = currentFine - balanceToClear;
            balanceToClear = 0;
          }

          await supabaseAdmin
            .from('borrowings')
            .update({ fine_amount: newFine })
            .eq('id', item.id);
        }
      }

      // Add audit log
      await supabaseAdmin.from('activity_logs').insert({
        user_id: userId,
        action: 'pay_fines',
        entity_type: 'profiles',
        entity_id: id,
        details: { amount: paidAmount }
      });

      // Recalculate remaining to check reactivation
      const { data: activeLoans } = await supabaseAdmin
        .from('borrowings')
        .select('fine_amount')
        .eq('patron_id', id)
        .gt('fine_amount', 0);
      
      const remaining = (activeLoans || []).reduce((sum, b) => sum + parseFloat(b.fine_amount || 0), 0);
      if (remaining <= 500) {
        const { data: profile } = await supabaseAdmin.from('profiles').select('status').eq('id', id).single();
        if (profile && profile.status === 'suspended') {
          await supabaseAdmin.from('profiles').update({ status: 'active' }).eq('id', id);
        }
      }

      return { remaining_change: balanceToClear, original_paid: paidAmount };
    }
  }
}

// Overdue calculator local utility helper
function calculateOverdueFine(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = now.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays * 50 : 0.00;
}

module.exports = new UserService();
