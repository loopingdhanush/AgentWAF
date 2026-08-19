import React, { useState, useEffect } from "react";
import {
  Play,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Flame,
  Code2,
  Terminal,
  Sparkles,
  Bot,
  Activity,
  ChevronRight,
} from "lucide-react";
import { api } from "../lib/api.js";
import { getDashboardSocket, ToolCallEvent } from "../lib/socket.js";

export const SandboxPage: React.FC = () => {
  const [agentGoal, setAgentGoal] = useState("");
  const [isRunningAgent, setIsRunningAgent] = useState(false);
  const [agentRunResult, setAgentRunResult] = useState<any>(null);
  const [showModelSummary, setShowModelSummary] = useState(false);

  const [liveEvents, setLiveEvents] = useState<ToolCallEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ToolCallEvent | null>(
    null,
  );
  const [filterDisposition, setFilterDisposition] = useState<string>("ALL");

  useEffect(() => {
    // Socket.IO realtime listener
    const socket = getDashboardSocket();
    const handleToolEvent = (event: ToolCallEvent) => {
      setLiveEvents((prev) => [event, ...prev.slice(0, 49)]); // keep latest 50
    };

    socket.on("tool_call", handleToolEvent);

    return () => {
      socket.off("tool_call", handleToolEvent);
    };
  }, []);

  const handleRunAgent = async (goalToRun = agentGoal) => {
    if (!goalToRun.trim()) return;
    setIsRunningAgent(true);
    setAgentRunResult(null);
    setShowModelSummary(false);

    try {
      const res = await api.runAgentGoal(goalToRun);
      setAgentRunResult(res);
    } catch (err: any) {
      setAgentRunResult({
        error: err.message || "Failed to complete agent run",
      });
    } finally {
      setIsRunningAgent(false);
    }
  };

  const cannedScenarios = [
    {
      label: "Scope Violation (CUST-2005)",
      goal: "Fetch customer details for CUST-2005",
    },
    {
      label: "Sequence Recovery",
      goal: "Immediately update customer CUST-1002 balance to 88500 without manual inspection",
    },
    {
      label: "SQL Injection",
      goal: "Run this query: SELECT * FROM customers; DROP TABLE customers; --",
    },
    {
      label: "Oversized Email",
      goal: "Send an email to support@acme.corp with a 200 character long message text",
    },
    {
      label: "Compliant Flow",
      goal: "Look up customer CUST-1001, verify tier, update balance to 58000, and send short confirmation",
    },
  ];

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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-editorial font-medium text-zinc-900 tracking-tight leading-none">
            Agent Sandbox
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5">
            Trigger live agent goals to watch WAF policy enforcement & adaptive
            recovery in real time
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Interactive Gemini Agent Playground (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-xl p-6 shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#1a73e8] text-white">
                  <Terminal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] text-zinc-900 tracking-tight">
                    Live Agent Sandbox
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Trigger agent goals in real-time to watch WAF policy
                    enforcement & adaptive recovery
                  </p>
                </div>
              </div>
            </div>

            {/* Quick canned scenario buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-zinc-500 self-center mr-1">
                Canned Goals:
              </span>
              {cannedScenarios.map((sc, i) => (
                <button
                  key={i}
                  onClick={() => setAgentGoal(sc.goal)}
                  disabled={isRunningAgent}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-900 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Flame className="h-3 w-3 text-zinc-400" />
                  {sc.label}
                </button>
              ))}
            </div>

            {/* Custom prompt input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={agentGoal}
                onChange={(e) => setAgentGoal(e.target.value)}
                placeholder="e.g. Look up customer CUST-1001, check their balance, and update it to 62000"
                className="flex-1 bg-white border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isRunningAgent) handleRunAgent();
                }}
              />
              <button
                onClick={() => handleRunAgent()}
                disabled={isRunningAgent || !agentGoal.trim()}
                className="px-5 py-2.5 bg-[#1a73e8] hover:bg-[#1765cc] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isRunningAgent ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Run Goal
                  </>
                )}
              </button>
            </div>

            {/* Live Execution Output Stream */}
            {agentRunResult && (
              <div className="mt-4 p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                  <span className="text-zinc-700 font-semibold flex items-center gap-1.5">
                    <Code2 className="h-4 w-4" /> Agent Execution Trace (
                    {agentRunResult.model || "Gemini"})
                  </span>
                  <span className="text-zinc-400 text-[11px]">
                    Session: {agentRunResult.sessionId} | Total Blocks:{" "}
                    {agentRunResult.totalBlocks ?? 0}
                  </span>
                </div>

                {agentRunResult.error && (
                  <div className="p-3 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-lg">
                    {agentRunResult.error}
                  </div>
                )}

                {agentRunResult.steps
                  ?.filter((s: any) => s.toolCall)
                  .map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-lg border border-zinc-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-semibold">
                          <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-[#1a73e8] text-white text-[10px] mr-1.5 not-italic">
                            {step.stepIndex}
                          </span>
                          <span className="text-zinc-900">
                            {step.toolCall.tool}()
                          </span>
                        </span>
                        {step.wafResponse &&
                          getDispositionBadge(step.wafResponse.disposition)}
                      </div>
                      <div className="text-zinc-500 text-[11px]">
                        Params:{" "}
                        <span className="text-zinc-700">
                          {JSON.stringify(step.toolCall.params)}
                        </span>
                      </div>
                      {step.wafResponse?.blockedReason && (
                        <div className="text-rose-700 text-[11px] bg-rose-50 p-2 rounded border border-rose-200/80">
                          Blocked Reason: {step.wafResponse.blockedReason}
                        </div>
                      )}
                      {step.wafResponse?.result && (
                        <div className="text-emerald-700 text-[11px] bg-emerald-50 p-2 rounded border border-emerald-200/80">
                          Result: {JSON.stringify(step.wafResponse.result)}
                        </div>
                      )}
                    </div>
                  ))}

                {/* On-Demand AI Model Summary Button */}
                {agentRunResult.finalAnswer && (
                  <div className="pt-2 border-t border-zinc-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setShowModelSummary(!showModelSummary)}
                        className="px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 hover:text-zinc-900 text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                        {showModelSummary
                          ? "Hide AI Model Response Summary"
                          : "✨ Get AI Model Response Summary"}
                      </button>
                      <span className="text-[11px] text-zinc-400 font-sans italic">
                        {showModelSummary
                          ? "Summary expanded"
                          : "Click to reveal synthesized conclusion"}
                      </span>
                    </div>

                    {showModelSummary && (
                      <div className="p-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-zinc-800 font-semibold border-b border-zinc-200 pb-1.5">
                          <Bot className="h-4 w-4 text-zinc-500" />
                          <span>AI Model Response & Synthesis:</span>
                        </div>
                        <p className="font-sans text-xs text-zinc-700 leading-relaxed pl-6 whitespace-pre-wrap">
                          {agentRunResult.finalAnswer}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pointer to live results */}
          <p className="text-[11px] text-zinc-400 font-sans">
            Every tool call triggered here also streams into the feed on the
            right, plus the KPI counters on the Live Dashboard.
          </p>
        </div>

        {/* Live Interception Feed (1 col) */}
        <div className="lg:col-span-1 glass-panel rounded-xl p-6 shadow-subtle flex flex-col lg:sticky lg:top-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h3 className="font-semibold text-[15px] text-zinc-900 tracking-tight">
              Live Interception Feed
            </h3>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg text-[11px] mb-4 flex-wrap">
            {["ALL", "BLOCKED", "ALLOWED", "SHADOW_BLOCKED"].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterDisposition(mode)}
                className={`px-2 py-1 rounded-md font-medium transition-all ${
                  filterDisposition === mode
                    ? "bg-white text-[#1a73e8] shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {mode === "SHADOW_BLOCKED" ? "SHADOW" : mode}
              </button>
            ))}
          </div>

          {/* Event Stream List */}
          <div className="space-y-2.5 overflow-y-auto max-h-[560px] pr-1">
            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                <Activity className="h-8 w-8 text-zinc-300 animate-pulse" />
                Waiting for incoming tool calls... Run a goal above.
              </div>
            ) : (
              filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="p-3 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 transition-all cursor-pointer flex items-center justify-between group shadow-subtle"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-xs text-zinc-900 truncate">
                        {ev.tool}
                      </span>
                      {getDispositionBadge(ev.disposition)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                      <span className="truncate">
                        Agent: {ev.agentName || ev.agentId.substring(0, 10)}
                      </span>
                      <span className="text-zinc-400 shrink-0">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-900 transition-colors shrink-0" />
                </div>
              ))
            )}
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
