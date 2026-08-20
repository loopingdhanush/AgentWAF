import React, { useState, useEffect } from "react";
import {
  Database,
  Server,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Terminal,
} from "lucide-react";
import { api } from "../lib/api.js";

export const HealthPage: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [testEndpoint, setTestEndpoint] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchDiagnostics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await api.getDiagnostics();
      setDiagnostics(data);
    } catch (err) {
      console.error("Failed to fetch diagnostics", err);
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDiagnostics();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleTestEndpoint = async (endpoint: string) => {
    setTestEndpoint(endpoint);
    try {
      const res = await fetch(endpoint, {
        headers: { "x-demo-admin": "true" },
      });
      const data = await res.json();
      setTestResult({ status: res.status, data });
    } catch (err: any) {
      setTestResult({ status: 500, error: err.message });
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };

  const isHealthy = diagnostics?.status === "healthy";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-editorial font-medium text-zinc-900 tracking-tight leading-none">
            System Health & Diagnostics
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5">
            Real-time infrastructure health, database latency, Redis pub/sub
            bus, and Gemini model telemetry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-600 font-sans cursor-pointer bg-white px-3 py-2 rounded-lg border border-zinc-200 shadow-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-zinc-300 text-[#1a73e8] focus:ring-[#1a73e8]"
            />
            <span>Auto-refresh (5s)</span>
          </label>

          <button
            onClick={() => fetchDiagnostics(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 shrink-0 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>Ping Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Primary Status Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all shadow-xs ${isHealthy
          ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
          : "bg-amber-50/70 border-amber-200 text-amber-800"
          }`}
      >
        <div className="flex items-center gap-3">
          {isHealthy ? (
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-sm font-sans tracking-tight">
              {isHealthy
                ? "All Infrastructure Services Operational"
                : "Degraded Infrastructure Status"}
            </h3>
          </div>
        </div>

        <div className="text-right font-mono text-[11px] opacity-75 hidden sm:block">
          <div>Last checked:</div>
          <div>
            {diagnostics?.timestamp
              ? new Date(diagnostics.timestamp).toLocaleTimeString()
              : "Just now"}
          </div>
        </div>
      </div>

      {/* 4-Grid Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PostgreSQL Database Card */}
        <div className="glass-panel rounded-xl p-5 shadow-subtle bg-white border border-zinc-200 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm font-sans">
                <Database className="h-4 w-4 text-indigo-600" />
                <span>PostgreSQL</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${diagnostics?.postgres?.status === "healthy"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
              >
                {diagnostics?.postgres?.status === "healthy"
                  ? "CONNECTED"
                  : "OFFLINE"}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-600">
                <span>Ping Latency:</span>
                <span className="font-bold text-zinc-900">
                  {diagnostics?.postgres?.latencyMs ?? "--"} ms
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Agents Count:</span>
                <span className="font-semibold text-zinc-900">
                  {diagnostics?.postgres?.tables?.agents ?? "--"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Rules Count:</span>
                <span className="font-semibold text-zinc-900">
                  {diagnostics?.postgres?.tables?.rules ?? "--"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Audit Logs:</span>
                <span className="font-semibold text-zinc-900">
                  {diagnostics?.postgres?.tables?.logs ?? "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 font-mono truncate">
            {diagnostics?.postgres?.databaseUrl ||
              "postgresql://localhost:5433/agent_waf"}
          </div>
        </div>

        {/* Redis Cache & PubSub Card */}
        <div className="glass-panel rounded-xl p-5 shadow-subtle bg-white border border-zinc-200 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm font-sans">
                <Zap className="h-4 w-4 text-rose-600" />
                <span>Redis Bus & Cache</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${diagnostics?.redis?.status === "healthy"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
              >
                {diagnostics?.redis?.status === "healthy"
                  ? "CONNECTED"
                  : "OFFLINE"}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-600">
                <span>Ping Latency:</span>
                <span className="font-bold text-zinc-900">
                  {diagnostics?.redis?.latencyMs ?? "--"} ms
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Memory Used:</span>
                <span className="font-semibold text-zinc-900">
                  {diagnostics?.redis?.usedMemory ?? "1.2M"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Rate Limiter:</span>
                <span className="font-semibold text-emerald-700">Active</span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Pub/Sub Channel:</span>
                <span className="font-semibold text-zinc-700 text-[10px]">
                  tool_events
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 font-mono truncate">
            {diagnostics?.redis?.url || "redis://localhost:6380"}
          </div>
        </div>

        {/* Gemini AI Agent Engine Card */}
        <div className="glass-panel rounded-xl p-5 shadow-subtle bg-white border border-zinc-200 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm font-sans">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Gemini Agent Engine</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${diagnostics?.gemini?.keyConfigured
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
              >
                {diagnostics?.gemini?.keyConfigured ? "READY" : "NO KEY"}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-600">
                <span>Model ID:</span>
                <span className="font-bold text-zinc-900">
                  {diagnostics?.gemini?.model || "gemini-2.5-flash"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>API Key:</span>
                <span className="font-semibold text-zinc-700">
                  {diagnostics?.gemini?.keyMasked || "Configured"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Adaptive Loop:</span>
                <span className="font-semibold text-emerald-700">Enabled</span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>WAF Interceptor:</span>
                <span className="font-semibold text-zinc-900">
                  Pre-Execution
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 font-mono truncate">
            SDK: @google/genai (v0.1.1)
          </div>
        </div>

        {/* Node.js Runtime & Host Card */}
        <div className="glass-panel rounded-xl p-5 shadow-subtle bg-white border border-zinc-200 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm font-sans">
                <Server className="h-4 w-4 text-zinc-700" />
                <span>Node.js Gateway</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
                PORT {diagnostics?.system?.port || 4000}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-600">
                <span>Node Version:</span>
                <span className="font-bold text-zinc-900">
                  {diagnostics?.system?.nodeVersion || "v22.x"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Uptime:</span>
                <span className="font-semibold text-zinc-900">
                  {diagnostics?.system?.uptimeSeconds
                    ? formatUptime(diagnostics.system.uptimeSeconds)
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Heap Memory:</span>
                <span className="font-semibold text-zinc-900">
                  {diagnostics?.system?.memory?.heapUsedMb ?? "--"} MB /{" "}
                  {diagnostics?.system?.memory?.heapTotalMb ?? "--"} MB
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600">
                <span>Process RSS:</span>
                <span className="font-semibold text-zinc-900">
                  {diagnostics?.system?.memory?.rssMb ?? "--"} MB
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-400 font-mono truncate">
            Platform: {diagnostics?.system?.platform || "win32"} (
            {diagnostics?.system?.arch || "x64"})
          </div>
        </div>
      </div>

      {/* Interactive Operational Endpoint Tester */}
      <div className="glass-panel rounded-xl p-5 shadow-subtle bg-white border border-zinc-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-zinc-700" />
            <h3 className="font-semibold text-sm text-zinc-900 font-sans tracking-tight">
              Interactive Gateway Endpoint Prober
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400 font-sans">
            Directly test HTTP response codes and JSON payload shapes
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "GET /healthz", url: "/healthz" },
            { label: "GET /api/version", url: "/api/version" },
            {
              label: "GET /api/admin/stats/summary",
              url: "/api/admin/stats/summary",
            },
            {
              label: "GET /api/admin/diagnostics",
              url: "/api/admin/diagnostics",
            },
          ].map((ep) => (
            <button
              key={ep.url}
              onClick={() => handleTestEndpoint(ep.url)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all border ${testEndpoint === ep.url
                ? "bg-[#1a73e8] text-white border-[#1a73e8] shadow-xs"
                : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                }`}
            >
              {ep.label}
            </button>
          ))}
        </div>

        {testResult && (
          <div className="p-3.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2 border border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-zinc-400">
                Response for:{" "}
                <strong className="text-emerald-400">{testEndpoint}</strong>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${testResult.status === 200
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "bg-rose-950 text-rose-400 border border-rose-800"
                  }`}
              >
                STATUS {testResult.status}
              </span>
            </div>
            <pre className="text-[11px] text-emerald-300 overflow-x-auto max-h-64 whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(testResult.data || testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
