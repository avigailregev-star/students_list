# Admin Scheduling — Design Spec
Date: 2026-04-19

## Overview

Enable the admin to create, edit, and delete lesson groups for any teacher. The admin teacher detail page gains a tabbed layout with a full group management interface. Teachers retain all functionality (attendance, reports) but the "add group" button is hidden — group structure is admin-managed for now.

---

## 1. Database Schema Changes

### `groups.lesson_type` — expand enum

Current: `'group' | 'individual'`

New (8 values):
| Value | Hebrew |
|-------|--------|
| `individual_45` | פרטני 45 דקות |
| `individual_60` | פרטני 60 דקות |
| `group` | קבוצתי |
| `theory` | תיאוריה |
| `orchestra` | תזמורת |
| `choir` | מקהלה |
| `melodies_individual` | מנגינות פרטני |
| `melodies_group` | מנגינות קבוצתי |

**Migration required**: `ALTER TABLE groups DROP CONSTRAINT groups_lesson_type_check; ALTER TABLE groups ADD CONSTRAINT groups_lesson_type_check CHECK (lesson_type IN ('individual_45','individual_60','group','theory','orchestra','choir','melodies_individual','melodies_group'));`

Note: existing rows with `lesson_type = 'individual'` must be migrated to `individual_45` before applying the constraint.

### TypeScript (`src/types/database.ts`)

```ts
export type LessonType =
  | 'individual_45' | 'individual_60' | 'group' | 'theory'
  | 'orchestra' | 'choir'
  | 'melodies_individual' | 'melodies_group'
```

---

## 2. Admin Teacher Detail Page — Tabs

**File**: `src/app/admin/teachers/[id]/page.tsx`

The current page shows groups + stats in a single scroll. Reorganize into 2 tabs:

| Tab | Hebrew | Content |
|-----|--------|---------|
| `groups` | קבוצות | Group list + add/edit/delete |
| `stats` | סטטיסטיקות | Existing stats grid (completed, canceled, etc.) |

A new client component `AdminTeacherTabs.tsx` wraps both tabs and holds the active-tab state. The page passes all needed data as props (groups, students, stats).

---

## 3. Group Management UI

### Groups Tab Content

- List of teacher's existing groups, each row showing:
  - Lesson type badge (colored by type)
  - Group name
  - Day + time
  - Student count
  - Edit button (opens sheet in edit mode)
  - Delete button (with confirmation)
- "הוסף קבוצה" button at bottom → opens sheet in create mode

### Bottom Sheet — `AdminGroupSheet.tsx`

Opens from bottom (same pattern as calendar event sheet). Fields:

1. **סוג שיעור** — dropdown, 7 options, required
2. **שם קבוצה** — text input, required
3. **יום** — day-of-week picker (reuses `SchedulePicker` or inline select: א׳–ו׳)
4. **שעת התחלה** — time input, required
5. **שעת סיום** — time input, optional
6. **תלמידים** — list with add/remove:
   - Shows existing students with remove button
   - "הוסף תלמיד" inline form: name, instrument (optional), parent phone (optional)

Sheet supports two modes:
- **Create**: empty form, saves new group + schedule + students under given `teacher_id`
- **Edit**: pre-populated, saves updates to group + schedule + students

---

## 4. Server Actions

New file: `src/app/admin/teachers/[id]/groupActions.ts`

All actions call `requireAdmin()` first.

| Action | Description |
|--------|-------------|
| `createGroupForTeacher(teacherId, data)` | Inserts group + group_schedule + students |
| `updateGroup(groupId, data)` | Updates group name, lesson_type, schedule |
| `addStudentToGroup(groupId, studentData)` | Inserts student |
| `removeStudentFromGroup(studentId)` | Deletes student |
| `deleteGroup(groupId)` | Deletes group (cascades schedules + lessons) |

All actions call `revalidatePath('/admin/teachers/[id]')` on success.

---

## 5. Teacher Side — Hide Add Group

**File**: `src/app/groups/new/page.tsx`

Wrap the page with an admin-only check: if the current user is not admin, redirect to `/`. This removes the route entirely for teachers rather than just hiding a button (more secure).

The teacher dashboard continues to show their existing groups and all attendance/report functionality is unchanged.

---

## 6. Component Map

```
src/app/admin/teachers/[id]/
  page.tsx                  ← adds tab data fetching, passes to AdminTeacherTabs
  AdminTeacherTabs.tsx      ← NEW: tab switcher (client component)
  AdminGroupSheet.tsx       ← NEW: bottom sheet form (client component)
  groupActions.ts           ← NEW: server actions for group CRUD

src/types/database.ts       ← update LessonType enum
src/app/groups/new/page.tsx ← add admin-only redirect guard
```

Reused without changes:
- `src/components/groups/SchedulePicker.tsx` — day + time picker (used inside AdminGroupSheet)

---

## 7. Out of Scope

- Teachers editing their own groups (planned for future)
- Bulk group import
- Changing a group's teacher assignment
- Mangan school fields (not required in admin form for now — can be added later)
