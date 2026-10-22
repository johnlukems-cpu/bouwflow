import { describe, expect, it } from "vitest";
import { can, ROLES } from "@/lib/auth/permissions";
import { customerSchema } from "./customer";
import { projectSchema } from "./project";
import { toFieldErrors } from "./common";

const uuid = "3f1c1d2e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";

describe("klantvalidatie", () => {
  it("accepteert een geldige zakelijke klant en normaliseert invoer", () => {
    const r = customerSchema.safeParse({ customer_type: "business", name: "  Bouw N.V. ", email: "INFO@Bouw.SR", phone: "+597 123-4567", country_code: "sr", vat_number: "SR123" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Bouw N.V.");
      expect(r.data.email).toBe("info@bouw.sr");
      expect(r.data.country_code).toBe("SR");
      expect(r.data.contact_person).toBeNull();
      expect(r.data.vat_number).toBe("SR123");
    }
  });

  it("verwijdert BTW-nummer bij particulieren", () => {
    const r = customerSchema.parse({ customer_type: "private", name: "J. Jansen", vat_number: "X" });
    expect(r.vat_number).toBeNull();
  });

  it("geeft Nederlandse foutmeldingen", () => {
    const r = customerSchema.safeParse({ customer_type: "business", name: " ", email: "geen-email", phone: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = toFieldErrors(r.error);
      expect(e.name).toBe("Naam / bedrijfsnaam is verplicht");
      expect(e.email).toBe("Vul een geldig e-mailadres in");
      expect(e.phone).toBe("Vul een geldig telefoonnummer in");
    }
  });
});

describe("projectvalidatie", () => {
  const base = { name: "Renovatie", customer_id: uuid, status: "planned" };

  it("normaliseert bedragen naar 2 decimalen", () => {
    const r = projectSchema.parse({ ...base, budget_amount: "1.250.000,5", contract_value: "" });
    expect(r.budget_amount).toBe("1250000.50");
    expect(r.contract_value).toBe("0.00");
    expect(r.project_manager_member_id).toBeNull();
  });

  it("weigert negatieve en onnauwkeurige bedragen", () => {
    const neg = projectSchema.safeParse({ ...base, budget_amount: "-5" });
    expect(neg.success).toBe(false);
    const dec = projectSchema.safeParse({ ...base, contract_value: "10,123" });
    expect(dec.success).toBe(false);
  });

  it("weigert einddatum vóór startdatum", () => {
    const r = projectSchema.safeParse({ ...base, start_date: "2026-12-01", expected_end_date: "2026-11-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).expected_end_date).toMatch(/vóór/);
  });

  it("weigert ongeldige status en klant", () => {
    expect(projectSchema.safeParse({ ...base, status: "hacked" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, customer_id: "1 or 1=1" }).success).toBe(false);
  });
});

describe("rechten", () => {
  it("komt overeen met de RLS-policies", () => {
    const writers = ROLES.filter((r) => can(r, "customers.write"));
    expect(writers).toEqual(["owner", "admin", "manager", "finance"]);
    expect(ROLES.filter((r) => can(r, "projects.write"))).toEqual(["owner", "admin", "manager"]);
    expect(ROLES.filter((r) => can(r, "settings.write"))).toEqual(["owner", "admin"]);
    expect(can("viewer", "customers.write")).toBe(false);
    expect(can(null, "customers.write")).toBe(false);
  });
});
