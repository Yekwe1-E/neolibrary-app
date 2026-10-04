const mockDb = require('../database/mockDb');
const { supabase, supabaseAdmin } = require('../config/supabase');

class NotificationService {
  async getNotifications(userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      return mockDb.data.notifications.filter(n => n.user_id === userId);
    } else {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    }
  }

  async markAsRead(id, userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.notifications.findIndex(n => n.id === id && n.user_id === userId);
      if (idx === -1) return false;

      mockDb.data.notifications[idx].is_read = true;
      mockDb.save();
      return true;
    } else {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      return !!data;
    }
  }

  async markAllAsRead(userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      mockDb.data.notifications.forEach(n => {
        if (n.user_id === userId) {
          n.is_read = true;
        }
      });
      mockDb.save();
      return true;
    } else {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
      return true;
    }
  }

  async deleteNotification(id, userId) {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const idx = mockDb.data.notifications.findIndex(n => n.id === id && n.user_id === userId);
      if (idx === -1) return false;

      mockDb.data.notifications.splice(idx, 1);
      mockDb.save();
      return true;
    } else {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      return !!data;
    }
  }
}

module.exports = new NotificationService();
