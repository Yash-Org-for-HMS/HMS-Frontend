import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Stack } from "@mui/material";
import { ArrowBackRounded, PersonRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import { usePanelBase } from "./panelBase";
import { BillingTab } from "./OtCaseRecord";

/**
 * A theatre case as reception sees it: the bill, and nothing clinical.
 *
 * Reception books the operating list and bills the case, but what happened in
 * theatre — team, implants, times, the WHO checklist, counts, consent — is not
 * front-desk work, and the server refuses those endpoints to the role. So the
 * receptionist opening a case from the list lands here instead of on the
 * operative record: the same bill lines the record shows, from the one endpoint
 * reception is allowed, titled from the case summary that endpoint returns.
 */
export default function OtCaseBilling() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const basePath = usePanelBase();

  // Same key as BillingTab, so the two share one request.
  const { data } = useQuery({
    queryKey: ["ot-case-charges", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/charges`)).data.data,
  });
  const c = data?.case as { procedureName?: string; patientId?: string; patientName?: string | null; uhid?: string | null } | undefined;

  return (
    <Box>
      <PageHeader
        title={c?.procedureName || "Theatre case"}
        subtitle={c?.patientName ? `${c.patientName}${c.uhid ? ` · ${c.uhid}` : ""} — the bill for this case` : "The bill for this case"}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {c?.patientId && (
              <Button startIcon={<PersonRounded />} sx={{ textTransform: "none" }}
                onClick={() => navigate(`${basePath}/patients/${c.patientId}`)}>
                Patient profile
              </Button>
            )}
            <Button startIcon={<ArrowBackRounded />} sx={{ textTransform: "none" }} onClick={() => navigate(-1)}>
              Back to the list
            </Button>
          </Stack>
        }
      />
      <BillingTab id={id} />
    </Box>
  );
}
