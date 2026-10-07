import { ACCENTS, NEUTRAL, SEMANTIC } from "@/styles/accents";

/**
 * The organisation chart's shapes and the pure logic behind it (backend
 * staff/orgChart.service): the reporting tree, the way to a person, and the
 * departments grouped under whoever oversees them. Nothing here assumes a
 * fixed hierarchy — the tops are whoever has no manager.
 */

export interface OrgDept { departmentId: string; departmentName: string; roleInDept: string; isHome: boolean }
export interface OrgPerson {
  staffId: string;
  name: string;
  designation: string | null;
  grade: number | null;
  categoryCode: string;
  category: string;
  status: string;
  hasLogin: boolean;
  branches: string[];
  posting: string | null;
  departments: OrgDept[];
  adminManagerId: string | null;
  functionalManagerId: string | null;
  managerLeft: boolean;
}
export interface OrgDepartment { departmentId: string; departmentName: string; group: string | null; headStaffIds: string[] }
export interface OrgChartData { people: OrgPerson[]; departments: OrgDepartment[]; branchCount: number }

/** HR (administrative) lines, or day-to-day (functional) — the latter falls back to HR where none is set. */
export type Line = "hr" | "daily";

export const managerOf = (p: OrgPerson, line: Line) => (line === "daily" ? p.functionalManagerId ?? p.adminManagerId : p.adminManagerId);

export interface OrgNode { person: OrgPerson; children: OrgNode[]; size: number }

const byRank = (a: OrgPerson, b: OrgPerson) => (a.grade ?? 99) - (b.grade ?? 99) || a.name.localeCompare(b.name);

/**
 * The reporting tree: a forest, because an organisation may have several tops.
 * A loop in the data (the server refuses them, but old rows could hold one)
 * cannot hang it — whoever closes a loop becomes a top.
 * `size` is everyone under a node, the node not counted.
 */
