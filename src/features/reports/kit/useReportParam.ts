import { useSearchParams } from "react-router-dom";

/**
 * A report filter held in the URL rather than in component state.
 *
 * This is what lets a dashboard figure hand off to the rows behind it: the
 * dashboard links to `?view=onboarding&status=pending` and the register opens
 * already filtered, instead of the reader landing on an unfiltered table and
 * having to find the four tenants the number referred to.
 *
 * The value stays out of the URL while it equals `fallback`, so an untouched
 * report has a clean address and "no filter" has exactly one spelling.
 *
 * Changes REPLACE the history entry: a reader adjusting filters is refining one
 * view, not navigating, and pushing each keystroke-worth of state would bury
 * the page they arrived from under a dozen back-presses. Switching reports
 * pushes, which is handled in ReportNavLayout.
 */
export function useReportParam(name: string, fallback: string): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? fallback;

  const set = (next: string) => {
    const updated = new URLSearchParams(params);
    if (next === fallback) updated.delete(name);
    else updated.set(name, next);
    setParams(updated, { replace: true });
  };

  return [value, set];
}

/** The same, for an on/off filter. Present in the URL only while on. */
export function useReportFlag(name: string): [boolean, (value: boolean) => void] {
  const [raw, setRaw] = useReportParam(name, "");
  return [raw === "1", (v: boolean) => setRaw(v ? "1" : "")];
}
