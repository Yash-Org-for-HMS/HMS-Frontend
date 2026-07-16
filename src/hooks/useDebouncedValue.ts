import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms have
 * elapsed without `value` changing. Extracted from the many list/search pages
 * that each hand-rolled the identical setTimeout/clearTimeout debounce for their
 * search box (MedicineCatalog, SupplierDirectory, DoctorsList, DoctorPatients,
 * DoctorResults, NotificationsLog, UsersList, GenerateInvoice, Billing…).
 *
 * Behaviour matches the previous inline effect exactly: the debounced value
 * starts equal to the initial `value`, and each change reschedules a single
 * timer that is cleared on the next change/unmount.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
