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
  patientId?: string | null;
  status: string;
  /** A Prisma Decimal — always a string on the wire. Number() before arithmetic. */
  totalAmount: string;
  createdAt: string;
  /** Set when the sale was cancelled; shown beside the row. */
  cancellationReason?: string | null;
  /** The list endpoint includes these; a freshly created order may not. */
  items?: PharmacyOrderLine[];
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
  /** "PENDING" | "COMPLETED" | "REJECTED". Only COMPLETED is money returned. */
  refundStatus: string;
  /** Null while PENDING — set at the moment the refund completes. */
  processedAt?: string | null;
  /** Receipt number, REF-{year}-{NNNN}. Only a COMPLETED refund has one. */
  refundNumber?: string | null;
  /** How the money went back, and its bank/UPI reference. Null on older rows. */
  paymentMethodId?: number | null;
  referenceNumber?: string | null;
  approvedBy?: string | null;
  rejectionReason?: string | null;
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
  /** The line's label. NOT `itemName` — that is ChargeItem, the SOC catalogue. */
  description?: string | null;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  grossAmount?: Money;
  discountAmount?: Money;
  taxAmount?: Money;
  taxPercent?: Money;
  hsnCode?: string | null;
  /** Groups the line on a printed bill (CONSULTATION, PHARMACY, LAB…). */
  category?: string | null;
  itemDate?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  uom?: string | null;
  manufacturer?: string | null;
  orderingDoctor?: string | null;
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

/**
 * One row of GET /reception/billing/invoices — the billing LIST, which is a
 * different projection from the detail below: it denormalises the patient and
 * carries a pre-computed balance, and has no line items.
 */
export interface InvoiceListRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  appointmentId?: string | null;
  admissionId?: string | null;
  admissionNumber?: string | null;
  patientName: string;
  uhid: string;
  netAmount: Money;
  paidAmount: Money;
  /** Already zeroed for a cancelled invoice by the server. */
  balance: Money;
  invoiceStatus: string;
  statusLabel: string;
  statusColor: string;
  /** Refund raised but not yet released — no money has moved. */
  refundPending: Money;
}

/**
 * GET /reception/billing/invoices/:id/detail — the invoice row plus everything
 * a bill or receipt needs to render, resolved server-side.
 */
export interface InvoiceDetail extends Invoice {
  // The detail endpoint always returns these three, unlike a list row.
  InvoiceItem: InvoiceItem[];
  Payment: Payment[];
  Refund: Refund[];
  patient?: {
    firstName?: string | null;
    lastName?: string | null;
    uhidNumber?: string | null;
    phone?: string | null;
    dateOfBirth?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    district?: string | null;
    state?: string | null;
    postalCode?: string | null;
  } | null;
  hospital?: {
    hospitalName?: string | null;
    legalBusinessName?: string | null;
    registrationNumber?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    landmark?: string | null;
    city?: string | null;
    postalCode?: string | null;
    officialPhone?: string | null;
    officialEmail?: string | null;
    gstNumber?: string | null;
    logoUrl?: string | null;
  } | null;
  /** Present only on an IPD bill. */
  admission?: {
    admissionNumber?: string | null;
    admissionDate?: string | null;
    dischargeDate?: string | null;
    admittingDiagnosis?: string | null;
    consultantName?: string | null;
    bed?: { bedNumber?: string | null; bedType?: string | null; roomNumber?: string | null; wardName?: string | null; roomClass?: string | null } | null;
  } | null;
  /** Advance ledger for the admission: available = collected − applied − refunded. */
  deposits?: { collected: number; applied: number; refunded: number; available: number } | null;
}

/** GET /reception/billing/lookups — the payment methods a receipt can offer. */
export interface PaymentMethodRef {
  paymentMethodId: number;
  methodName: string;
}
export interface BillingLookups {
  methods: PaymentMethodRef[];
}

/**
 * GET /billing/unbilled/:patientId — work done but not yet on any invoice.
 * Mirrors UnbilledItem in backend/src/modules/billing/billing.service.ts.
 */
export interface UnbilledItem {
  /** Id of the source order/consultation, not of an invoice line. */
  id: string;
  type: "CONSULTATION" | "LAB" | "RADIOLOGY" | "PHARMACY";
  description: string;
  amount: number;
  chargeItemId?: string | null;
  taxPercent: number;
  hsnCode?: string | null;
  /** Authoritative when set — pharmacy orders mix GST rates across medicines. */
  taxAmount?: number;
  /** When the work was done — what the picker lists the line under. */
  date?: string | null;
  /** Source links, so the invoice can be tied back to the order or stay. */
  metadata?: { admissionId?: string | null; consultationId?: string | null } | null;
}

/** The hospital's own billing identity, as the profile endpoint returns it. */
export interface HospitalBillingProfile {
  hospitalName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  officialPhone?: string | null;
  officialEmail?: string | null;
  gstNumber?: string | null;
  logoUrl?: string | null;
}

// ── Pharmacy / medication ────────────────────────────────────────────────────
// Shapes for the dispensing and medication-administration paths, where a wrong
// field is a clinical error rather than a cosmetic one. Prices and quantities
// cross the wire as decimal strings (Prisma Decimal), hence `Money`.

