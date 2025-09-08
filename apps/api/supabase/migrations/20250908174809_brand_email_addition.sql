-- Add email column to brands table
ALTER TABLE brands ADD COLUMN email TEXT;

-- Create index for email column (optional but recommended for performance)
CREATE INDEX idx_brands_email ON brands(email);
