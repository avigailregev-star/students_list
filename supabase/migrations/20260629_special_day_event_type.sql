-- Add special_day to the event_type check constraint on school_events
ALTER TABLE school_events DROP CONSTRAINT IF EXISTS school_events_event_type_check;

ALTER TABLE school_events
  ADD CONSTRAINT school_events_event_type_check
  CHECK (event_type IN ('holiday','vacation','concert','makeup_day','school_start','school_end','special_day'));
