import { MenuItem, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";

export type FilterOpt = { id: string | number; name: string };
export interface ReportFilterOptions {
  doctors: FilterOpt[];
  departments: FilterOpt[];
  appointmentStatuses: FilterOpt[];
  paymentMethods: FilterOpt[];
  collectors: FilterOpt[];
  wards: FilterOpt[];
  referralTypes: FilterOpt[];
}

/**
 * The option lists (doctors, departments, payment methods, …) that populate
 * report filter dropdowns for the caller's hospital/branch. Shares its cache key
 * with the reception reports page, so it's fetched once across all report pages.
 */
export function useReportFilterOptions() {
  return useQuery<ReportFilterOptions>({
    queryKey: ["report-filter-options"],
    queryFn: async () => (await axiosInstance.get("/reception/reports/filter-options")).data.data,
    staleTime: 5 * 60 * 1000,
  });
}

/** A single "All / …" report filter dropdown. Empty value ("") means no filter. */
export default function ReportFilterSelect({ label, value, onChange, options, width = 180 }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: FilterOpt[];
  width?: number;
}) {
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: width }}>
      <MenuItem value=""><em>All</em></MenuItem>
      {(options ?? []).map((o) => <MenuItem key={String(o.id)} value={String(o.id)}>{o.name}</MenuItem>)}
    </TextField>
  );
}
