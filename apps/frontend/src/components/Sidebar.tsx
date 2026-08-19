import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  LayoutDashboard,
  ShieldCheck,
  Bot,
  ScrollText,
  Activity,
  LogOut,
  HeartPulse,
  FlaskConical,
} from "lucide-react";

export type NavTab =
  "dashboard" | "rules" | "agents" | "logs" | "health" | "sandbox";

const TAB_ROUTES: Record<NavTab, string> = {
  dashboard: "/dashboard",
  rules: "/rules",
  agents: "/agents",
  logs: "/logs",
  health: "/health",
  sandbox: "/sandbox",
};

interface SidebarProps {
  currentTab: NavTab;
  onLogout: () => void;
  userEmail?: string;
  isRealtimeConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onLogout,
  userEmail,
  isRealtimeConnected,
}) => {
  const navigate = useNavigate();

  const navItems = [
    {
      id: "dashboard" as NavTab,
      label: "Live Dashboard",
      icon: LayoutDashboard,
    },
    { id: "sandbox" as NavTab, label: "Agent Sandbox", icon: FlaskConical },
    { id: "rules" as NavTab, label: "Firewall Rules", icon: ShieldCheck },
    { id: "agents" as NavTab, label: "Authorized Agents", icon: Bot },
    { id: "logs" as NavTab, label: "Audit & Tool Logs", icon: ScrollText },
    { id: "health" as NavTab, label: "System Health", icon: HeartPulse },
  ];

  return (
    <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col justify-between p-4 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-3 mb-5">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-[15px] text-zinc-900 tracking-tight leading-none flex items-center gap-1.5">
              Agent WAF
            </h1>
            <p className="text-[11px] text-zinc-500 mt-1">
              AI Tool Policy Proxy
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(TAB_ROUTES[item.id])}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition-all duration-150 ${
                  isActive
                    ? "bg-zinc-100 text-zinc-900 font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 font-medium"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-zinc-900" : "text-zinc-400"}`}
                  strokeWidth={2}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Status & User info */}
      <div className="pt-4 border-t border-zinc-200 space-y-3">
        {/* Realtime socket indicator */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
          <span className="text-zinc-500 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-zinc-400" /> Realtime Bus
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <span className="relative flex h-2 w-2">
              {isRealtimeConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </span>
            <span
              className={
                isRealtimeConnected ? "text-emerald-700" : "text-amber-700"
              }
            >
              {isRealtimeConnected ? "Live" : "Connecting"}
            </span>
          </span>
        </div>

        {/* Admin profile & logout */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="truncate">
            <p className="text-xs font-semibold text-zinc-800 truncate">
              {userEmail || "admin@agentwaf.local"}
            </p>
            <p className="text-[11px] text-zinc-500">Security Admin</p>
          </div>
          <button
            onClick={onLogout}
            title="Log Out"
            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
