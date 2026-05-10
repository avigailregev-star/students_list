# Teacher Availability Ranges — Design Spec

**Date:** 2026-05-10
**Status:** Approved

---

## Background

המורה צריך להגדיר באפליקציה אילו ימים ושעות הוא פנוי. נתונים אלו נשמרים בסופאבייס ונקראים על ידי אפליקציית רישום חיצונית נפרדת. האדמין באפליקציית הרישום משבץ את התלמידים לשעות מדויקות בתוך הטווחים שהמורה הגדיר.

---

## Goal

להחליף את עמוד הזמינות הנוכחי (סלוטים מפורטים עם כלי נגינה, סוג שיעור, משך) בממשק פשוט: **יום + שעת התחלה + שעת סיום**.

---

## Out of Scope

- מסך שיבוץ אדמין — יבוצע באפליקציית הרישום
- הצגת רישומים מאפליקציית הרישום בתוך אפליקציה זו
- אישור/דחיית רישומים

---

## Data Model

### מחיקה: `teacher_availability`
הטבלה הנוכחית תוסר (כוללת עמודות מיותרות: `instrument`, `lesson_type`, `max_students`, `duration_minutes`, `is_active`).

### יצירה: `teacher_availability_ranges`

```sql
CREATE TABLE teacher_availability_ranges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (end_time > start_time)
);

ALTER TABLE teacher_availability_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage own ranges"
  ON teacher_availability_ranges FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "service role reads all"
  ON teacher_availability_ranges FOR SELECT
  USING (auth.role() = 'service_role');
```

**אינדקס:** `(teacher_id, day_of_week, start_time)` לביצועים של אפליקציית הרישום.

---

## Type: `TeacherAvailabilityRange`

```typescript
export type TeacherAvailabilityRange = {
  id: string
  teacher_id: string
  day_of_week: number   // 0=ראשון … 6=שבת
  start_time: string    // "HH:MM:SS"
  end_time: string      // "HH:MM:SS"
  created_at: string
}
```

---

## UI — עמוד `/availability`

### תצוגת רשימה
- טווחים מקובצים לפי יום (ראשון → שישי)
- כל שורה: `{יום} · {שעת התחלה} – {שעת סיום}` + כפתור מחיקה (X)
- אם אין טווחים — מסך ריק עם הנחיה להוסיף

### הוספת טווח
- כפתור "+ הוסף טווח זמינות" בתחתית
- בלחיצה נפתח טופס inline:
  - בחירת יום (dropdown)
  - שעת התחלה (time input)
  - שעת סיום (time input)
  - כפתורי "שמור" ו"ביטול"
- ולידציה: שעת סיום > שעת התחלה

### מחיקה
- לחיצה על X → מחיקה מיידית (ללא אישור נוסף)

---

## Files

| קובץ | פעולה | תיאור |
|------|--------|--------|
| `src/types/database.ts` | שינוי | הסרת `TeacherAvailability`, הוספת `TeacherAvailabilityRange` |
| `src/app/availability/actions.ts` | כתיבה מחדש | CRUD על `teacher_availability_ranges` |
| `src/app/availability/AvailabilityClient.tsx` | כתיבה מחדש | UI פשוט עם רשימה + טופס הוספה |
| `src/app/availability/page.tsx` | עדכון קל | שימוש ב-`TeacherAvailabilityRange` |

---

## SQL Migration (לביצוע בסופאבייס לפני פריסה)

```sql
-- שלב 1: מחיקת הטבלה הישנה
DROP TABLE IF EXISTS teacher_availability CASCADE;

-- שלב 2: יצירת הטבלה החדשה
CREATE TABLE teacher_availability_ranges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (end_time > start_time)
);

CREATE INDEX ON teacher_availability_ranges (teacher_id, day_of_week, start_time);

ALTER TABLE teacher_availability_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage own ranges"
  ON teacher_availability_ranges FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "service role reads all"
  ON teacher_availability_ranges FOR SELECT
  USING (auth.role() = 'service_role');
```
