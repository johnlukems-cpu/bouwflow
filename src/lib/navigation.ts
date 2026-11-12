import type { ModuleKey } from "@/lib/modules";
import {
  BarChart3,
  Boxes,
  Calculator,
  Clock,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FolderKanban,
  FolderOpen,
  HardHat,
  LayoutDashboard,
  Receipt,
  Scale,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: ModuleKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overzicht",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" }],
  },
  {
    label: "Relaties",
    items: [
      { href: "/klanten", label: "Klanten", icon: Users, module: "klanten" },
      { href: "/leveranciers", label: "Leveranciers", icon: Truck, module: "leveranciers" },
    ],
  },
  {
    label: "Projecten",
    items: [
      { href: "/projecten", label: "Projecten", icon: FolderKanban, module: "projecten" },
      { href: "/planning", label: "Planning", icon: CalendarDays, module: "planning" },
      { href: "/materiaalberekening", label: "Voorcalculatie", icon: Calculator, module: "calculatie" },
      { href: "/werkbonnen", label: "Werkbonnen", icon: ClipboardList, module: "werkbonnen" },
      { href: "/uren", label: "Urenregistratie", icon: Clock, module: "uren" },
    ],
  },
  {
    label: "Materiaal",
    items: [
      { href: "/materialen", label: "Materiaalbibliotheek", icon: Boxes, module: "materialen" },
      { href: "/voorraad", label: "Voorraad", icon: Warehouse, module: "voorraad" },
      { href: "/inkoop", label: "Inkoop", icon: ShoppingCart, module: "inkoop" },
    ],
  },
  {
    label: "Financieel",
    items: [
      { href: "/offertes", label: "Offertes", icon: FileCheck2, module: "offertes" },
      { href: "/facturatie", label: "Facturatie", icon: Receipt, module: "facturatie" },
      { href: "/betalingen", label: "Betalingen", icon: Wallet, module: "betalingen" },
      { href: "/na-calculatie", label: "Na-calculatie", icon: Scale, module: "nacalculatie" },
      { href: "/rapportages", label: "Rapportages", icon: BarChart3, module: "rapportages" },
    ],
  },
  {
    label: "Organisatie",
    items: [
      { href: "/medewerkers", label: "Medewerkers", icon: HardHat, module: "medewerkers" },
      { href: "/documenten", label: "Documenten", icon: FolderOpen, module: "documenten" },
      { href: "/instellingen", label: "Instellingen", icon: Settings, module: "instellingen" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
