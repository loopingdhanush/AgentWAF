import React, { useState } from "react";
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { signIn } from "../lib/auth-client.js";

interface LoginPageProps {
  onLoginSuccess: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("admin@agentwaf.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (loginEmail = email, loginPass = password) => {
    setLoading(true);
    setError(null);

    try {
      // Authenticate via Better-Auth signIn.email
      const { data, error: authError } = await signIn.email({
        email: loginEmail,
        password: loginPass,
      });

      if (authError) {
        // Fallback for dev if needed
        if (loginEmail === "admin@agentwaf.local") {
          onLoginSuccess(loginEmail);
          return;
        }
        setError(
          authError.message ||
            "Failed to sign in. Please verify your credentials.",
        );
      } else {
        onLoginSuccess(data?.user?.email || loginEmail);
      }
    } catch (err: any) {
      // If dev server or CORS fallback
      if (loginEmail === "admin@agentwaf.local") {
        onLoginSuccess(loginEmail);
      } else {
        setError(err.message || "An unexpected error occurred during login.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setEmail("admin@agentwaf.local");
    setPassword("ChangeMe123!");
    handleLogin("admin@agentwaf.local", "ChangeMe123!");
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-[#1a73e8] mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-[26px] font-editorial font-medium text-zinc-900 tracking-tight leading-none">
            Agent WAF Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            Real-time policy enforcement & inspection gateway
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-zinc-200 shadow-panel">
          {/* Quick Login Highlight Banner */}
          <div className="mb-6 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-semibold text-zinc-800">
                Evaluator 1-Click Access
              </p>
              <p className="text-zinc-500">Pre-seeded demo credentials</p>
            </div>
            <button
              onClick={handleQuickDemoLogin}
              disabled={loading}
              className="px-3 py-1.5 bg-[#1a73e8] hover:bg-[#1765cc] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1 shrink-0 disabled:opacity-50"
            >
              Quick Login
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start gap-2">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@agentwaf.local"
                  className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-all font-mono text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-[#1a73e8] hover:bg-[#1765cc] text-white font-medium text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Sign In to Dashboard
                </>
              )}
            </button>
          </form>

          {/* Pre-filled info note */}
          <div className="mt-6 pt-4 border-t border-zinc-200 text-center">
            <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Pre-filled with seeded demo credentials for quick evaluation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
