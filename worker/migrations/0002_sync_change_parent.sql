ALTER TABLE sync_changes ADD COLUMN book_id TEXT;
ALTER TABLE sync_changes ADD COLUMN origin_device_id TEXT NOT NULL DEFAULT 'server';
