// Shared allergy safety matcher (mirrors HMS-Backend/src/modules/clinical/allergyMatch.ts).
//
// Advisory only: it flags prescribing/ordering a drug whose name or generic
// directly matches a documented allergen. It is NOT a drug-interaction engine and
// does not know drug-class cross-reactivity (e.g. penicillin → amoxicillin) — the
// data has no ingredient ontology. Warn, never block; clinical judgement decides.

const normalize = (s?: string | null): string => (s || "").toLowerCase().trim();

/** Documented allergens that match a medicine's name or generic name. */
export function allergyHitsFor(allergens: string[], medicineName?: string | null, genericName?: string | null): string[] {
  const names = [normalize(medicineName), normalize(genericName)].filter(Boolean);
  if (!names.length) return [];
  return allergens.filter((al) => {
    const a = normalize(al);
    if (a.length < 3) return false;
    return names.some((n) => n.length >= 3 && (n.includes(a) || a.includes(n)));
  });
}
