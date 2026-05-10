# Admin Availability Tab — Design Spec

**Date:** 2026-05-10
**Status:** Approved

---

## Background

מורים מגדירים טווחי זמינות (יום + שעת התחלה + שעת סיום) בעמוד `/availability`. האדמין צריך לראות את הטווחים האלה ולשבץ בתוכם שיעורים קבועים שבועיים (קבוצות).

---

## Goal

הוספת טאב **"זמינות"** לעמוד פרטי המורה (`/admin/teachers/[id]`). הטאב מציג את טווחי הזמינות של המורה, ולכל טווח — אילו קבוצות כבר משובצות בתוכו. לחיצה על "+ שבץ שיעור" פותחת את הטופס הקיים (`AdminGroupSheet`) עם היום ושעת ההתחלה מולאים מראש.

---

## Out of Scope

- עריכה/מחיקה של טווחי זמינות על-ידי האדמין (המורה עושה זאת בעמוד `/availability`)
- תצוגת לוח זמנים שבועי גרפי
- התנגשויות/ולידציה של חפיפה בין קבוצות

---

## Data Model

אין שינויים בסכמת הנתונים.

- `teacher_availability_ranges` — קיים (teacher_id, day_of_week, start_time, end_time)
- `groups` + `group_schedules` — קיים (teacher_id, day_of_week, start_time, end_time)

**לוגיקת שיוך קבוצה לטווח:** קבוצה משויכת לטווח אם:
```
group_schedules[0].day_of_week === range.day_of_week
AND group_schedules[0].start_time >= range.start_time
AND group_schedules[0].start_time < range.end_time
```

---

## UI

### טאב "זמינות" ב-AdminTeacherTabs

מוסיפים טאב שלישי בין "קבוצות" ל"סטטיסטיקות".

כל טווח מוצג כקלף:
- **כותרת (רקע ירוק בהיר):** שם היום + "HH:MM – HH:MM" + כפתור "**+ שבץ שיעור**"
- **גוף:** רשימת קבוצות משובצות בתוך הטווח (נקודה צבעונית + שם + שעות + מספר תלמידים)
- אם אין קבוצות: "אין שיעורים משובצים בטווח זה" (italic, אפור)

לחיצה על "+ שבץ שיעור":
- פותחת `AdminGroupSheet` עם `defaultDayOfWeek` ו-`defaultStartTime` מולאים מהטווח
- המשתמש ממשיך למלא שם, סוג שיעור, שעת סיום, תלמידים

### מצב ריק (אין טווחים)
אם למורה אין טווחי זמינות כלל — מציג הודעה: "המורה לא הגדיר טווחי זמינות עדיין."

---

## Files

| קובץ | פעולה | תיאור |
|------|--------|--------|
| `src/app/admin/teachers/[id]/page.tsx` | שינוי | שליפת `teacher_availability_ranges` עבור המורה + העברה ל-`AdminTeacherTabs` |
| `src/app/admin/teachers/[id]/AdminTeacherTabs.tsx` | שינוי | הוספת טאב 'availability', קבלת prop `ranges`, לוגיקת שיוך קבוצות לטווחים, פתיחת Sheet עם ערכי ברירת מחדל |
| `src/app/admin/teachers/[id]/AdminGroupSheet.tsx` | שינוי | הוספת props אופציונליים `defaultDayOfWeek?: number` ו-`defaultStartTime?: string`, שימוש בהם כ-initial state בעת יצירה |

---

## Props Changes

### AdminTeacherTabs
```typescript
interface Props {
  teacherId: string
  groups: GroupWithSchedulesAndStudents[]
  ranges: TeacherAvailabilityRange[]   // חדש
  completedLessons: number
  canceledLessons: number
}
```

### AdminGroupSheet
```typescript
interface Props {
  teacherId: string
  group?: GroupWithSchedulesAndStudents
  isOpen: boolean
  onClose: () => void
  defaultDayOfWeek?: number    // חדש
  defaultStartTime?: string    // חדש — "HH:MM"
}
```
