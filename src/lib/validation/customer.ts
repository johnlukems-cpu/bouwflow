import { z } from "zod";
import { countryCode, optionalEmail, optionalPhone, optionalText, requiredText } from "./common";

export const customerSchema = z
  .object({
    customer_type: z.enum(["private", "business"], { error: "Kies particulier of zakelijk" }),
    name: requiredText(200, "Naam / bedrijfsnaam"),
    contact_person: optionalText(200, "Contactpersoon"),
    email: optionalEmail,
    phone: optionalPhone,
    address_line: optionalText(200, "Adres"),
    postal_code: optionalText(20, "Postcode"),
    city: optionalText(100, "Plaats"),
    country_code: countryCode,
    vat_number: optionalText(50, "BTW-nummer"),
    notes: optionalText(5000, "Opmerkingen"),
  })
  // Een BTW-nummer is alleen van toepassing op zakelijke klanten.
  .transform((c) => (c.customer_type === "private" ? { ...c, vat_number: null } : c));

export type CustomerInput = z.infer<typeof customerSchema>;
