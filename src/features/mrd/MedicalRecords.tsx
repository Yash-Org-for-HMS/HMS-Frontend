import { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import PageHeader from "@/components/layout/PageHeader";
import MlcRegister from "./MlcRegister";
import Certificates from "./Certificates";
import FilesAndCopies from "./FilesAndCopies";

/**
 * Medical Records' registers (15_System_Roles MRD): the medico-legal register,
 * numbered certificates, and the file and copies log. For Medical Records and
 * the hospital's admins ("mrd.records").
 */
export default function MedicalRecords() {
  const [tab, setTab] = useState(0);
  const tabs = [
    { label: "Medico-legal register", node: <MlcRegister /> },
    { label: "Certificates", node: <Certificates /> },
    { label: "Files & copies", node: <FilesAndCopies /> },
  ];
  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader title="Medical records" subtitle="Medico-legal cases, numbered certificates, and where every file is." />
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
        {tabs.map((t) => <Tab key={t.label} label={t.label} sx={{ textTransform: "none", fontWeight: 700 }} />)}
      </Tabs>
      {tabs[tab].node}
    </Box>
  );
}
