/** Shapes of /api/hospital/staff (HMS_Platform_Master_Data.xlsx sheets 10–14, 17). */

export interface StaffIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface StaffRow {
  staffId: string;
  firstName: string;
  lastName: string;
  name: string;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  staffCategoryCode: string;
  staffCategoryName: string;
  councilRegNo: string | null;
  status: string;
  login: { userId: string; email: string; isActive: boolean; roleCode: string; roleName: string } | null;
  employment: {
    employmentId: string;
    branchId: string | null;
    branchName: string | null;
    employeeCode: string | null;
    hospitalDesignationId: string | null;
    designationName: string | null;
    designationCode: string | null;
    grade: number | null;
    employmentTypeCode: string;
    employmentTypeName: string;
    adminManagerRequired: boolean;
    joiningDate: string | null;
    exitDate: string | null;
  } | null;
  primaryDepartment: { departmentId: string; departmentName: string; roleInDept: string } | null;
  additionalDepartments: { departmentId: string; departmentName: string; roleInDept: string }[];
  posting: { postingType: string; wardId: string | null; serviceUnitId: string | null; label: string } | null;
  adminManager: { staffId: string; name: string; grade: number | null } | null;
  functionalManager: { staffId: string; name: string; grade: number | null } | null;
  issues: StaffIssue[];
}

export interface StaffListResponse {
  data: StaffRow[];
  summary: { total: number; active: number; withLogin: number; withoutLogin: number; needingAttention: number };
}

export interface StaffPerson {
  staffId: string;
  name: string;
  staffCategoryCode: string;
  branchId: string | null;
  designationName: string | null;
  grade: number | null;
}

export interface StaffOptions {
  categories: { code: string; name: string; councilRegistration: string | null; notes: string | null }[];
  designations: { id: string; code: string; sysCode: string | null; displayName: string; grade: number; staffCategoryCode: string; canBeHod: boolean }[];
  employmentTypes: { code: string; name: string; adminManagerRequired: boolean; paymentModel: string }[];
  departments: { departmentId: string; departmentName: string; usualFor: string[] }[];
  wards: { wardId: string; wardName: string | null; wardCode: string | null; branchId: string | null }[];
  serviceUnits: { serviceUnitId: string; name: string; code: string; postingType: string; branchId: string }[];
  branches: { branchId: string; branchName: string }[];
  roles: { roleId: string; roleCode: string; roleName: string }[];
  statuses: { code: string; meaning: string }[];
  rolesInDept: { code: string; meaning: string }[];
  people: StaffPerson[];
}

export interface ManagerSuggestion {
  staffId: string;
  name: string;
  designationName: string | null;
  grade: number | null;
  sameFacility: boolean;
}

export interface SuggestResponse {
  grade: number;
  rule: { designationGroup: string; adminReportsTo: string; functionalReportsTo: string | null; notes: string | null } | null;
  admin: ManagerSuggestion[];
  functional: ManagerSuggestion[];
}

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", ON_LEAVE: "On leave", SUSPENDED: "Suspended", EXITED: "Left",
};

export const ROLE_IN_DEPT_LABEL: Record<string, string> = {
  HOD: "Head of department", DEPUTY_HOD: "Deputy head", MEMBER: "Member", VISITING: "Visiting",
};

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];
