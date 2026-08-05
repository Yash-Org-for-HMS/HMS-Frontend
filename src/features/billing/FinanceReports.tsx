import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Grid } from "@mui/material";
import {
  SouthEastRounded, NorthEastRounded, AccountBalanceRounded, SwapVertRounded,
  TrendingUpRounded, ReceiptLongRounded, LocalOfferRounded, AccountBalanceWalletRounded,
  ReplayRounded, PercentRounded, BlockRounded, NumbersRounded,
  GroupsRounded, EventAvailableRounded, MedicalServicesRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";
import { KpiCard, ReportFilters, ReportFilterSelect, ReportTable, useReportFilterOptions, type DateRange } from "@/features/reports/kit";

const inr = formatINRAuto;
const rangeFrom = (days: number): DateRange => ({ from: dayjs().subtract(days, "day").format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") });
const ts = (v: any) => (v ? new Date(v).getTime() : 0);
const money = (key: string, label: string) => ({ key, label, align: "right" as const, format: (v: any) => inr(v), value: (r: any) => Number(r[key]) });

// ── Day Book (Cash Book) ──────────────────────────────────────────────────────
// Cash basis: what money physically came in and went out, and through which
// tender. Distinct from Revenue (which is billed/accrual).
export function DayBook() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(0)); // defaults to today
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-day-book", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/day-book", { params: { from: range.from, to: range.to } })).data.data,
  });
  const byMode: any[] = data?.byMode ?? [];
  const bySource: any[] = data?.bySource ?? [];
  const byCollector: any[] = data?.byCollector ?? [];
  const rows: any[] = data?.rows ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SouthEastRounded />} accent={SEMANTIC.success} label="Money in" value={inr(data.totals.cashIn)} current={Number(data.totals.cashIn)} previous={prev ? Number(prev.cashIn) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<NorthEastRounded />} accent={SEMANTIC.danger} label="Money out" value={inr(data.totals.cashOut)} current={Number(data.totals.cashOut)} previous={prev ? Number(prev.cashOut) : undefined} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceRounded />} accent={SEMANTIC.info} label="Net position" value={inr(data.totals.net)} current={Number(data.totals.net)} previous={prev ? Number(prev.net) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<SwapVertRounded />} accent="#8b5cf6" label="Movements" value={String(data.totals.movements)} /></Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable
                title="Payment-mode reconciliation"
                filename={`daybook_by_mode_${range.from}_${range.to}`}
                maxHeight={320}
                columns={[
                  { key: "mode", label: "Mode" },
                  money("in", "In"),
                  money("out", "Out"),
                  money("net", "Net"),
                  { key: "count", label: "Txns", align: "right" },
                ]}
                rows={byMode}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable
                title="By source"
                filename={`daybook_by_source_${range.from}_${range.to}`}
                maxHeight={320}
                columns={[
                  { key: "source", label: "Source" },
                  money("in", "In"),
                  money("out", "Out"),
                ]}
                rows={bySource}
              />
            </Grid>
          </Grid>

          {byCollector.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <ReportTable
                title="By collector"
                filename={`daybook_by_collector_${range.from}_${range.to}`}
                maxHeight={280}
                columns={[
                  { key: "collector", label: "Collector" },
                  money("in", "Collected"),
                  money("out", "Refunded"),
                  money("net", "Net"),
                ]}
                rows={byCollector}
              />
            </Box>
          )}

          <ReportTable
            title="Cash book ledger"
            filename={`daybook_ledger_${range.from}_${range.to}`}
            columns={[
              { key: "at", label: "Date / time", format: (v) => (v ? dayjs(v).format("DD MMM YY HH:mm") : "—"), value: (r) => ts(r.at) },
              { key: "type", label: "Type" },
              { key: "patientName", label: "Patient" },
              { key: "ref", label: "Reference" },
              { key: "mode", label: "Mode" },
              money("inAmount", "In"),
              money("outAmount", "Out"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Revenue analytics ─────────────────────────────────────────────────────────
// Billed / accrual basis: what was invoiced (regardless of collection). Distinct
// from the Day Book's cash. By category, OPD doctor, and department.
export function RevenueAnalytics() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-revenue", range.from, range.to, doctorId, departmentId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/revenue", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined, departmentId: departmentId || undefined } })).data.data,
  });
  const byCategory: any[] = data?.byCategory ?? [];
  const byDoctor: any[] = data?.byDoctor ?? [];
  const byDepartment: any[] = data?.byDepartment ?? [];
  const prev = data?.previous;

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
        <ReportFilterSelect label="Department" value={departmentId} onChange={setDepartmentId} options={opts?.departments} />
      </ReportFilters>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.success} label="Net revenue (billed)" value={inr(data.totals.net)} current={Number(data.totals.net)} previous={prev ? Number(prev.net) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReceiptLongRounded />} accent="#8b5cf6" label="Gross" value={inr(data.totals.gross)} current={Number(data.totals.gross)} previous={prev ? Number(prev.gross) : undefined} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalOfferRounded />} accent={SEMANTIC.warning} label="Discount" value={inr(data.totals.discount)} current={Number(data.totals.discount)} previous={prev ? Number(prev.discount) : undefined} higherIsBetter={false} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} accent={SEMANTIC.info} label="Tax (GST)" value={inr(data.totals.tax)} current={Number(data.totals.tax)} previous={prev ? Number(prev.tax) : undefined} /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Revenue by category" filename={`revenue_by_category_${range.from}_${range.to}`} maxHeight={340}
                columns={[{ key: "category", label: "Category" }, money("amount", "Revenue")]} rows={byCategory} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="Revenue by department" filename={`revenue_by_department_${range.from}_${range.to}`} maxHeight={340}
                columns={[{ key: "department", label: "Department" }, money("amount", "Revenue")]} rows={byDepartment} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ReportTable title="Revenue by doctor" filename={`revenue_by_doctor_${range.from}_${range.to}`} maxHeight={360}
                columns={[{ key: "doctor", label: "Doctor" }, money("amount", "Revenue")]} rows={byDoctor} />
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ── Refund register ───────────────────────────────────────────────────────────
export function RefundRegister() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-refunds", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/refund-register", { params: { from: range.from, to: range.to } })).data.data,
  });
  const byReason: any[] = data?.byReason ?? [];
  const byProcessor: any[] = data?.byProcessor ?? [];
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ReplayRounded />} accent={SEMANTIC.danger} label="Total refunded" value={inr(data.totals.total)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<NumbersRounded />} accent="#8b5cf6" label="Refunds" value={String(data.totals.count)} /></Grid>
          </Grid>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="By reason" filename={`refunds_by_reason_${range.from}_${range.to}`} maxHeight={300}
                columns={[{ key: "reason", label: "Reason" }, { key: "count", label: "Count", align: "right" }, money("amount", "Amount")]} rows={byReason} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ReportTable title="By processed by" filename={`refunds_by_processor_${range.from}_${range.to}`} maxHeight={300}
                columns={[{ key: "processor", label: "Processed by" }, { key: "count", label: "Count", align: "right" }, money("amount", "Amount")]} rows={byProcessor} />
            </Grid>
          </Grid>
          <ReportTable
            title="Refund register"
            filename={`refund_register_${range.from}_${range.to}`}
            columns={[
              { key: "date", label: "Date", format: (v) => (v ? dayjs(v).format("DD MMM YY HH:mm") : "—"), value: (r) => ts(r.date) },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "invoiceNumber", label: "Invoice" },
              money("amount", "Amount"),
              { key: "reason", label: "Reason" },
              { key: "processedBy", label: "Processed by" },
              { key: "status", label: "Status" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Discount / concession register ────────────────────────────────────────────
export function DiscountRegister() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-discounts", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/discount-register", { params: { from: range.from, to: range.to } })).data.data,
  });
  const byUser: any[] = data?.byUser ?? [];
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalOfferRounded />} accent={SEMANTIC.warning} label="Total discount" value={inr(data.totals.totalDiscount)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<NumbersRounded />} accent="#8b5cf6" label="Discounted invoices" value={String(data.totals.count)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PercentRounded />} accent={SEMANTIC.info} label="Avg discount" value={`${data.totals.avgPct}%`} /></Grid>
          </Grid>
          <Box sx={{ mb: 2.5 }}>
            <ReportTable title="By staff (who applied)" filename={`discounts_by_user_${range.from}_${range.to}`} maxHeight={300}
              columns={[{ key: "user", label: "Staff" }, { key: "count", label: "Count", align: "right" }, money("amount", "Discount")]} rows={byUser} />
          </Box>
          <ReportTable
            title="Discount / concession register"
            filename={`discount_register_${range.from}_${range.to}`}
            columns={[
              { key: "date", label: "Date", format: (v) => (v ? dayjs(v).format("DD MMM YYYY") : "—"), value: (r) => ts(r.date) },
              { key: "invoiceNumber", label: "Invoice" },
              { key: "patientName", label: "Patient" },
              money("gross", "Gross"),
              money("discount", "Discount"),
              money("net", "Net"),
              { key: "discountPct", label: "Disc %", align: "right", format: (v) => `${v}%`, value: (r) => Number(r.discountPct) },
              { key: "appliedBy", label: "Applied by" },
              { key: "reason", label: "Reason" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Cancelled / void invoice register ─────────────────────────────────────────
export function CancelledInvoices() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-cancelled", range.from, range.to],
    queryFn: async () => (await axiosInstance.get("/reception/reports/cancelled-invoices", { params: { from: range.from, to: range.to } })).data.data,
  });
  const byUser: any[] = data?.byUser ?? [];
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange} />
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<BlockRounded />} accent={SEMANTIC.danger} label="Cancelled invoices" value={String(data.totals.count)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceRounded />} accent={SEMANTIC.warning} label="Value voided" value={inr(data.totals.totalValue)} /></Grid>
          </Grid>
          <Box sx={{ mb: 2.5 }}>
            <ReportTable title="By staff (who cancelled)" filename={`cancelled_by_user_${range.from}_${range.to}`} maxHeight={300}
              columns={[{ key: "user", label: "Staff" }, { key: "count", label: "Count", align: "right" }, money("amount", "Value")]} rows={byUser} />
          </Box>
          <ReportTable
            title="Cancelled / void invoice register"
            filename={`cancelled_invoices_${range.from}_${range.to}`}
            columns={[
              { key: "invoiceNumber", label: "Invoice" },
              { key: "patientName", label: "Patient" },
              { key: "uhid", label: "UHID" },
              { key: "invoiceDate", label: "Invoice date", format: (v) => (v ? dayjs(v).format("DD MMM YYYY") : "—"), value: (r) => ts(r.invoiceDate) },
              { key: "cancelledOn", label: "Cancelled on", format: (v) => (v ? dayjs(v).format("DD MMM YY HH:mm") : "—"), value: (r) => ts(r.cancelledOn) },
              money("amount", "Value"),
              { key: "cancelledBy", label: "Cancelled by" },
              { key: "reason", label: "Reason" },
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Doctor productivity & earnings (admin, cross-doctor) ───────────────────────
export function DoctorProductivity() {
  const [range, setRange] = useState<DateRange>(() => rangeFrom(29));
  const [doctorId, setDoctorId] = useState("");
  const { data: opts } = useReportFilterOptions();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["finance-doctor-productivity", range.from, range.to, doctorId],
    queryFn: async () => (await axiosInstance.get("/reception/reports/doctor-productivity", { params: { from: range.from, to: range.to, doctorId: doctorId || undefined } })).data.data,
  });
  const rows: any[] = data?.rows ?? [];

  return (
    <Box>
      <ReportFilters value={range} onChange={setRange}>
        <ReportFilterSelect label="Doctor" value={doctorId} onChange={setDoctorId} options={opts?.doctors} />
      </ReportFilters>
      {isLoading ? <ReportSkeleton /> : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : (
        <Box>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<GroupsRounded />} accent="#8b5cf6" label="Active doctors" value={String(data.totals.doctors)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<EventAvailableRounded />} accent={SEMANTIC.info} label="Appointments" value={String(data.totals.appointments)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MedicalServicesRounded />} accent={SEMANTIC.success} label="Consultations" value={String(data.totals.consultations)} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TrendingUpRounded />} accent={SEMANTIC.success} label="Revenue (billed)" value={inr(data.totals.revenue)} /></Grid>
          </Grid>
          <ReportTable
            title="Doctor productivity & earnings"
            filename={`doctor_productivity_${range.from}_${range.to}`}
            columns={[
              { key: "doctor", label: "Doctor" },
              { key: "appointments", label: "Appts", align: "right" },
              { key: "completed", label: "Completed", align: "right" },
              { key: "completionRate", label: "Completion %", align: "right", format: (v) => `${v}%`, value: (r) => Number(r.completionRate) },
              { key: "consultations", label: "Consults", align: "right" },
              money("revenue", "Revenue (billed)"),
            ]}
            rows={rows}
            truncated={data.truncated} totalRows={data.totalRows} shownRows={data.shownRows}
          />
        </Box>
      )}
    </Box>
  );
}
