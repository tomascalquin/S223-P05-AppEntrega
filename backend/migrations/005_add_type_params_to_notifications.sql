-- Migración: Agregar type y params a notifications
-- Permite traducir el mensaje en el frontend según el idioma activo del usuario,
-- en vez de guardar el texto final ya renderizado en español.
-- Las notificaciones existentes quedan con type/params en NULL y se muestran
-- con el texto plano original guardado en la columna message (fallback).

ALTER TABLE notifications
  ADD COLUMN type VARCHAR(50) NULL,
  ADD COLUMN params JSON NULL;
