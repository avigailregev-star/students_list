import { revalidatePath } from 'next/cache'

export function revalidatePayroll(teacherId?: string) {
  revalidatePath('/reports')
  revalidatePath('/reports/payroll')
  if (teacherId) {
    revalidatePath(`/admin/teachers/${teacherId}/reports`)
    revalidatePath(`/admin/teachers/${teacherId}/view/reports`)
  } else {
    revalidatePath('/admin/teachers/[id]/reports', 'page')
    revalidatePath('/admin/teachers/[id]/view/reports', 'page')
  }
}
