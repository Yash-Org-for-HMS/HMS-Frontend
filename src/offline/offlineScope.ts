/**
 * What keeps working when the network drops - the main desks, nothing more
 * (Nov 2026: "if the hospital has a network issue the main thing will not
 * stop"). Everything else needs the network and says so.
 *
 * OFFLINE_PAGES: the screens that keep working (the top bar marks them
 * "Works offline"); what they load is kept and shown again while offline.
 * OFFLINE_SAVES: the saves those screens make that wait on this computer and
 * are sent when the network is back. The server checks every rule when they
 * arrive, and the Idempotency-Key makes a resend harmless.
 */

const ID = "[^/?]+";
const path = (p: string) => new RegExp(`^${p.replace(/:id/g, ID)}/?(?:\\?.*)?$`);

export const OFFLINE_PAGES: RegExp[] = [
  // Reception: register, book and check in, the OPD bill and payment.
  "/reception/desk", "/reception/queue", "/reception/patients/new", "/reception/patients/:id/edit",
  "/reception/appointments/new", "/reception/billing",
  // Doctor: the queue and the consultation (notes, prescription, lab and X-ray orders).
  "/doctor/queue", "/doctor/consultation/:id",
  // Nursing: vitals, the ward and its charts (notes, observations, medicine charting).
  "/nurse/vitals", "/nurse/queue", "/nurse/ward", "/nurse/my-wards", "/nurse/chart/:id",
  // Pharmacy: the medicine sale.
  "/pharmacy/pos",
  // The bed board, and ward charges from the admissions list.
  "/:panel/ipd/beds", "/:panel/ipd/admissions",
].map((p) => path(p.replace(":panel", "(?:hospital|reception|nurse)")));

type Save = { method: string; url: RegExp; label: string };
const save = (method: string, p: string, label: string): Save => ({ method, url: path(p), label });

export const OFFLINE_SAVES: Save[] = [
  save("post", "/reception/patients", "Patient registration"),
  save("put", "/reception/patients/:id", "Patient details"),
  save("post", "/reception/appointments", "Appointment"),
  save("put", "/reception/appointments/:id/checkin", "Check-in"),
  save("post", "/reception/vitals", "Vitals"),
  save("post", "/billing/invoices/:id", "OPD bill"),
  save("post", "/billing/payments/:id", "Payment"),
  save("post", "/reception/billing/invoices/:id/payment", "Payment"),
  save("post", "/reception/billing/appointments/:id/generate-invoice", "Consultation bill"),
  save("post", "/doctor/consultation/appointments/:id", "Consultation notes"),
  save("post", "/doctor/consultation/appointments/:id/complete", "Consultation completed"),
  save("post", "/doctor/prescription/consultations/:id", "Prescription"),
  save("post", "/doctor/lab-orders/consultations/:id", "Lab order"),
  save("post", "/doctor/radiology-orders/consultations/:id", "X-ray / scan order"),
  save("post", "/pharmacy/orders", "Medicine sale"),
  save("post", "/ipd/admissions/:id/observations", "Observations"),
  save("post", "/ipd/admissions/:id/nursing-notes", "Nursing note"),
  save("post", "/ipd/mar/:id", "Medicine given"),
  save("post", "/ipd/admissions/:id/charges", "Ward charge"),
];

/** The page in the address bar keeps working offline. */
export const pageWorksOffline = (pathname: string) => OFFLINE_PAGES.some((re) => re.test(pathname));

/** The save waits for the network when it cannot be sent; its name for the sync tray. */
export function offlineSave(method: string | undefined, url: string | undefined): Save | undefined {
  if (!method || !url) return undefined;
  const m = method.toLowerCase();
  const u = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api(?=\/)/, "");
  return OFFLINE_SAVES.find((s) => s.method === m && s.url.test(u));
}
