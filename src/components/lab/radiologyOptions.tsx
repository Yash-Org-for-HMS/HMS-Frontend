import { MenuItem, ListSubheader } from "@mui/material";

// Radiology tests are mastered in the Schedule of Charges and can be organized
// into categories (X-Ray, CT, MRI…). These helpers render a radiology-test
// <TextField select> grouped by that category, with the value = chargeItemId.

export function groupRadiologyByCategory(catalog: any[]): { cat: string; items: any[] }[] {
  const by = new Map<string, any[]>();
  for (const t of catalog || []) {
    const g = (t.category || "Radiology") as string;
    if (!by.has(g)) by.set(g, []);
    by.get(g)!.push(t);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, items]) => ({ cat, items: items.slice().sort((a, b) => String(a.testName).localeCompare(String(b.testName))) }));
}

// Grouped <ListSubheader> + <MenuItem> nodes. Category subheaders appear only when
// there's more than one category, so a single "Radiology" bucket stays a flat list.
export function renderRadiologyOptions(catalog: any[], priceLabel: (p: any) => string) {
  const groups = groupRadiologyByCategory(catalog);
  if (groups.length <= 1) {
    return (groups[0]?.items || []).map((t: any) => (
      <MenuItem key={t.chargeItemId} value={t.chargeItemId}>{t.testName}{priceLabel(t.price)}</MenuItem>
    ));
  }
  return groups.flatMap((g) => [
    <ListSubheader key={`h-${g.cat}`} sx={{ lineHeight: "34px", fontWeight: 700, color: "text.secondary" }}>{g.cat}</ListSubheader>,
    ...g.items.map((t: any) => (
      <MenuItem key={t.chargeItemId} value={t.chargeItemId} sx={{ pl: 3 }}>{t.testName}{priceLabel(t.price)}</MenuItem>
    )),
  ]);
}
