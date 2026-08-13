-- Marca de notificación para la recuperación de carritos abandonados
-- (functions/api/v1/abandonos-notify.ts, cron de GitHub Actions).
ALTER TABLE hotmart_eventos ADD COLUMN notified_at TEXT;
