// Shared domain types. Consolidates interfaces that were redeclared across many
// files. Page-specific variants `extend` these bases with their extra columns,
// so no consumer loses a required field.

/** Core patient fields returned by every patient endpoint. */
export interface Patient {
  patientId: string;
  uhidNumber: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string;
  phone: string;
  email: string;
  genderLabel: string;
  bloodGroupLabel: string;
  age: number | null;
}

/** Core hospital staff-user fields. (Distinct from the super-admin auth User in
 *  AuthContext, which keys on `id`.) */
export interface StaffUser {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ── Access control (RBAC) ────────────────────────────────────────────────────

export interface Permission {
  permissionId: string;
  permissionCode: string;
  moduleName: string;
  actionName: string;
}

/** Fields present on every role-consuming screen. Screens that need more (or need
 *  an optional here to be required) `extend` this — never re-declare it. */
export interface Role {
  roleId: string;
  roleName: string;
  roleCode?: string;
  isSystemRole?: boolean;
  status?: string;
  hospitalId?: string | null;
}

// ── Org structure ────────────────────────────────────────────────────────────

/** Base department fields. Richer screens extend with code/status/relations. */
export interface Department {
  departmentId: string;
  departmentName: string;
}

export interface Branch {
  branchId: string;
  branchName: string;
  status?: string;
}

// ── Pharmacy ─────────────────────────────────────────────────────────────────

export interface Medicine {
  medicineId: string;
  medicineName: string;
  medicineCode?: string;
}

export interface LowStockAlert {
  medicineId: string;
  medicineName: string;
  currentStock: number;
  minStockLevel: number;
}

export interface PharmacyOrder {
  pharmacyOrderId: string;
  status: string;
  totalAmount: string;
  createdAt: string;
}

export interface PurchaseOrder {
  status: string;
}
