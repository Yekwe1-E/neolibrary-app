const jwt = require('jsonwebtoken');
const mockDb = require('../database/mockDb');
const { supabaseAdmin } = require('../config/supabase');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'dummy-jwt-secret';

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      if (process.env.MOCK_MODE !== 'true') {
        decoded = jwt.decode(token);
      }
      if (!decoded) {
        return res.status(401).json({ status: 'error', message: 'Invalid or expired authentication token.' });
      }
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      return res.status(401).json({ status: 'error', message: 'Token payload missing user identifier.' });
    }

    let profile = null;

    if (process.env.MOCK_MODE === 'true') {
      profile = mockDb.data.profiles.find(p => p.id === userId);
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        profile = data;
      }
    }

    if (!profile) {
      return res.status(401).json({ status: 'error', message: 'User profile not found in active database.' });
    }

    // Role-based status restrictions
    if (profile.status === 'suspended') {
      return res.status(403).json({ status: 'error', message: 'Access denied. Your account is suspended.' });
    }
    if (profile.status === 'expired') {
      return res.status(403).json({ status: 'error', message: 'Access denied. Your membership has expired.' });
    }

    // Inject profile to request user details
    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      full_name: profile.full_name
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ status: 'error', message: 'Internal authentication failure.' });
  }
};

module.exports = auth;
