-- Supabase Database Schema for DelivryX
-- Replaces Firestore collections with PostgreSQL tables

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drivers table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  custom_id TEXT UNIQUE, -- Custom driver ID (e.g., DRV-XXXXXX) for backward compatibility
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  pin_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT DEFAULT 'supabase',
  _last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  _version TEXT DEFAULT '1.0'
);

-- Packages table
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Assigned', 'In Transit', 'Delivered', 'Returned', 'Archived')),
  customer_name TEXT,
  customer_address TEXT,
  customer_phone TEXT,
  customer_phone_2 TEXT,
  sender_name TEXT,
  sender_company TEXT,
  sender_phone TEXT,
  date_of_arrive TEXT,
  description TEXT,
  weight TEXT,
  price DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  limit_date TEXT,
  limit_time TEXT, -- HH:mm format
  gps_lat DECIMAL(10, 8),
  gps_lng DECIMAL(11, 8),
  assigned_to UUID REFERENCES drivers(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  return_reason TEXT,
  supplement_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  _last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  _version TEXT DEFAULT '1.0',
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  statusHistory JSONB DEFAULT '[]'::jsonb NOT NULL
);

-- User profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  admin BOOLEAN DEFAULT false,
  driver BOOLEAN DEFAULT false,
  driver_id UUID REFERENCES drivers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync operations table (for offline sync)
CREATE TABLE sync_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('create', 'update', 'delete')),
  collection TEXT NOT NULL CHECK (collection IN ('packages', 'drivers')),
  data JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id)
);

-- Sync metadata table
CREATE TABLE sync_metadata (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pending_count INTEGER DEFAULT 0
);

-- Indexes for better performance
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_assigned_to ON packages(assigned_to);
CREATE INDEX idx_packages_ref_number ON packages(ref_number);
CREATE INDEX idx_packages_statusHistory ON packages USING GIN (statusHistory);
CREATE INDEX idx_drivers_is_active ON drivers(is_active);
CREATE INDEX idx_drivers_phone ON drivers(phone);
CREATE INDEX idx_sync_operations_synced ON sync_operations(synced);
CREATE INDEX idx_sync_operations_user_id ON sync_operations(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Packages policies
CREATE POLICY "Admins can view all packages" ON packages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

CREATE POLICY "Drivers can view assigned packages" ON packages
  FOR SELECT USING (
    assigned_to IN (
      SELECT driver_id
      FROM profiles
      WHERE id = auth.uid() AND driver = true
    )
  );

-- Admin can insert packages
CREATE POLICY "Admins can insert packages" ON packages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

-- Admin can update packages
CREATE POLICY "Admins can update packages" ON packages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

-- Drivers can update only limited package fields for their assigned packages.
-- Enforced at the DB level using RLS WITH CHECK so other fields cannot be modified.
CREATE POLICY "Drivers can update assigned packages (limited fields only)" ON packages
  FOR UPDATE
  USING (
    assigned_to IN (
      SELECT driver_id
      FROM profiles
      WHERE id = auth.uid() AND driver = true
    )
  )
  WITH CHECK (
    -- keep assignment + customer/sender fields unchanged
    assigned_to = assigned_to
    AND customer_name = customer_name
    AND customer_address = customer_address
    AND customer_phone = customer_phone
    AND customer_phone_2 = customer_phone_2
    AND sender_name = sender_name
    AND sender_company = sender_company
    AND sender_phone = sender_phone
    AND price = price
    AND is_paid = is_paid
    AND gps_lat = gps_lat
    AND gps_lng = gps_lng
    AND supplement_info = supplement_info
    AND ref_number = ref_number

    -- status/timestamp consistency
    AND (
      (status <> 'Delivered' OR delivered_at IS NOT NULL)
      AND (status <> 'Returned' OR return_reason IS NOT NULL)
    )
  );

-- Drivers policies
CREATE POLICY "Admins can view all drivers" ON drivers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

CREATE POLICY "Admins can insert drivers" ON drivers
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

CREATE POLICY "Admins can update drivers" ON drivers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin = true)
  );

-- Sync operations policies
CREATE POLICY "Users can manage own sync operations" ON sync_operations
  FOR ALL USING (auth.uid() = user_id);

-- Sync metadata policies
CREATE POLICY "Users can manage own sync metadata" ON sync_metadata
  FOR ALL USING (auth.uid() = user_id);

-- Functions and triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW._last_modified = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_packages_modified 
  BEFORE UPDATE ON packages 
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_drivers_modified 
  BEFORE UPDATE ON drivers 
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Function to handle profile creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
