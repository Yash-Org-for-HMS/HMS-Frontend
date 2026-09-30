import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";

/** Stock moving between two branches: requested → dispatched → received. */

export type TransferStatus = "REQUESTED" | "DISPATCHED" | "RECEIVED" | "CANCELLED";

export interface TransferRow {
  stockTransferId: string;
  transferNumber: string;
  status: TransferStatus;
  fromBranchId: string;
  toBranchId: string;
  fromBranchName: string;
  toBranchName: string;
  /** Relative to the branch the user is working at. */
  direction: "IN" | "OUT" | null;
  medicines: number;
  requested: number;
  sent: number;
  received: number | null;
  short: number | null;
  createdAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  canDispatch: boolean;
  canReceive: boolean;
  canCancel: boolean;
}

export interface TransferBatch {
  stockTransferBatchId: string;
  batchNumber: string;
  expiryDate: string;
  quantitySent: number;
  quantityReceived: number | null;
  shortReason: string | null;
}

export interface TransferItem {
  stockTransferItemId: string;
  medicineId: string;
  medicineName: string;
  requestedQuantity: number;
  sentQuantity: number;
  receivedQuantity: number | null;
  onHandAtReceiver: number | null;
  batches: TransferBatch[];
  /** The sending branch's batches to pick from — only for the one dispatching. */
  available: { inventoryId: string; batchNumber: string; expiryDate: string; availableQuantity: number }[];
}

export interface TransferDetail {
  stockTransferId: string;
  transferNumber: string;
  status: TransferStatus;
  fromBranchId: string;
  toBranchId: string;
  fromBranchName: string;
  toBranchName: string;
  notes: string | null;
  createdAt: string;
  requestedBy: string | null;
  dispatchedAt: string | null;
  dispatchedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  gstNote: string | null;
  canDispatch: boolean;
  canReceive: boolean;
  canCancel: boolean;
  items: TransferItem[];
}

export interface TransferBranch { branchId: string; branchName: string; worksHere: boolean }

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; color: string }> = {
  REQUESTED: { label: "Waiting to be sent", color: SEMANTIC.warning },
  DISPATCHED: { label: "On the road", color: SEMANTIC.info },
  RECEIVED: { label: "Received", color: SEMANTIC.success },
  CANCELLED: { label: "Cancelled", color: NEUTRAL.muted },
};

/**
 * The hospital's open branches, and the reasons a receipt can be short. A
 * hospital with one branch has nothing to transfer between, and the screens
 * stay hidden.
 */
export function useTransferBranches() {
  return useQuery<{ branches: TransferBranch[]; shortReasons: string[] }>({
    queryKey: ["stock-transfer-branches"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/stock-transfers/branches")).data.data,
    staleTime: 5 * 60_000,
  });
}
