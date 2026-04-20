# הסרת נושא שכר ותעריף מהאפליקציה

**תאריך:** 2026-04-12

## מטרה
הסרה מלאה של כל פונקציונליות הקשורה לשכר, תעריף שעתי ודוחות משכורת מהאפליקציה.

## היקף השינויים

### מחיקה מלאה
- `src/app/admin/payroll/page.tsx` — דף דוחות שכר חודשיים
- `src/app/admin/payroll/PayrollClient.tsx` — קומפוננט הלקוח לדוחות שכר

### עריכה — הסרת שדות ורפרנסים
- `src/app/admin/teachers/[id]/EditTeacherForm.tsx` — הסרת שדה "תעריף לשעה", פרמטר `initialRate`, state `rate`, שליחת `hourly_rate` בטופס
- `src/app/admin/teachers/actions.ts` — הסרת קריאת `hourly_rate` ועדכונו ב-DB
- `src/app/admin/page.tsx` — הסרת כרטיסיות "ניהול מורים ושכר" ו"דוחות שכר חודשיים"
- `src/components/layout/AdminNav.tsx` — הסרת לשונית "שכר" מהניווט
- `src/types/database.ts` — הסרת `hourly_rate: number` מהטיפוס

### לא נגענו
- עמודת `hourly_rate` בטבלת DB בפועל (Supabase) — נשארת, לא מוחקים migrations

## תוצאה צפויה
האפליקציה תמשיך לפעול ללא כל אזכור של שכר, תעריף, או דוחות שכר.
