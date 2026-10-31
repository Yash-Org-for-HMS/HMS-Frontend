/**
 * Adult ranges for colouring a reading: "red" = act now, "amber" = outside
 * normal, undefined = normal. The same bands the doctor's consultation screen
 * uses, so a reading looks the same wherever it is read.
 */
export type Tone = "red" | "amber" | undefined;

export function bpTone(sys: number | null | undefined, dia: number | null | undefined): Tone {
  if (sys == null || dia == null) return undefined;
  if (sys >= 180 || sys < 90 || dia >= 120 || dia >= sys) return "red";
  if (sys >= 140 || dia >= 90 || dia < 60) return "amber";
  return undefined;
}
export function pulseTone(p: number | null | undefined): Tone {
  if (p == null) return undefined;
  return p > 120 || p < 50 ? "red" : p > 100 || p < 60 ? "amber" : undefined;
}
export function tempTone(t: number | null | undefined, unit: string | null | undefined): Tone {
  if (t == null) return undefined;
  const c = (unit ?? "C").toUpperCase() === "F" ? ((t - 32) * 5) / 9 : t;
  return c >= 39 || c < 35 ? "red" : c >= 37.6 ? "amber" : undefined;
}
export function spo2Tone(s: number | null | undefined): Tone {
  if (s == null) return undefined;
  return s < 90 ? "red" : s < 95 ? "amber" : undefined;
}
export function respTone(r: number | null | undefined): Tone {
  if (r == null) return undefined;
  return r > 30 || r < 8 ? "red" : r > 20 || r < 12 ? "amber" : undefined;
}
export function sugarTone(g: number | null | undefined): Tone {
  if (g == null) return undefined;
  return g < 70 || g > 300 ? "red" : g > 180 ? "amber" : undefined;
}
