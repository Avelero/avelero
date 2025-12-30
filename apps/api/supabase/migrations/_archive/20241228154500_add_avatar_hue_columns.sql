-- Add avatar_hue columns to users and brands tables
-- These columns store hue values (160-259) for deterministic avatar fallback colors

-- Add avatar_hue to users table
ALTER TABLE public.users 
ADD COLUMN avatar_hue SMALLINT 
CHECK (avatar_hue IS NULL OR (avatar_hue >= 160 AND avatar_hue <= 259));

-- Add avatar_hue to brands table  
ALTER TABLE public.brands 
ADD COLUMN avatar_hue SMALLINT 
CHECK (avatar_hue IS NULL OR (avatar_hue >= 160 AND avatar_hue <= 259));

-- Create indexes for potential future queries (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_users_avatar_hue ON public.users(avatar_hue) WHERE avatar_hue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_avatar_hue ON public.brands(avatar_hue) WHERE avatar_hue IS NOT NULL;