export function buildForest(people: OrgPerson[], line: Line): OrgNode[] {
  const byId = new Map(people.map((p) => [p.staffId, p]));
  const parentOf = new Map<string, string | null>();
  for (const p of people) {
    const m = managerOf(p, line);
    parentOf.set(p.staffId, m && byId.has(m) ? m : null);
  }
  // Break loops: walk up from each person; meeting yourself means a loop.
  for (const p of people) {
    const seen = new Set<string>([p.staffId]);
    let up = parentOf.get(p.staffId) ?? null;
    while (up) {
      if (seen.has(up)) { parentOf.set(p.staffId, null); break; }
      seen.add(up);
      up = parentOf.get(up) ?? null;
    }
  }
  const kids = new Map<string, OrgPerson[]>();
  for (const p of people) {
    const parent = parentOf.get(p.staffId);
    if (parent) kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  const make = (p: OrgPerson): OrgNode => {
    const children = (kids.get(p.staffId) ?? []).sort(byRank).map(make);
    return { person: p, children, size: children.reduce((n, c) => n + 1 + c.size, 0) };
  };
  return people.filter((p) => !parentOf.get(p.staffId)).sort(byRank).map(make);
}

/**
 * Tops worth drawing as tops: someone with people under them, or the most
 * senior grades. Everyone else without a manager is "not placed yet" — listed
 * apart, so the chart is not a row of loose cards.
 */
export function splitUnplaced(forest: OrgNode[]): { tops: OrgNode[]; unplaced: OrgPerson[] } {
  const tops: OrgNode[] = [];
  const unplaced: OrgPerson[] = [];
  for (const n of forest) {
    if (n.children.length || (n.person.grade != null && n.person.grade <= 2)) tops.push(n);
    else unplaced.push(n.person);
  }
  return { tops, unplaced };
}

/** The managers above someone, nearest first — to open the tree down to them. */
export function ancestorsOf(people: OrgPerson[], staffId: string, line: Line): string[] {
  const byId = new Map(people.map((p) => [p.staffId, p]));
  const out: string[] = [];
  let up = byId.get(staffId) ? managerOf(byId.get(staffId)!, line) : null;
  while (up && byId.has(up) && !out.includes(up) && up !== staffId) {
    out.push(up);
    up = managerOf(byId.get(up)!, line);
  }
  return out;
}

/** Everyone whose node has people under it, down to `depth` levels from the tops (0 = tops only). */
export function openToDepth(forest: OrgNode[], depth: number): Set<string> {
  const open = new Set<string>();
  const walk = (n: OrgNode, d: number) => {
    if (n.children.length && d < depth) {
      open.add(n.person.staffId);
      n.children.forEach((c) => walk(c, d + 1));
    }
  };
  forest.forEach((n) => walk(n, 0));
  return open;
}

export interface DeptMember { person: OrgPerson; roleInDept: string; isHome: boolean }
export interface DeptCard {
  department: OrgDepartment;
  heads: OrgPerson[];
  deputies: DeptMember[];
  members: DeptMember[];
  /** Working here from another home department (the cross-department assignments). */
  visitors: DeptMember[];
}
export interface DeptLane { key: string; overseer: OrgPerson | null; label: string; departments: DeptCard[] }

/**
 * Departments grouped by who oversees them: whoever the department's head
 * reports to. A head with no manager is at the top; a department with no head
 * is listed last so it can be given one.
 */
export function departmentLanes(data: OrgChartData, line: Line): DeptLane[] {
  const byId = new Map(data.people.map((p) => [p.staffId, p]));
  const lanes = new Map<string, DeptLane>();
  const lane = (key: string, overseer: OrgPerson | null, label: string) => {
    if (!lanes.has(key)) lanes.set(key, { key, overseer, label, departments: [] });
    return lanes.get(key)!;
  };
  for (const department of data.departments) {
    const members: DeptMember[] = [];
    for (const p of data.people) {
      const d = p.departments.find((x) => x.departmentId === department.departmentId);
      if (d) members.push({ person: p, roleInDept: d.roleInDept, isHome: d.isHome });
    }
    const heads = department.headStaffIds.map((id) => byId.get(id)).filter((x): x is OrgPerson => !!x);
    if (!heads.length && !members.length) continue;
    const card: DeptCard = {
      department, heads,
      deputies: members.filter((m) => m.roleInDept === "DEPUTY_HOD"),
      members: members.filter((m) => m.isHome && m.roleInDept !== "HOD" && m.roleInDept !== "DEPUTY_HOD").sort((a, b) => byRank(a.person, b.person)),
      visitors: members.filter((m) => !m.isHome && m.roleInDept !== "HOD" && m.roleInDept !== "DEPUTY_HOD").sort((a, b) => byRank(a.person, b.person)),
    };
    const head = heads[0];
    if (!head) { lane("nohead", null, "No head on file").departments.push(card); continue; }
    const overseerId = managerOf(head, line);
    const overseer = overseerId ? byId.get(overseerId) ?? null : null;
    if (overseer) lane(overseer.staffId, overseer, `Overseen by ${overseer.name}`).departments.push(card);
    else lane("top", null, "Headed from the top").departments.push(card);
  }
  const order = (l: DeptLane) => (l.key === "top" ? -1 : l.key === "nohead" ? 1e6 : (l.overseer?.grade ?? 99) * 1000);
  return [...lanes.values()].sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label));
}

/** A colour per staff category, for the person's initials. */
export const CATEGORY_COLOR: Record<string, string> = {
  DOCTOR: ACCENTS.doctorDark,
  NURSE: ACCENTS.nurseDark,
  ALLIED_HEALTH: ACCENTS.pharmacyDark,
  TECHNICIAN: ACCENTS.labDark,
  PHARMACIST: SEMANTIC.successDark,
  ADMINISTRATIVE: ACCENTS.adminDark,
  SUPPORT: SEMANTIC.warningDark,
};
export const colorOf = (categoryCode: string) => CATEGORY_COLOR[categoryCode] ?? NEUTRAL.muted;

export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export const ROLE_SHORT: Record<string, string> = { HOD: "Head", DEPUTY_HOD: "Deputy head", MEMBER: "Member", VISITING: "Visiting" };
