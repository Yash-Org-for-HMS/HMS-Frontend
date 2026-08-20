import { useRef } from "react";
import { printHtml } from "@/utils/printHtml";
import { Dialog, DialogContent, DialogActions, Button, Box, Paper } from "@mui/material";
import { PrintRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import ErrorState from "@/components/ErrorState";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import RefundReceipt, { type RefundReceiptData } from "@/components/billing/RefundReceipt";

/**
 * View and print the receipt for one refund.
 *
 * Fetches the whole document from the server rather than assembling it from
 * whatever the calling screen happens to hold — the billing modal has most of
 * it, the approvals queue has almost none, and two assemblies of the same
 * document drift apart. The server also refuses a receipt for a refund that has
 * not completed, so a pending refund cannot be printed as though the patient
 * had been paid.
 */
export default function RefundReceiptDialog({
  refundId, open, onClose,
}: { refundId: string | null; open: boolean; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isError, error } = useQuery<RefundReceiptData>({
    queryKey: ["refund-receipt", refundId],
    enabled: open && !!refundId,
    queryFn: async () => (await axiosInstance.get(`/reception/billing/refunds/${refundId}/receipt`)).data?.data,
  });

  // Print through a hidden iframe, cloning the page's own stylesheets so the
  // printed document matches what is on screen. Printing the whole window would
  // carry the dialog chrome and the app shell onto the paper.
  const handlePrint = () => {
    if (!printRef.current) return;
    const contents = printRef.current.innerHTML;
    printHtml(contents, {
      title: "Refund Receipt",
      extraCss:
        "@media print{@page{margin:12mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}" +
        'body{background:#fff;margin:0;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ bgcolor: "background.default" }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><HeartbeatLoader size={60} /></Box>
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error, "Couldn't load this receipt")} />
        ) : data ? (
          <Paper ref={printRef} elevation={0} sx={{ p: 3, bgcolor: "#fff", color: "#000", borderRadius: 2 }}>
            <RefundReceipt data={data} />
          </Paper>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
        <Button
          variant="contained" startIcon={<PrintRounded />}
          disabled={!data} onClick={handlePrint}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
}
