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
}

export interface RoomNode {
  roomId: string;
  roomNumber: string;
  roomType?: string | null;
  status?: string | null;
  beds: BedNode[];
}

export interface WardNode {
  wardId: string;
  wardName: string;
  wardType?: string | null;
  floorNumber?: number | null;
  status?: string | null;
  rooms: RoomNode[];
}

export interface StructureSummary {
  totalBeds: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  wards: number;
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
  wardType: string;
  floorNumber: string;
  roomNumber?: string;
  roomType: string;
  bedNumber?: string;
  bedType: string;
  dailyCharge?: string;
  roomClassId: string;
}
