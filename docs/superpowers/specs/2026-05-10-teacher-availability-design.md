# Design: Teacher Availability

**Date:** 2026-05-10  
**Status:** Approved

## Overview

מורים מגדירים את הזמינות שלהם (ימים, שעות, כלי נגינה, סוג שיעור) באפליקציית הנוכחות. אפליקציית הרישום לקונסרבטוריון (אפליקציה נפרדת, אותו Supabase) קוראת נתונים אלו כדי להציג מקומות פנויים להרשמה.

שתי מקורות מידע:
1. **קבוצות קיימות** — מגדירים `max_students` על הטבלה הקיימת `groups`
2. **סלוטים פרטיים** — טבלה חדשה `teacher_availability` לשעות פנויות לשיעורים פרטיים

---

## סכמת בסיס הנתונים

### שינוי 1: עמודת `max_students` בטבלת `groups`

```sql
ALTER TABLE groups
  ADD COLUMN max_students integer;
```

- nullable — `null` משמעו ללא הגבלה (קבוצה לא פתוחה לרישום)
- ערך חיובי = מספר מקסימלי של תלמידים בקבוצה

### שינוי 2: טבלה חדשה `teacher_availability`

```sql
CREATE TABLE teacher_availability (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week      integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (45, 60)),
  instrument       text NOT NULL,
  lesson_type      text NOT NULL CHECK (lesson_type IN ('individual', 'group')),
  max_students     integer NOT NULL DEFAULT 1,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage own availability"
  ON teacher_availability
  FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "service role reads all"
  ON teacher_availability
  FOR SELECT
  USING (auth.role() = 'service_role');
```

---

## ממשק המשתמש (אפליקציית הנוכחות)

### 1. שדה "מקסימום תלמידים" בטופס קבוצה

בטופס יצירה/עריכה של קבוצה — שדה מספרי אופציונלי:
- תווית: "מקסימום תלמידים (לרישום)"
- ריק = ללא הגבלה / לא פתוח לרישום
- ערך חיובי = הקבוצה פתוחה לרישום עם מגבלה זו

### 2. עמוד ניהול זמינות (`/availability`)

עמוד חדש בתפריט הניווט הראשי.

**תוכן העמוד:**
- רשימת סלוטים פעילים (כרטיסייה לכל סלוט): יום, שעת התחלה, משך, כלי נגינה, סוג שיעור, מספר מקומות, כפתורי השהיה/מחיקה
- כפתור "הוסף סלוט" → טופס עם השדות:
  - יום בשבוע (dropdown)
  - שעת התחלה (time picker)
  - משך: 45 דקות / 60 דקות (radio / select)
  - כלי נגינה (text)
  - סוג שיעור: פרטי / קבוצתי (radio)
  - מספר מקומות (number, default 1)

---

## החוזה עם אפליקציית הרישום

אפליקציית הרישום קוראת ישירות מ-Supabase המשותף דרך service role.

### קבוצות פתוחות לרישום

```sql
SELECT
  g.id,
  g.name,
  g.max_students,
  gs.day_of_week,
  gs.start_time,
  COUNT(s.id) AS enrolled_count
FROM groups g
JOIN group_schedules gs ON gs.group_id = g.id
LEFT JOIN students s ON s.group_id = g.id
WHERE g.teacher_id = :teacher_id
  AND g.max_students IS NOT NULL
GROUP BY g.id, gs.id
HAVING COUNT(s.id) < g.max_students
```

### סלוטים פרטיים פנויים

```sql
SELECT *
FROM teacher_availability
WHERE teacher_id = :teacher_id
  AND is_active = true
```

ספירת הרישומים הקיימים לכל סלוט — באחריות אפליקציית הרישום.

---

## מחוץ לתחום

- אין שינויים לאפליקציית הרישום עצמה
- אין API חדש — שתי האפליקציות עובדות ישירות מול Supabase
- אין ניהול "רישומים" בצד אפליקציית הנוכחות
