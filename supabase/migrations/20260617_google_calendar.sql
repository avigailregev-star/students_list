-- One Google OAuth token per user
CREATE TABLE IF NOT EXISTS google_tokens (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  calendar_id   text NOT NULL DEFAULT 'primary',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- GCal event ID for school events per teacher (school_events.google_event_id = admin's copy only)
CREATE TABLE IF NOT EXISTS google_event_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_event_id uuid NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(school_event_id, teacher_id)
);

-- Alerts created when a lesson is missing from teacher's Google Calendar during pull
CREATE TABLE IF NOT EXISTS google_sync_alerts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id  uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'deleted_in_google',
  resolved   boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, lesson_id)
);

ALTER TABLE school_events ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE lessons        ADD COLUMN IF NOT EXISTS google_event_id text;

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_token" ON google_tokens FOR ALL USING (auth.uid() = user_id);

ALTER TABLE google_event_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_assignments" ON google_event_assignments
  FOR SELECT USING (auth.uid() = teacher_id);

ALTER TABLE google_sync_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_alerts" ON google_sync_alerts FOR ALL
  USING (EXISTS (SELECT 1 FROM teachers WHERE id = auth.uid() AND role = 'admin'));