/** A medicine as the catalog endpoint returns it. */
export interface MedicineCatalogRow {
  medicineId: string;
  medicineCode: string;
  medicineName: string | null;
  genericName: string;
  manufacturer: string;
  sellingPrice: Money;
  gstPercent?: Money;
  hsnCode?: string | null;
  minStockLevel?: number;
}

/** A catalog row decorated by the POS with live stock and a display label. */
export interface DispensableMedicine extends MedicineCatalogRow {
  /** Summed available quantity across non-expired batches. */
  inStock: number;
  label: string;
}

export interface MedicineInventoryRow {
  medicineInventoryId?: string;
  medicineId: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
  availableQuantity: number;
}

/** One line in the dispensary cart. `unitPrice` is a number here: it is coerced
 *  on the way in precisely because the API sends a Decimal string and
 *  `.toFixed()` on a string throws. */
export interface CartLine extends DispensableMedicine {
  quantity: number;
  unitPrice: number;
}

/** A prescribed item, as written by a doctor and read by the pharmacy. */
export interface PrescriptionItem {
  medicineId?: string | null;
  medicineName: string;
  genericName?: string | null;
  dosage?: string | null;
  /** Free text today ("twice daily", "TDS") — not yet a structured schedule. */
  frequency?: string | null;
  durationDays?: number | string | null;
  quantity?: number | null;
  instructions?: string | null;
}

export interface PendingPrescription {
  prescriptionId: string;
  patientId?: string | null;
  patientName?: string | null;
  /** The payload spells this `uhidNumber`, not `uhid`. */
  uhidNumber?: string | null;
  doctorName?: string | null;
  /** When it was written — the endpoint spreads the prescription row. */
  prescriptionDate?: string | null;
  createdAt?: string;
  items: PrescriptionItem[];
}

export interface PharmacyOrderLine {
  medicineId: string;
  medicineName?: string;
  quantity: number;
  unitPrice: Money;
}

// ── IPD medication administration ────────────────────────────────────────────

/**
 * One scheduled or administered dose on the treatment chart (MAR) — a
 * MedicationAdministration row plus the resolved staff name the API adds.
 * PENDING | GIVEN | MISSED | HELD; a PENDING dose whose scheduledAt is in the
 * past is the unsigned-for gap a drug round is meant to close.
 */
export interface MedicationDose {
  ipMedAdminId: string;
  ipMedOrderId?: string | null;
  scheduledAt: string;
  status: string;
  administeredAt?: string | null;
  administeredBy?: string | null;
  /** Resolved display name for administeredBy; null when never given. */
  givenBy?: string | null;
  /** Fluid given with an infused dose — counted in the patient's intake total. */
  infusedVolumeMl?: number | null;
  notes?: string | null;
}

/**
 * An in-patient medication order as the MAR endpoint projects it.
 * REQUESTED (asked for, nothing dispensed) -> ACTIVE (pharmacy confirmed,
 * stock deducted, doses generated) -> BILLED; CANCELLED before BILLED.
 */
export interface MedicationOrder {
  ipMedOrderId: string;
  medicineName: string | null;
  dosage?: string | null;
  /** Free text today ("TDS", "twice daily") — not a structured schedule. */
  frequency?: string | null;
  route?: string | null;
  durationDays?: number | null;
  status: string;
  orderedAt?: string | null;
  /** Resolved prescriber name, not the raw user id. */
  orderedBy?: string | null;
  notes?: string | null;
  /** True for infused routes: the chart prompts for volume when a dose is given. */
  carriesFluid?: boolean;
  doses: MedicationDose[];
}

/** A recorded patient allergy. `allergenType` distinguishes a structured drug
 *  salt (matchable) from free text (displayed, never matched on). */
export interface PatientAllergyRow {
  patientAllergyId?: string;
  allergen: string;
  allergenType?: string | null;
  normalizedAllergen?: string | null;
  reaction?: string | null;
  severity?: string | null;
}

/**
 * A hit from the doctor's prescription medicine search: a narrow Medicine
 * projection plus stock summed across batches. Deliberately not the full
 * catalog row — the search only selects these four fields.
 */
export interface PrescribableMedicine {
  medicineId: string;
  medicineName: string | null;
  genericName: string;
  sellingPrice: Money;
  inStock: number;
}

/**
 * A whole in-patient medication order row, as the admission medications list
 * returns it (GET /ipd/admissions/:id/medications). Distinct from
 * MedicationOrder, which is the narrower MAR projection carrying doses.
 */
export interface InpatientMedicationRow {
  ipMedOrderId: string;
  admissionId?: string | null;
  patientId?: string | null;
  medicineId?: string | null;
  medicineName: string | null;
  dosage?: string | null;
  frequency?: string | null;
  durationDays?: number | null;
  route?: string | null;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  /** REQUESTED -> ACTIVE -> BILLED; CANCELLED before BILLED. */
  status: string;
  notes?: string | null;
  orderedAt?: string | null;
  orderedBy?: string | null;
}
