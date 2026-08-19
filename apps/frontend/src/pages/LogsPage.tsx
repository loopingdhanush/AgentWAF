import React, { useState, useEffect } from "react";
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";
import { api } from "../lib/api.js";

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTool, setFilterTool] = useState("");
  const [filterDisposition, setFilterDisposition] = useState("");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getLogs({
        tool: filterTool.trim() || undefined,
        disposition: filterDisposition || undefined,
        limit: 50,
      });
      setLogs(res.logs || []);
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filterDisposition]);

  const getDispositionBadge = (disp: string) => {
    switch (disp) {
      case "ALLOWED":
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium px-2.5 py-0.5 rounded-md text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> ALLOWED
          </span>
        );
      case "BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/80 font-medium px-2.5 py-0.5 rounded-md text-[11px]">
            <XCircle className="h-3 w-3" /> BLOCKED
          </span>
        );
      case "SHADOW_BLOCKED":
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/80 font-medium px-2.5 py-0.5 rounded-md text-[11px]">
            <Eye className="h-3 w-3" /> SHADOW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-600 border border-zinc-200 font-medium px-2.5 py-0.5 rounded-md text-[11px]">
            <AlertTriangle className="h-3 w-3" /> {disp}
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-editorial font-medium text-zinc-900 tracking-tight leading-none">
            Tool Call Audit Logs
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5">
            Complete historical record of intercepted tool calls, policy
            evaluations, and dispositions
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-3 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all text-xs font-medium flex items-center gap-1.5 self-start md:self-auto shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap items-center gap-3 shadow-subtle">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterTool}
            onChange={(e) => setFilterTool(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadLogs();
            }}
            placeholder="Search by tool name (e.g. get_customer_record)..."
            className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          <select
            value={filterDisposition}
            onChange={(e) => setFilterDisposition(e.target.value)}
            className="bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-mono"
          >
            <option value="">All Dispositions</option>
            <option value="ALLOWED">ALLOWED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="SHADOW_BLOCKED">SHADOW_BLOCKED</option>
            <option value="ERROR">ERROR</option>
          </select>

          <button
            onClick={loadLogs}
            className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-xl overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="py-3 px-4 font-semibold font-sans">Timestamp</th>
                <th className="py-3 px-4 font-semibold font-sans">Tool</th>
                <th className="py-3 px-4 font-semibold font-sans">Agent</th>
                <th className="py-3 px-4 font-semibold font-sans">
                  Disposition
                </th>
                <th className="py-3 px-4 font-semibold font-sans">Latency</th>
                <th className="py-3 px-4 font-semibold font-sans text-right">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {logs.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-zinc-400 font-sans"
                  >
                    No logs found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 text-zinc-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-zinc-900">
                      {log.tool}
                    </td>
                    <td className="py-3 px-4 text-zinc-600">
                      {log.agent?.name || log.agentId.substring(0, 12)}
                    </td>
                    <td className="py-3 px-4">
                      {getDispositionBadge(log.disposition)}
                    </td>
                    <td className="py-3 px-4 text-zinc-500">
                      {log.latencyMs}ms
                    </td>
                    <td className="py-3 px-4 text-right">
                      <ChevronRight className="h-4 w-4 text-zinc-400 inline" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl p-6 border border-zinc-200 shadow-panel space-y-4 max-h-[85vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-zinc-900 font-sans">
                  {selectedLog.tool}
                </span>
                {getDispositionBadge(selectedLog.disposition)}
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-zinc-600 text-[11px]">
              <div>
                <span className="text-zinc-400">Log ID:</span> {selectedLog.id}
              </div>
              <div>
                <span className="text-zinc-400">Request ID:</span>{" "}
                {selectedLog.requestId}
              </div>
              <div>
                <span className="text-zinc-400">Timestamp:</span>{" "}
                {new Date(selectedLog.timestamp).toLocaleString()}
              </div>
              <div>
                <span className="text-zinc-400">Agent:</span>{" "}
                {selectedLog.agent?.name || selectedLog.agentId}
              </div>
              <div>
                <span className="text-zinc-400">Session ID:</span>{" "}
                {selectedLog.sessionId}
              </div>
              <div>
                <span className="text-zinc-400">Latency:</span>{" "}
                {selectedLog.latencyMs} ms
              </div>
            </div>

            <div>
              <span className="text-zinc-500 font-semibold block mb-1 font-sans">
                Sanitized Parameters:
              </span>
              <pre className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 overflow-x-auto">
                {JSON.stringify(selectedLog.paramsSanitized, null, 2)}
              </pre>
            </div>

            <div>
              <span className="text-zinc-500 font-semibold block mb-1 font-sans">
                Per-Rule Outcomes:
              </span>
              <div className="space-y-2">
                {Array.isArray(selectedLog.ruleResults) &&
                  selectedLog.ruleResults.map((r: any, i: number) => (
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
                          {r.passed
                            ? "PASSED"
                            : `FAILED [${r.enforcementMode}]`}
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
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#1a73e8] hover:bg-[#1765cc] text-white rounded-lg text-xs font-semibold font-sans"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
