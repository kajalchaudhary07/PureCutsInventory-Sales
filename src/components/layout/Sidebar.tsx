import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Layers,
  Boxes,
  Warehouse,
  ShoppingCart,
  Truck,
  ClipboardList,
  Store,
  Users,
  BarChart3,
  TrendingUp,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";
import { LOGO_BASE64 } from "@/lib/logoBase64";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/products", label: "Products", icon: Package },
  { to: "/item-groups", label: "Item Groups", icon: Layers },
  { to: "/stock", label: "Stock Management", icon: Warehouse },
  { to: "/sales-orders", label: "Sales Orders", icon: ShoppingCart },
  { to: "/new-order", label: "Manual Order", icon: ClipboardList },
  { to: "/salons", label: "Salon Customers", icon: Store },
  { to: "/purchase-orders", label: "Purchase Orders", icon: Truck },
  { to: "/vendors", label: "Vendors", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/business-intelligence", label: "Business Intelligence", icon: TrendingUp },
  { to: "/activity", label: "Activity Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 md:flex",
        sidebarOpen ? "w-60" : "w-16"
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <img src={LOGO_BASE64} alt="PureCuts Logo" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
        {sidebarOpen && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900 dark:text-white">PureCuts</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Inventory</div>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )
            }
          >
            <n.icon className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="truncate">{n.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
