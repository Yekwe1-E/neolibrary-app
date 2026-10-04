const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mockDb = require('../database/mockDb');
const { supabase } = require('../config/supabase');
const userService = require('../services/userService');

const generateToken = (userId, email) => {
  const secret = process.env.JWT_SECRET || 'dummy-jwt-secret';
  return jwt.sign({ id: userId, email }, secret, { expiresIn: '24h' });
};

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password, full_name, phone, address } = req.body;
      const isMock = process.env.MOCK_MODE === 'true';

      if (isMock) {
        const existing = mockDb.data.profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          return res.status(409).json({ status: 'error', message: 'A profile with this email address already exists.' });
        }

        const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 17);
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        const newProfile = {
          id,
          full_name,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          role: 'patron',
          phone: phone || '',
          address: address || '',
          membership_date: new Date().toISOString(),
          status: 'active',
          avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(full_name)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        mockDb.data.profiles.push(newProfile);
        mockDb.logActivity(id, 'register', 'profiles', id, { name: full_name });
        
        // Auto system welcome notification
        mockDb.notify(id, 'system', 'Welcome to the Library!', `Hi ${full_name}, your patron card has been activated!`);

        mockDb.save();

        const token = generateToken(id, email);
        const { password_hash, ...safe } = newProfile;
        
        return res.status(201).json({
          status: 'success',
          message: 'Patron registered successfully.',
          data: { token, user: safe }
        });
      } else {
        // Supabase Auth SignUp
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name,
              phone,
              address
            }
          }
        });

        if (error) {
          return res.status(400).json({ status: 'error', message: error.message });
        }

        if (!data.user) {
          return res.status(500).json({ status: 'error', message: 'Registration failed to return user data.' });
        }

        // Wait brief instant/immediately fetch trigger generated profile
        let profile = null;
        let attempts = 0;
        while (!profile && attempts < 3) {
          profile = await userService.getUserById(data.user.id);
          if (!profile) {
            await new Promise(r => setTimeout(r, 500));
            attempts++;
          }
        }

        // Fallback manually inserting profile if Supabase triggers are not fully set up online
        if (!profile) {
          profile = await userService.updateUser(data.user.id, {
            full_name,
            email: email.toLowerCase(),
            phone: phone || '',
            address: address || '',
            role: 'patron',
            status: 'active'
          }, data.user.id);
        }

        const token = data.session?.access_token || generateToken(data.user.id, email);

        return res.status(201).json({
          status: 'success',
          message: 'Patron registered successfully.',
          data: { token, user: profile }
        });
      }
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const isMock = process.env.MOCK_MODE === 'true';

      if (isMock) {
        const user = mockDb.data.profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
          return res.status(401).json({ status: 'error', message: 'Invalid credentials. Please verify your email and password.' });
        }

        if (user.status === 'suspended') {
          return res.status(403).json({ status: 'error', message: 'Access denied. Your account is suspended.' });
        }

        const token = generateToken(user.id, user.email);
        const { password_hash, ...safe } = user;

        return res.status(200).json({
          status: 'success',
          message: 'Login successful.',
          data: { token, user: safe }
        });
      } else {
        // Supabase Auth login
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return res.status(401).json({ status: 'error', message: error.message });
        }

        const profile = await userService.getUserById(data.user.id);
        if (!profile) {
          return res.status(401).json({ status: 'error', message: 'User profile not found.' });
        }

        if (profile.status === 'suspended') {
          return res.status(403).json({ status: 'error', message: 'Access denied. Your account is suspended.' });
        }

        const token = data.session.access_token;
        return res.status(200).json({
          status: 'success',
          message: 'Login successful.',
          data: { token, user: profile }
        });
      }
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      // req.user was populated by auth middleware
      const profile = await userService.getUserById(req.user.id);
      return res.status(200).json({
        status: 'success',
        data: profile
      });
    } catch (err) {
      next(err);
    }
  }

  async updateMe(req, res, next) {
    try {
      const { full_name, phone, address, avatar_url } = req.body;
      const updated = await userService.updateUser(req.user.id, {
        full_name,
        phone,
        address,
        avatar_url
      }, req.user.id);

      return res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      const isMock = process.env.MOCK_MODE === 'true';
      if (!isMock) {
        await supabase.auth.signOut();
      }
      return res.status(200).json({
        status: 'success',
        message: 'Logged out successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      const isMock = process.env.MOCK_MODE === 'true';
      if (isMock) {
        const token = generateToken(req.user.id, req.user.email);
        return res.status(200).json({
          status: 'success',
          data: { token }
        });
      } else {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) return res.status(401).json({ status: 'error', message: error.message });

        return res.status(200).json({
          status: 'success',
          data: { token: data.session?.access_token }
        });
      }
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
