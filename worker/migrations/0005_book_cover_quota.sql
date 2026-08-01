ALTER TABLE quota_daily
ADD COLUMN cover_search_count INTEGER NOT NULL DEFAULT 0
CHECK (cover_search_count <= 100);
