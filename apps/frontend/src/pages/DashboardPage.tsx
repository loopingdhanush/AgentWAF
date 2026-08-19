import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { api } from "../lib/api.js";
import { getDashboardSocket, ToolCallEvent } from "../lib/socket.js";

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [liveEvents, setLiveEvents] = useState<ToolCallEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ToolCallEvent | null>(
    null,
  );
  const [filterDisposition, setFilterDisposition] = useState<string>("ALL");

  const loadStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);

    // Socket.IO realtime listener
    const socket = getDashboardSocket();
    const handleToolEvent = (event: ToolCallEvent) => {
      setLiveEvents((prev) => [event, ...prev.slice(0, 49)]); // keep latest 50
      // Incremental stats update
      setStats((prev: any) => {
        if (!prev) return prev;
        const disp = event.disposition;
        const newCounts = {
          ...prev.dispositionCounts,
          [disp]: (prev.dispositionCounts?.[disp] || 0) + 1,
        };
        const newTotal = (prev.totalCalls || 0) + 1;
        return {
          ...prev,
          totalCalls: newTotal,
          dispositionCounts: newCounts,
          blockRatePercentage:
            Math.round(((newCounts.BLOCKED || 0) / newTotal) * 1000) / 10,
        };
      });
    };

    socket.on("tool_call", handleToolEvent);

    return () => {
      clearInterval(interval);
      socket.off("tool_call", handleToolEvent);
    };
  }, []);

  const filteredEvents = liveEvents.filter((ev) => {
    if (filterDisposition === "ALL") return true;
    return ev.disposition === filterDisposition;
  });

  const getDispositionBadge = (disp: string) => {
    switch (disp) {
      case "ALLOWED":
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium px-2.5 py-0.5 rounded-md text-xs">
            <CheckCircle2 className="h-3 w-3" /> ALLOWED
          </span>
        );
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/80 font-medium px-2.5 py-0.5 rounded-md text-xs">
            <XCircle className="h-3 w-3" /> BLOCKED
          </span>
        );
      case "SHADOW_BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/80 font-medium px-2.5 py-0.5 rounded-md text-xs">
            <Eye className="h-3 w-3" /> SHADOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 border border-zinc-200 font-medium px-2.5 py-0.5 rounded-md text-xs">
            <AlertTriangle className="h-3 w-3" /> {disp}
          </span>
        );
    }
  };

  // Disposition bar data for chart
  const dispositionChartData = [
    {
      name: "Allowed",
      count: stats?.dispositionCounts?.ALLOWED || 0,
      fill: "#10B981",
    },
    {
      name: "Blocked",
      count: stats?.dispositionCounts?.BLOCKED || 0,
      fill: "#F43F5E",
    },
    {
      name: "Shadow",
      count: stats?.dispositionCounts?.SHADOW_BLOCKED || 0,
      fill: "#F59E0B",
    },
    {
      name: "Error",
      count: stats?.dispositionCounts?.ERROR || 0,
      fill: "#A1A1AA",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-editorial font-medium text-zinc-900 tracking-tight leading-none">
            Traffic & Security Overview
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5">
            Live AI tool call policy evaluation stream
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadStats}
            className="px-3 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="glass-card rounded-xl p-5 relative overflow-hidden group shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Total Calls
            </span>
            <div className="p-2 rounded-lg bg-zinc-100 text-zinc-600">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-zinc-900 mt-3 tracking-tight">
            {stats?.totalCalls ?? 0}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1">
            <Zap className="h-3 w-3 text-emerald-600" />
            Active WAF interception layer
          </p>
        </div>

        {/* Block Rate */}
        <div className="glass-card rounded-xl p-5 relative overflow-hidden group shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Block Rate
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-rose-600 mt-3 tracking-tight">
            {stats?.blockRatePercentage ?? 0}%
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {stats?.dispositionCounts?.BLOCKED ?? 0} threats thwarted
          </p>
        </div>

        {/* Shadow Blocks */}
        <div className="glass-card rounded-xl p-5 relative overflow-hidden group shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Shadow Blocks
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-amber-600 mt-3 tracking-tight">
            {stats?.dispositionCounts?.SHADOW_BLOCKED ?? 0}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Safe calibration mode
          </p>
        </div>

        {/* Allowed Calls */}
        <div className="glass-card rounded-xl p-5 relative overflow-hidden group shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Clean Calls
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-semibold text-emerald-600 mt-3 tracking-tight">
            {stats?.dispositionCounts?.ALLOWED ?? 0}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Compliant tool executions
          </p>
        </div>
      </div>

      {/* Real-time Event Feed & Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Tool Call Feed (2 cols) */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <h3 className="font-semibold text-[15px] text-zinc-900 tracking-tight">
                Live Interception Feed
              </h3>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg text-xs">
              {["ALL", "BLOCKED", "ALLOWED", "SHADOW_BLOCKED"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterDisposition(mode)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    filterDisposition === mode
                      ? "bg-white text-[#1a73e8] shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {mode === "SHADOW_BLOCKED" ? "SHADOW" : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Event Stream List */}
          <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                <Activity className="h-8 w-8 text-zinc-300 animate-pulse" />
                Waiting for incoming tool calls... Run a goal from the Agent
                Sandbox page.
              </div>
            ) : (
              filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="p-3.5 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all cursor-pointer flex items-center justify-between group shadow-subtle"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm text-zinc-900">
                        {ev.tool}
                      </span>
                      {getDispositionBadge(ev.disposition)}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                      <span>
                        Agent: {ev.agentName || ev.agentId.substring(0, 10)}
                      </span>
                      <span>Session: {ev.sessionId.substring(0, 14)}</span>
                      <span className="text-zinc-400">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                      {ev.latencyMs}ms
                    </span>
                    <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Analytics Breakdown & Top Blocked Tools (1 col) */}
        <div className="space-y-6">
          {/* Disposition Chart */}
          <div className="glass-panel rounded-xl p-6 shadow-subtle">
            <h3 className="font-semibold text-sm text-zinc-900 mb-4 tracking-tight">
              Disposition Breakdown
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dispositionChartData}>
                  <XAxis
                    dataKey="name"
                    stroke="#a1a1aa"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#a1a1aa"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#fafafa" }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e4e4e7",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#18181b",
                      boxShadow: "0 4px 12px -2px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {dispositionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Blocked Tools */}
          <div className="glass-panel rounded-xl p-6 shadow-subtle">
            <h3 className="font-semibold text-sm text-zinc-900 mb-3 tracking-tight">
              Top Blocked Tools
            </h3>
            <div className="space-y-2">
              {stats?.topBlockedTools?.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  No blocked tool calls recorded yet.
                </p>
              ) : (
                stats?.topBlockedTools?.map((tb: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-50 border border-zinc-200 font-mono"
                  >
                    <span className="text-zinc-700 font-semibold">
                      {tb.tool}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200/80">
                      {tb.count} blocks
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event Inspection Modal / Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4 max-h-[85vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-zinc-900 font-sans">
                  {selectedEvent.tool}
                </span>
                {getDispositionBadge(selectedEvent.disposition)}
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-zinc-600 text-[11px]">
              <div>
                <span className="text-zinc-400">Request ID:</span>{" "}
                {selectedEvent.requestId}
              </div>
              <div>
                <span className="text-zinc-400">Timestamp:</span>{" "}
                {new Date(selectedEvent.timestamp).toLocaleString()}
              </div>
              <div>
                <span className="text-zinc-400">Agent ID:</span>{" "}
                {selectedEvent.agentId}
              </div>
              <div>
                <span className="text-zinc-400">Session ID:</span>{" "}
                {selectedEvent.sessionId}
              </div>
            </div>

            <div>
              <span className="text-zinc-500 font-semibold block mb-1 font-sans">
                Sanitized Parameters:
              </span>
              <pre className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 overflow-x-auto">
                {JSON.stringify(selectedEvent.paramsSanitized, null, 2)}
              </pre>
            </div>

            <div>
              <span className="text-zinc-500 font-semibold block mb-1 font-sans">
                Per-Rule Evaluations:
              </span>
              <div className="space-y-2">
                {selectedEvent.ruleResults?.map((r, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border ${
                      r.passed
                        ? "bg-emerald-50 border-emerald-200/80 text-emerald-700"
                        : "bg-rose-50 border-rose-200/80 text-rose-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        {r.ruleName} ({r.type})
                      </span>
                      <span>
                        {r.passed ? "PASSED" : `FAILED [${r.enforcementMode}]`}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="text-[11px] mt-1 text-zinc-600">
                        {r.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold font-sans"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
