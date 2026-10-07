import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, within, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { buildForest, splitUnplaced, ancestorsOf, departmentLanes, openToDepth, type OrgPerson, type OrgChartData } from "./orgChart";

/**
 * The organisation chart. No fixed shape: whoever has no manager is a top, a
 * loop cannot hang it, day-to-day lines may differ from HR lines, departments
 * sit under whoever their head reports to, and someone in two departments is
 * shown in both.
 */

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => api.get(...a) }, API_URL: "http://localhost:5000/api" }));

import Organogram from "./Organogram";

const dept = (departmentId: string, roleInDept = "MEMBER", isHome = true) => ({ departmentId, departmentName: departmentId.toUpperCase(), roleInDept, isHome });
const person = (staffId: string, name: string, grade: number | null, admin: string | null, extra: Partial<OrgPerson> = {}): OrgPerson => ({
  staffId, name, designation: `D-${staffId}`, grade, categoryCode: "DOCTOR", category: "Doctor", status: "ACTIVE", hasLogin: true,
  branches: [], posting: null, departments: [], adminManagerId: admin, functionalManagerId: null, managerLeft: false, ...extra,
});

// CEO → two heads → their teams; a surgeon heads Ortho and also heads Joint; a nurse lent to Ortho; one person unplaced.
const people: OrgPerson[] = [
  person("ceo", "Anil Ceo", 1, null, { departments: [dept("admin")] }),
  person("ms", "Meera Superintendent", 3, "ceo", { departments: [dept("medicine", "HOD")] }),
  person("ortho", "Farhan Ortho", 4, "ceo", { departments: [dept("ortho", "HOD"), dept("joint", "HOD", false)] }),
  person("rita", "Rita Consultant", 5, "ortho", { departments: [dept("ortho"), dept("joint", "VISITING", false)], functionalManagerId: "ms" }),
  person("sam", "Sam Consultant", 5, "ortho", { departments: [dept("ortho")] }),
  person("nina", "Nina Nurse", 8, "ms", { departments: [dept("medicine"), dept("ortho", "MEMBER", false)], categoryCode: "NURSE", category: "Nurse" }),
  person("loose", "Loose End", 7, null, { departments: [dept("medicine")] }),
];
const data: OrgChartData = {
  people, branchCount: 1,
  departments: [
    { departmentId: "admin", departmentName: "Administration", group: "Admin", headStaffIds: [] },
    { departmentId: "medicine", departmentName: "Medicine", group: "Medical", headStaffIds: ["ms"] },
    { departmentId: "ortho", departmentName: "Orthopaedics", group: "Surgical", headStaffIds: ["ortho"] },
    { departmentId: "joint", departmentName: "Joint Replacement", group: "Surgical", headStaffIds: ["ortho"] },
  ],
};

describe("organisation chart logic", () => {
  it("builds the tree from HR lines, with the tops and the unplaced apart", () => {
    const forest = buildForest(people, "hr");
    const { tops, unplaced } = splitUnplaced(forest);
    expect(tops.map((n) => n.person.staffId)).toEqual(["ceo"]);
    expect(unplaced.map((p) => p.staffId)).toEqual(["loose"]);
    expect(tops[0].children.map((c) => c.person.staffId)).toEqual(["ms", "ortho"]); // most senior first
    expect(tops[0].size).toBe(5);
  });

  it("follows day-to-day lines where they differ", () => {
    const ms = buildForest(people, "daily")[0].children.find((c) => c.person.staffId === "ms")!;
    expect(ms.children.map((c) => c.person.staffId).sort()).toEqual(["nina", "rita"]);
  });

  it("cannot be hung by a loop in the data", () => {
    const loop = [person("a", "A", 3, "b"), person("b", "B", 3, "a")];
    const forest = buildForest(loop, "hr");
    expect(forest.length).toBeGreaterThan(0);
    expect(forest.reduce((n, t) => n + 1 + t.size, 0)).toBe(2);
  });

  it("opens the way down to someone, and to a depth", () => {
    expect(ancestorsOf(people, "rita", "hr")).toEqual(["ortho", "ceo"]);
    expect([...openToDepth(buildForest(people, "hr"), 1)]).toEqual(["ceo"]);
  });

  it("groups departments under whoever their head reports to, with people from other departments shown", () => {
    const lanes = departmentLanes(data, "hr");
    const ceoLane = lanes.find((l) => l.key === "ceo")!;
    expect(ceoLane.departments.map((d) => d.department.departmentId).sort()).toEqual(["joint", "medicine", "ortho"]);
    const ortho = ceoLane.departments.find((d) => d.department.departmentId === "ortho")!;
    expect(ortho.heads.map((h) => h.staffId)).toEqual(["ortho"]);
    expect(ortho.members.map((m) => m.person.staffId)).toEqual(["rita", "sam"]);
    expect(ortho.visitors.map((m) => m.person.staffId)).toEqual(["nina"]);
    const joint = ceoLane.departments.find((d) => d.department.departmentId === "joint")!;
    expect(joint.visitors.map((m) => [m.person.staffId, m.roleInDept])).toEqual([["rita", "VISITING"]]);
    expect(lanes.find((l) => l.key === "nohead")!.departments.map((d) => d.department.departmentId)).toEqual(["admin"]);
  });
});

describe("the organisation chart page", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({ data: { data } });
  });

  it("draws the chart, lists who is not placed, and finds a person", async () => {
    renderWithProviders(<Organogram />);
    expect(await screen.findByRole("button", { name: "Anil Ceo, D-ceo" })).toBeInTheDocument();
    expect(screen.getByText("Not placed in the hierarchy yet (1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rita Consultant, D-rita" })).toBeInTheDocument(); // a small chart opens fully

    // Close everything, then find Rita: the way down to her opens again.
    fireEvent.click(screen.getByRole("button", { name: "Close to the tops" }));
    expect(screen.queryByRole("button", { name: "Rita Consultant, D-rita" })).not.toBeInTheDocument();
    const search = screen.getByPlaceholderText("Find a person");
    search.focus();
    fireEvent.change(search, { target: { value: "Rita" } });
    fireEvent.click(await screen.findByRole("option", { name: /Rita Consultant/ }));
    expect(await screen.findByRole("button", { name: "Rita Consultant, D-rita" })).toBeInTheDocument();
  }, 20_000);

  it("shows a person's managers, reports and departments", async () => {
    renderWithProviders(<Organogram />);
    fireEvent.click(await screen.findByRole("button", { name: "Farhan Ortho, D-ortho" }));
    const panel = await screen.findByRole("dialog", { name: "Farhan Ortho — details" });
    expect(within(panel).getByText("ORTHO")).toBeInTheDocument();
    expect(within(panel).getByText("JOINT")).toBeInTheDocument();
    expect(within(panel).getAllByText("Head")).toHaveLength(2);
    expect(within(panel).getByText("Reporting to them (2)")).toBeInTheDocument();
  });

  it("the departments view groups them under who oversees them", async () => {
    renderWithProviders(<Organogram />);
    fireEvent.click(await screen.findByRole("button", { name: "Departments" }));
    await waitFor(() => expect(screen.getByText(/oversees 3 departments/)).toBeInTheDocument());
    expect(screen.getAllByText(/No head on file/).length).toBeGreaterThan(0);
  });
});
