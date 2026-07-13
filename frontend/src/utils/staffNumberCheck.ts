import { employeesApi } from '../api/endpoints';

export type StaffNumberCheckResult = {
  available: boolean;
  emp_code?: string | null;
  message?: string | null;
};

export async function checkStaffNumberAvailable(
  empCode: string,
  opts?: { staff_group?: string; exclude_employee_id?: string },
): Promise<StaffNumberCheckResult> {
  const trimmed = empCode.trim();
  if (!trimmed) {
    return { available: false, message: 'Staff number cannot be empty' };
  }
  const { data } = await employeesApi.checkStaffNumber({
    emp_code: trimmed,
    staff_group: opts?.staff_group,
    exclude_employee_id: opts?.exclude_employee_id,
  });
  return data as StaffNumberCheckResult;
}
