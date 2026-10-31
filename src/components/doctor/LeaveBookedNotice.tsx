import { Alert, Box, Typography } from "@mui/material";

export interface LeaveBooking {
  appointmentId: string;
  appointmentDate: string;
  patientName: string;
  phone: string | null;
}

/**
 * Patients still booked on days just marked as leave. Leave stops new bookings,
 * not the ones already made - and nothing said so, so those patients turned up
 * for a doctor who was off. Shown right after the leave is added.
 */
export default function LeaveBookedNotice({ booked, onClose }: { booked: LeaveBooking[]; onClose: () => void }) {
  if (!booked.length) return null;
  return (
    <Alert severity="warning" onClose={onClose} sx={{ borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
        {booked.length === 1 ? "1 patient is" : `${booked.length} patients are`} still booked on the leave day(s) - ask reception to move or cancel them
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {booked.map((b) => (
          <li key={b.appointmentId}>
            <Typography variant="body2">
              {new Date(b.appointmentDate).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}
              {" - "}{b.patientName}{b.phone ? ` (${b.phone})` : ""}
            </Typography>
          </li>
        ))}
      </Box>
    </Alert>
  );
}
