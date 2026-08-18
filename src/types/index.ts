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

// ── Billing / money ──────────────────────────────────────────────────────────
// Money crosses the wire as a decimal STRING (Prisma Decimal serialises that
// way), so every field below is `string | number` and must go through Number()
// before arithmetic. These exist mainly so a backend field rename becomes a
// compile error instead of `Number(undefined)` → NaN → a silently wrong total.

export type Money = string | number;

export interface Payment {
  paymentId: string;
  invoiceId?: string | null;
  paidAmount: Money;
  gatewayProvider?: string | null;
  transactionReference?: string | null;
  payerType?: string | null;
  claimId?: string | null;
  paymentMethod?: { methodName?: string | null } | null;
  paymentStatus?: InvoiceStatusRef | null;
  createdAt?: string;
}

export interface Refund {
  refundId: string;
  invoiceId?: string | null;
  paymentId: string;
  refundAmount: Money;
  refundReason?: string | null;
  refundStatus: string;
  processedAt?: string | null;
}

/** The status lookup rows carry their own label + colour, which the UI renders
 *  directly — see the status-lookup-table decision. */
export interface InvoiceStatusRef {
  statusCode?: string;
  statusLabel?: string;
  colorHex?: string;
}

export interface InvoiceItem {
  invoiceItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  discountAmount?: Money;
  taxAmount?: Money;
  cgstAmount?: Money;
  sgstAmount?: Money;
  igstAmount?: Money;
  taxPercent?: Money;
  hsnCode?: string | null;
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  patientId?: string | null;
  appointmentId?: string | null;
  admissionId?: string | null;
  grossAmount: Money;
  discountAmount: Money;
  taxAmount: Money;
  netAmount: Money;
  cgstAmount?: Money;
  sgstAmount?: Money;
  igstAmount?: Money;
  invoiceDate: string;
  dueDate?: string;
  invoiceStatus: string;
  discountReason?: string | null;
  cancellationReason?: string | null;
  paymentStatus?: InvoiceStatusRef | null;
  InvoiceItem?: InvoiceItem[];
  Payment?: Payment[];
  Refund?: Refund[];
}

/** A payment row decorated with how much of it is still returnable
 *  (paid − refunds already booked against that payment). */
export interface RefundablePayment extends Payment {
  refundable: number;
}
