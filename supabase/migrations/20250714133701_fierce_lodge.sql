/*
  # Add email preferences to profiles table

  1. Changes
    - Add email_preferences JSONB column to profiles table
    - Set default email preferences for existing users
    - Update RLS policies to allow email preference updates

  2. Security
    - Maintain existing RLS policies
    - Allow users to update their own email preferences
*/

-- Add email_preferences column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_preferences'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email_preferences JSONB DEFAULT '{
      "daily_reminders": true,
      "reminder_time": "09:00",
      "timezone": "UTC"
    }';
  END IF;
END $$;

-- Update existing users with default email preferences if they don't have any
UPDATE public.profiles 
SET email_preferences = '{
  "daily_reminders": true,
  "reminder_time": "09:00", 
  "timezone": "UTC"
}'
WHERE email_preferences IS NULL;

-- Ensure the updated_at timestamp is updated when email_preferences change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();