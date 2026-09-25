import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import SoapNotes from "./SoapNotes";

/**
 * History used to show a past visit's Assessment alone, so Subjective,
 * Objective and Plan were saved and never seen again.
 */
describe("SoapNotes", () => {
  it("shows every section that was written, under its label", () => {
    renderWithProviders(<SoapNotes note={{
      soapSubjective: "<p>Fever for two days</p>", soapObjective: "<p>Temp 101F</p>",
      soapAssessment: "<p>Viral fever</p>", soapPlan: "<p>Review in 5 days</p>",
    }} />);
    for (const t of ["Subjective", "Objective", "Assessment", "Plan", "Fever for two days", "Temp 101F", "Viral fever", "Review in 5 days"]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it("skips empty sections instead of drawing blank labels", () => {
    renderWithProviders(<SoapNotes note={{ soapSubjective: "<p>Cough</p>", soapObjective: "<p></p>", soapAssessment: null, soapPlan: "" }} />);
    expect(screen.getByText("Subjective")).toBeInTheDocument();
    expect(screen.queryByText("Objective")).not.toBeInTheDocument();
    expect(screen.queryByText("Assessment")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan")).not.toBeInTheDocument();
  });

  it("says so when nothing was written", () => {
    renderWithProviders(<SoapNotes note={{}} emptyText="No notes available for this consultation." />);
    expect(screen.getByText("No notes available for this consultation.")).toBeInTheDocument();
  });

  it("offers the full note in the narrow panel only when something is cut", () => {
    const { unmount } = renderWithProviders(<SoapNotes compact note={{ soapSubjective: "<p>Cough</p>", soapAssessment: "<p>Cold</p>" }} />);
    expect(screen.queryByRole("button", { name: "Show full notes" })).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<SoapNotes compact note={{ soapPlan: `<p>${"Long plan text. ".repeat(12)}</p>` }} />);
    expect(screen.getByRole("button", { name: "Show full notes" })).toBeInTheDocument();
  });
});
