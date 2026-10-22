import {
  BarChart3,
  Boxes,

  Calculator,
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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** true = module is in deze fase gebouwd en werkend */
  available: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overzicht",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true }],
  },
  {
    label: "Relaties",
    items: [
      { href: "/klanten", label: "Klanten", icon: Users, available: true },
      { href: "/leveranciers", label: "Leveranciers", icon: Truck, available: false },
    ],
  },
  {
    label: "Projecten",
    items: [
      { href: "/projecten", label: "Projecten", icon: FolderKanban, available: true },
      { href: "/materiaalberekening", label: "Materiaalberekening", icon: Calculator, available: false },
      { href: "/materialen", label: "Materialen en voorraad", icon: Boxes, available: false },
      { href: "/planning", label: "Planning", icon: CalendarDays, available: false },
      { href: "/medewerkers", label: "Medewerkers", icon: HardHat, available: false },
      { href: "/werkbonnen", label: "Werkbonnen", icon: ClipboardList, available: false },
      { href: "/inkoop", label: "Inkoop", icon: ShoppingCart, available: false },
    ],
  },
  {
    label: "Financieel",
    items: [
      { href: "/offertes", label: "Offertes", icon: FileCheck2, available: false },
      { href: "/facturatie", label: "Facturatie", icon: Receipt, available: false },
      { href: "/betalingen", label: "Betalingen", icon: Wallet, available: false },
      { href: "/na-calculatie", label: "Na-calculatie", icon: Scale, available: false },
      { href: "/rapportages", label: "Rapportages", icon: BarChart3, available: false },
    ],
  },
  {
    label: "Organisatie",
    items: [
      { href: "/documenten", label: "Documenten", icon: FolderOpen, available: false },
      { href: "/instellingen", label: "Instellingen", icon: Settings, available: true },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

