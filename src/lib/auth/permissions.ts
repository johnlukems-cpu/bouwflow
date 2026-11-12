/**
 * Rollen en rechten. Deze tabel moet overeenkomen met de RLS-policies in
 * supabase/migrations. De database is leidend; deze controle zorgt voor
 * duidelijke foutmeldingen en verbergt knoppen die niet zijn toegestaan.
 */
export const ROLES = ["owner", "admin", "manager", "finance", "employee", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Eigenaar",
  admin: "Beheerder",
  manager: "Projectleider",
  finance: "Financiële administratie",
  employee: "Medewerker",
  viewer: "Alleen lezen",
};

export const PERMISSIONS = {
  "customers.write": ["owner", "admin", "manager", "finance"],
  "projects.write": ["owner", "admin", "manager"],
  "settings.write": ["owner", "admin"],
  "tax_rates.write": ["owner", "admin", "finance"],
  "members.manage": ["owner", "admin"],
  "suppliers.write": ["owner", "admin", "manager", "finance"],
  "employees.write": ["owner", "admin", "manager"],
  "materials.write": ["owner", "admin", "manager", "finance"],
  "stock.write": ["owner", "admin", "manager", "finance"],
  "estimate.write": ["owner", "admin", "manager"],
  "tasks.write": ["owner", "admin", "manager"],
  "time.register": ["owner", "admin", "manager", "employee"],
  "time.approve": ["owner", "admin", "manager"],
  "purchasing.write": ["owner", "admin", "manager", "finance"],
  "quotes.write": ["owner", "admin", "manager", "finance"],
  "invoices.write": ["owner", "admin", "finance"],
  "payments.write": ["owner", "admin", "finance"],
  "costs.write": ["owner", "admin", "manager", "finance"],
  "documents.write": ["owner", "admin", "manager", "finance"],
  "portal.manage": ["owner", "admin", "manager", "finance"],
  "audit.read": ["owner", "admin", "finance"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
