-- Migration: 001_add_admin
-- Description: Add is_admin column to users table for admin panel support
-- Date: 2026-05-11

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
