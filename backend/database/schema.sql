-- Digital Library Management System Migration Schema File

-- 1. CLEAN UP (Drop tables if they exist for clean rebuilds if needed)
--    NOTE: DROP TRIGGER requires the table to exist even with IF EXISTS.
--    We use a DO block to safely attempt trigger drops, ignoring errors if
--    the table doesn't exist yet (fresh install). The CASCADE on DROP TABLE
--    also handles trigger cleanup when tables do exist.

DROP VIEW IF EXISTS dashboard_stats_view;

-- Safely drop triggers (won't fail on fresh database where tables don't exist yet)
DO $$
BEGIN
  -- Triggers on auth.users
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Triggers on borrowings
  BEGIN
    DROP TRIGGER IF EXISTS on_borrowing_created ON public.borrowings;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DROP TRIGGER IF EXISTS on_borrowing_returned ON public.borrowings;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- Triggers on reservations
  BEGIN
    DROP TRIGGER IF EXISTS on_reservation_status_change ON public.reservations;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
END;
$$;

-- Drop functions (safe, no table dependency)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_book_copies() CASCADE;
DROP FUNCTION IF EXISTS public.increment_book_copies() CASCADE;
DROP FUNCTION IF EXISTS public.on_reservation_update() CASCADE;

-- Drop tables in dependency order (CASCADE handles any remaining constraints)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS borrowings CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE TABLES

-- Profiles Table (Linked to Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'librarian', 'patron')) DEFAULT 'patron',
    phone TEXT,
    address TEXT,
    membership_date TIMESTAMP DEFAULT NOW(),
    status TEXT CHECK (status IN ('active', 'suspended', 'expired')) DEFAULT 'active',
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Books Table
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    isbn TEXT UNIQUE,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    publisher TEXT,
    publication_year INTEGER,
    genre TEXT[],
    description TEXT,
    cover_image_url TEXT,
    digital_copy_url TEXT,
    total_copies INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1,
    shelf_location TEXT,
    language TEXT DEFAULT 'English',
    pages INTEGER,
    status TEXT CHECK (status IN ('available', 'borrowed', 'reserved', 'lost', 'damaged', 'archived')) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT available_copies_check CHECK (available_copies >= 0 AND available_copies <= total_copies)
);

-- Borrowings Table
CREATE TABLE borrowings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    patron_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    borrow_date TIMESTAMP DEFAULT NOW(),
    due_date TIMESTAMP NOT NULL,
    return_date TIMESTAMP,
    status TEXT CHECK (status IN ('active', 'returned', 'overdue', 'renewed')) DEFAULT 'active',
    renewal_count INTEGER DEFAULT 0,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reservations Table
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    patron_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    reservation_date TIMESTAMP DEFAULT NOW(),
    expiry_date TIMESTAMP,
    status TEXT CHECK (status IN ('pending', 'fulfilled', 'cancelled', 'expired')) DEFAULT 'pending',
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    patron_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(book_id, patron_id)
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('due_reminder', 'overdue_notice', 'reservation_ready', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs Table
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. TRIGGERS AND FUNCTIONS

-- Trigger to create a profile automatically after registration in Supabase auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Library Patron'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'patron'),
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger below is bound to auth.users which is in the supabase internal schema.
-- When importing this into the Supabase SQL editor, it works seamlessly.
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to decrement book stock on new borrowing insertion
CREATE OR REPLACE FUNCTION public.decrement_book_copies()
RETURNS trigger AS $$
BEGIN
  -- Double check availability
  IF (SELECT available_copies FROM books WHERE id = NEW.book_id) <= 0 THEN
    RAISE EXCEPTION 'No available copies of this book remain.';
  END IF;

  UPDATE books
  SET available_copies = available_copies - 1
  WHERE id = NEW.book_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_borrowing_created
  BEFORE INSERT ON borrowings
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_book_copies();

-- Trigger to increment book stock when borrowing is updated to returned
CREATE OR REPLACE FUNCTION public.increment_book_copies()
RETURNS trigger AS $$
BEGIN
  IF (OLD.return_date IS NULL AND NEW.return_date IS NOT NULL) OR (OLD.status != 'returned' AND NEW.status = 'returned') THEN
    UPDATE books
    SET available_copies = available_copies + 1,
        status = CASE WHEN available_copies + 1 > 0 THEN 'available' ELSE status END
    WHERE id = NEW.book_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_borrowing_returned
  AFTER UPDATE ON borrowings
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_book_copies();

-- Trigger to create user notification when reservation status changes
CREATE OR REPLACE FUNCTION public.on_reservation_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'fulfilled' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.patron_id,
      'reservation_ready',
      'Reservation Ready',
      'The book you reserved is now available! Please borrow it within 48 hours.'
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.patron_id,
      'system',
      'Reservation Cancelled',
      'Your reservation for this book has been cancelled.'
    );
  ELSIF OLD.status = 'pending' AND NEW.status = 'expired' THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.patron_id,
      'system',
      'Reservation Expired',
      'Your reservation timer of 48 hours has expired and the book has passed to the next in queue.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reservation_status_change
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.on_reservation_update();

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 4.1 Profiles policies
CREATE POLICY "Profiles are readable by owner and admins" ON profiles
    FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'librarian')));

CREATE POLICY "Profiles can be updated by owner" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles can be updated by admin" ON profiles
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4.2 Books policies
CREATE POLICY "Books are publicly readable" ON books
    FOR SELECT USING (true);

CREATE POLICY "Books can be modified by admin and librarians" ON books
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'librarian')));

-- 4.3 Borrowings policies
CREATE POLICY "Patrons can select own borrowings" ON borrowings
    FOR SELECT USING (auth.uid() = patron_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'librarian')));

CREATE POLICY "Patrons can insert own borrowings" ON borrowings
    FOR INSERT WITH CHECK (auth.uid() = patron_id);

CREATE POLICY "Librarians and Admins can update borrowings" ON borrowings
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'librarian')));

-- 4.4 Reservations policies
CREATE POLICY "Patrons can select own reservations" ON reservations
    FOR SELECT USING (auth.uid() = patron_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'librarian')));

CREATE POLICY "Patrons can create own reservations" ON reservations
    FOR INSERT WITH CHECK (auth.uid() = patron_id);

CREATE POLICY "Patrons can cancel own reservations" ON reservations
    FOR UPDATE USING (auth.uid() = patron_id) WITH CHECK (auth.uid() = patron_id AND status = 'cancelled');

CREATE POLICY "Librarians/Admins can manage reservations" ON reservations
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'librarian')));

-- 4.5 Reviews policies
CREATE POLICY "Reviews are viewable by everyone" ON reviews
    FOR SELECT USING (true);

CREATE POLICY "Reviews can be added by active patrons" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = patron_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active'));

CREATE POLICY "Reviews can be modified by owner" ON reviews
    FOR UPDATE USING (auth.uid() = patron_id) WITH CHECK (auth.uid() = patron_id);

CREATE POLICY "Reviews can be deleted by owner or admin" ON reviews
    FOR DELETE USING (auth.uid() = patron_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4.6 Notifications policies
CREATE POLICY "Notifications are viewable by owner" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Notifications can be modified by owner" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Notifications can be deleted by owner" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- 4.7 Activity logs policies
CREATE POLICY "Activity logs are viewable by admins only" ON activity_logs
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "System can record activity logs" ON activity_logs
    FOR INSERT WITH CHECK (true);
