import type { Money } from "@/types";

/**
 * The bed board and its pricing, mirrored from
 * backend/src/modules/ipd/beds.controller.ts and the room-class rent routes.
 */

/** Set only on an OCCUPIED bed — the admission currently in it. */
export interface BedOccupant {
  admissionId: string;
  patientName: string;
  uhid: string;
  admissionDate?: string | null;
}

export interface BedNode {
  bedId: string;
  bedNumber: string;
  bedType?: string | null;
  status: string;
  /** A Prisma Decimal — Number() it before arithmetic. */
  dailyCharge?: Money | null;
  /** Null means the bed is priced by its own dailyCharge, not by a class. */
  roomClassId?: string | null;
  roomClassName?: string | null;
  occupant?: BedOccupant | null;
  /** {WARD}-{ROOM}-{BED}, e.g. MICU-305-01. */
  bedCode?: string | null;
  hospitalBedTypeId?: string | null;
  bedTypeName?: string | null;
  /** False for an attendant bed — never allocated, never counted. */
  isPatientBed?: boolean;
  isTemporary?: boolean;
  isActive?: boolean;
}

export interface RoomNode {
  roomId: string;
  roomNumber: string;
  roomType?: string | null;
  status?: string | null;
  beds: BedNode[];
  hospitalRoomTypeId?: string | null;
  roomTypeName?: string | null;
  capacity?: number | null;
  amenities?: string[];
}

export interface WardNode {
  wardId: string;
  wardName: string;
  wardType?: string | null;
  floorNumber?: number | null;
  status?: string | null;
  rooms: RoomNode[];
  wardCode?: string | null;
  hospitalWardTypeId?: string | null;
  wardTypeName?: string | null;
  wardTypeCode?: string | null;
  isCriticalCare?: boolean;
  countsInCensus?: boolean;
  billingMode?: string;
  /** The ward type's rule: NO (always mixed) | ALLOWED | FEMALE_ONLY. */
  genderRule?: string;
  genderRestriction?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  floorId?: string | null;
  floorLabel?: string;
}

/** Licensed capacity and its breakdown (workbook sheet 16 definitions). */
export interface CensusSummary {
  physicalBeds: number;
  censusBeds: number;
  nonCensusBeds: number;
  criticalCareBeds: number;
  premiumBeds: number;
  generalBeds: number;
}

export interface StructureSummary {
  totalBeds: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  wards: number;
  census?: CensusSummary;
}

export interface IpdStructure {
  wards: WardNode[];
  summary: StructureSummary;
}

/** A room class from the SOC catalogue — the same list the price matrix uses. */
export interface RoomClass {
  roomClassId: string;
  name: string;
  code?: string | null;
  sortOrder?: number | null;
  isActive: boolean;
}

/** One class's nightly rate. `rent` null = no rate set for that class yet. */
export interface RoomClassRent {
  roomClassId: string;
  name: string;
  rent: number | null;
}

/**
 * GET /ipd/room-class-rents.
 *
 * `configured` is false until the hospital has a room-rent charge in the SOC at
 * all; `baseRent` is that charge's own price, the fallback for a bed with no
 * class. The per-class rates override it — the hospital genuinely bills the
 * same night differently by class, so this is a matrix, not one number.
 */
export interface RoomClassRentsResponse {
  configured: boolean;
  itemName?: string | null;
  baseRent: number | null;
  rents: RoomClassRent[];
}

// ── What the setup forms pick from (GET /ipd/facility-options) ──────────────

export interface HospitalWardType {
  id: string; code: string; displayName: string; isActive: boolean;
  isCriticalCare: boolean; countsInCensus: boolean; defaultBillingMode: string;
  genderRestriction: string; nursePatientRatio?: string | null; requiresTransferApproval: boolean;
}
export interface HospitalRoomType {
  id: string; code: string; displayName: string; isActive: boolean;
  typicalCapacity: string; isolationCapable: boolean; pressureType: string; isProcedureRoom: boolean; attendantAllowed: boolean;
}
export interface HospitalBedType {
  id: string; code: string; displayName: string; isActive: boolean; isPatientBed: boolean; countsAsLicensedBed: boolean;
}
export interface Building { buildingId: string; code: string; name: string; isActive: boolean }
export interface Floor { floorId: string; floorNumber: number; name: string; buildingId?: string | null; building?: { name: string } | null; isActive: boolean }
export interface FacilityOptions {
  wardTypes: HospitalWardType[];
  roomTypes: HospitalRoomType[];
  bedTypes: HospitalBedType[];
  departments: { departmentId: string; departmentName: string; departmentCode: string }[];
  buildings: Building[];
  floors: Floor[];
  postingTypes: { code: string; meaning: string }[];
}
export interface ServiceUnit {
  serviceUnitId: string; code: string; name: string; postingType: string; isActive: boolean;
  departmentId?: string | null; floorId?: string | null;
  department?: { departmentName: string } | null;
  floor?: { name: string; building?: { name: string } | null } | null;
}

export type FacilityKind = "ward" | "room" | "bed";

/**
 * The node the setup dialog is editing. Which kind it is comes from `kind`
 * alongside it, not from the shape, so every field is optional — a union would
 * only force a cast at every read.
 */
export interface FacilityEditTarget {
  wardId?: string;
  roomId?: string;
  bedId?: string;
  wardName?: string;
  wardType?: string | null;
  floorNumber?: number | null;
  roomNumber?: string;
  roomType?: string | null;
  bedNumber?: string;
  bedType?: string | null;
  dailyCharge?: Money | null;
  roomClassId?: string | null;
  wardCode?: string | null;
  hospitalWardTypeId?: string | null;
  departmentId?: string | null;
  genderRestriction?: string;
  floorId?: string | null;
  hospitalRoomTypeId?: string | null;
  capacity?: number | null;
  amenities?: string[];
  hospitalBedTypeId?: string | null;
  bedCode?: string | null;
  isTemporary?: boolean;
  isActive?: boolean;
}

/**
 * The dialog's form, one flat shape serving all three kinds. Numeric inputs are
 * held as strings while editing so a half-typed value stays on screen.
 */
export interface SetupForm {
  wardId?: string;
  roomId?: string;
  bedId?: string;
  wardName?: string;
  floorNumber: string;
  roomNumber?: string;
  bedNumber?: string;
  dailyCharge?: string;
  roomClassId: string;
  wardCode: string;
  hospitalWardTypeId: string;
  departmentId: string;
  genderRestriction: string;
  floorId: string;
  hospitalRoomTypeId: string;
  capacity: string;
  amenities: string;
  hospitalBedTypeId: string;
  bedCode: string;
  isTemporary: boolean;
  isActive: boolean;
}
