import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BillDocument, { type BillHospital } from "./BillDocument";

/**
 * The standard letterhead must print the hospital's whole identity.
 *
 * Every field here was reachable from the API and still missing from paper:
 * the template's own `BillHospital` type stopped at six keys, so the logo the
 * lab endpoint had always sent was dropped, `city` never reached the address
 * line (receipts named a street and a PIN code but not the town), and the
 * GSTIN line could not render on an OPD receipt because the invoice endpoint
 * never selected the column. A tax invoice without a GSTIN is not cosmetic.
 *
 * These assert the header is a function of the hospital, not of which call
 * site built the object.
 */

const HOSPITAL: BillHospital = {
  hospitalName: "City Care Hospital",
  legalBusinessName: "City Care Healthcare Pvt Ltd",
  registrationNumber: "MH/2019/442",
  addressLine1: "12 MG Road",
  addressLine2: "Andheri East",
  landmark: "Opp. Metro Station",
  city: "Mumbai",
  postalCode: "400053",
  officialPhone: "022-4455 6677",
  officialEmail: "billing@citycare.in",
  gstNumber: "27AABCC1234M1Z5",
  logoUrl: "/uploads/logo.png",
};

const renderDoc = (hospital: BillHospital | null, variant?: "receipt" | "letterhead") =>
  render(
    <BillDocument hospital={hospital} variant={variant} title="Tax Invoice" totals={{ total: 1200 }}>
      <table><tbody><tr><td>Consultation</td></tr></tbody></table>
    </BillDocument>,
  );

describe("BillDocument letterhead", () => {
  it("prints every part of the hospital's identity", () => {
    const { container } = renderDoc(HOSPITAL);

    expect(screen.getByText("City Care Hospital")).toBeInTheDocument();
    expect(screen.getByText("City Care Healthcare Pvt Ltd")).toBeInTheDocument();
    expect(screen.getByText(/GSTIN: 27AABCC1234M1Z5/)).toBeInTheDocument();
    expect(screen.getByText(/Reg: MH\/2019\/442/)).toBeInTheDocument();
    expect(screen.getByText(/Ph: 022-4455 6677/)).toBeInTheDocument();
    expect(screen.getByText(/billing@citycare.in/)).toBeInTheDocument();

    // The address must name the town, not just the street and the PIN.
    const address = screen.getByText(/12 MG Road/);
    expect(address.textContent).toContain("Mumbai");
    expect(address.textContent).toContain("Opp. Metro Station");
    expect(address.textContent).toContain("400053");

    // The logo is rendered, not silently discarded.
    expect(container.querySelector("img")).toBeTruthy();
  });

  it("does not print the same part of the address twice", () => {
    // Exactly the live tenant's data: the whole address typed into line 1,
    // with city and postal code filled in as well. Joining blindly printed
    // "…Gujarat 382419, Ahmedabad, 382419" on every invoice.
    renderDoc({
      hospitalName: "Radhe Multi-Specialty",
      addressLine1: "VRUNDAVAN TRADE CENTER, Kudasan, Gandhinagar, Gujarat 382419",
      city: "Ahmedabad",
      postalCode: "382419",
    });

    const address = screen.getByText(/VRUNDAVAN TRADE CENTER/);
    expect(address.textContent!.match(/382419/g)).toHaveLength(1);
  });

  it("keeps a city the address line does not already name", () => {
    renderDoc({ hospitalName: "X", addressLine1: "12 MG Road", city: "Mumbai", postalCode: "400053" });
    const address = screen.getByText(/12 MG Road/);
    expect(address.textContent).toContain("Mumbai");
    expect(address.textContent).toContain("400053");
  });

  it("stamps when it was printed", () => {
    renderDoc(HOSPITAL);
    // Reprints are routine; a desk holding two copies needs to tell them apart.
    expect(screen.getByText(/^Printed /)).toBeInTheDocument();
  });

  it("omits the identity on pre-printed stationery, but keeps the GSTIN", () => {
    renderDoc(HOSPITAL, "letterhead");
    // The paper already carries the name and address — printing them again
    // would overlap. The GSTIN is repeated because the paper rarely has it.
    expect(screen.queryByText("City Care Hospital")).not.toBeInTheDocument();
    expect(screen.getByText(/GSTIN: 27AABCC1234M1Z5/)).toBeInTheDocument();
  });

  it("renders without a hospital rather than throwing", () => {
    // Some print paths resolve the hospital asynchronously; a half-loaded
    // document must still be a document.
    renderDoc(null);
    expect(screen.getByText("Hospital")).toBeInTheDocument();
    expect(screen.getByText("TAX INVOICE")).toBeInTheDocument();
  });
});
