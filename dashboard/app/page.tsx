"use client";

import { useState } from "react";

type AnalysisResult = {
  verdict: string;
  confidence: number;
  model_used: string;
  memory_matches: number;
  similar_threats: any[];
  details: any;
};

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrResult, setQrResult] = useState<AnalysisResult | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const normalizeVerdict = (v: string | undefined | null) =>
    (v || "").toString().trim().toUpperCase();

  const confidencePercent = (v: number | undefined) => {
    const n = typeof v === "number" && !Number.isNaN(v) ? v : 0;
    return Math.max(0, Math.min(100, n));
  };

  const ConfidenceBar = ({ value }: { value: number | undefined }) => {
    const pct = confidencePercent(value);
    const hue = pct >= 70 ? 0 : pct >= 35 ? 200 : 145; // red/cyan/green-ish
    return (
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>CONFIDENCE</span>
          <span className="font-mono text-slate-300">{pct.toFixed(1)}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-black/40 border border-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, hsla(${hue}, 90%, 60%, 0.65), hsla(${hue + 30}, 90%, 60%, 0.9))`,
            }}
          />
        </div>
      </div>
    );
  };

  const VerdictBadge = ({
    verdict,
    labelHigh,
    labelLow,
  }: {
    verdict: string | undefined;
    labelHigh: string;
    labelLow: string;
  }) => {
    const v = normalizeVerdict(verdict);
    if (v === "HIGH") {
      return (
        <span className="bg-red-500/20 text-red-300 text-xs px-3 py-1 rounded-full border border-red-500/50">
          {labelHigh}
        </span>
      );
    }
    if (v === "LOW") {
      return (
        <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/50">
          {labelLow}
        </span>
      );
    }
    return (
      <span className="bg-yellow-500/20 text-yellow-300 text-xs px-3 py-1 rounded-full border border-yellow-500/50">
        UNKNOWN
      </span>
    );
  };

  const VerdictPanel = ({
    verdict,
    confidence,
    modelUsed,
    titleHigh,
    titleLow,
    glow,
  }: {
    verdict: string | undefined;
    confidence: number | undefined;
    modelUsed: string | undefined;
    titleHigh: string;
    titleLow: string;
    glow: "glow-red" | "glow-cyan";
  }) => {
    const v = normalizeVerdict(verdict);
    if (v === "HIGH") {
      return (
        <div className={`bg-red-500/10 border border-red-500/50 rounded-xl p-4 ${glow}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-red-400 font-bold tracking-wider text-lg">
              {titleHigh}
            </h3>
            <VerdictBadge
              verdict={verdict}
              labelHigh="HIGH RISK"
              labelLow="LOW RISK"
            />
          </div>
          <ConfidenceBar value={confidence} />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">ENGINE USED</p>
              <p className="text-slate-300 text-sm mt-1">
                {modelUsed || "—"}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (v === "LOW") {
      return (
        <div className={`bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-4 ${glow}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-emerald-400 font-bold tracking-wider text-lg">
              {titleLow}
            </h3>
            <VerdictBadge
              verdict={verdict}
              labelHigh="HIGH RISK"
              labelLow="LOW RISK"
            />
          </div>
          <ConfidenceBar value={confidence} />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">ENGINE USED</p>
              <p className="text-slate-300 text-sm mt-1">
                {modelUsed || "—"}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-yellow-400 font-bold tracking-wider">
            ⚠ PARSE/CLASSIFY ERROR
          </h3>
          <VerdictBadge
            verdict={verdict}
            labelHigh="HIGH RISK"
            labelLow="LOW RISK"
          />
        </div>
        <p className="text-yellow-300/70 text-sm mt-2">
          No actionable result yet.
        </p>
      </div>
    );
  };

  const LoadingSkeleton = ({ tone }: { tone: "purple" | "orange" }) => (
    <div className="mt-6 space-y-4 animate-[fadeIn_0.3s_ease-in-out]" aria-hidden="true">
      <div className="bg-black/60 border border-slate-800 rounded-xl p-4">
        <div className="h-4 w-2/3 rounded bg-slate-700 animate-pulse"></div>
        <div className="mt-3 h-10 w-full rounded bg-slate-800 animate-pulse"></div>
        <div className="mt-3 h-24 w-full rounded bg-slate-800 animate-pulse"></div>
      </div>
    </div>
  );

  const EmptyHint = ({ text }: { text: string }) => (
    <div className="mt-6 bg-black/40 border border-slate-800 rounded-xl p-4 text-slate-500">
      {text}
    </div>
  );

  const analyzeText = async () => {
    if (!text) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8000/analyze/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeQR = async () => {
    if (!qrFile) return;
    setQrLoading(true);
    setQrResult(null);
    try {
      const formData = new FormData();
      formData.append("file", qrFile);
      const res = await fetch("http://localhost:8000/analyze/qr", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setQrResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 font-mono">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-center border-b border-purple-500/20 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-wider text-white flex items-center gap-3">
            <span className="text-purple-500">AEGIS</span>-<span className="text-cyan-400">SWARM</span>
          </h1>
          <p className="text-slate-500 tracking-widest text-sm mt-1">INTELLIGENT MULTI-MODAL THREAT TRIAGE</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-2 text-xs text-slate-500 border border-slate-800 px-4 py-2 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          SYSTEMS ONLINE
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* TEXT ANALYSIS MODULE */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 text-xl">📝</div>
            <div>
              <h2 className="text-lg font-bold text-purple-300 tracking-wide">TEXT PARSER</h2>
              <p className="text-xs text-slate-500">SHIELD-AI NLP ENGINE</p>
            </div>
          </div>

          <label className="sr-only" htmlFor="textInput">
            Text payload
          </label>
          <textarea
            id="textInput"
            className="flex-1 min-h-[140px] w-full bg-black/40 border border-slate-700/50 rounded-lg p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition font-mono resize-none"
            placeholder={"> paste_sms_or_email_payload_here..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          
          <button 
            onClick={analyzeText}
            disabled={loading}
            className="mt-4 w-full py-3 bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 text-purple-200 rounded-lg font-bold tracking-widest text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-pulse-glow">● SCANNING...</span>
            ) : (
              "▶ EXECUTE SCAN"
            )}
          </button>

          {/* Text Results UI */}
          <div aria-live="polite">
            {loading ? (
              <LoadingSkeleton tone="purple" />
            ) : result ? (
              <div className="mt-6 space-y-4 animate-[fadeIn_0.3s_ease-in-out]">
                <VerdictPanel
                  verdict={result.verdict}
                  confidence={result.confidence}
                  modelUsed={result.model_used}
                  titleHigh="⚠ THREAT DETECTED"
                  titleLow="✓ CLEAR"
                  glow="glow-red"
                />
                <div className="bg-black/60 border border-slate-800 rounded-lg p-4 font-mono text-xs">
                  <div className="flex items-center gap-2 text-slate-500 mb-2 border-b border-slate-800 pb-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                    MEMORY_CORE // PGVECTOR
                  </div>
                  <p className="text-slate-400 mb-2">
                    {"<"} query_similar_vectors(threshold=0.55)
                  </p>
                  <p className="text-cyan-400">
                    {"<"} Found: {result.memory_matches} historical matches.
                  </p>
                  {result.details && (
                    <p className="text-slate-500 mt-2">
                      {"<"} raw_prob: {result.details.phishing_probability}%
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyHint text="Awaiting scan… paste a payload and execute the scan." />
            )}
          </div>
        </div>

        {/* QR ANALYSIS MODULE */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 text-xl">🖼️</div>
            <div>
              <h2 className="text-lg font-bold text-orange-300 tracking-wide">QR PARSER</h2>
              <p className="text-xs text-slate-500">VISUAL AGENT - URL CLASSIFIER</p>
            </div>
          </div>
          
          <div className="flex-1 min-h-[140px] w-full bg-black/40 border border-dashed border-slate-700/50 rounded-lg flex items-center justify-center p-6">
            <label className="cursor-pointer w-full text-center">
              <label className="sr-only" htmlFor="qrInput">
                QR image
              </label>
              <input
                id="qrInput"
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {qrFile ? (
                <div className="text-cyan-400">
                  <p className="text-lg">📄 {qrFile.name}</p>
                  <p className="text-xs text-slate-500 mt-1">Click to change</p>
                </div>
              ) : (
                <div className="text-slate-600">
                  <p className="text-3xl mb-2">▹</p>
                  <p className="text-sm">DROP QR IMAGE HERE</p>
                </div>
              )}
            </label>
          </div>
          
          <button 
            onClick={analyzeQR}
            disabled={qrLoading || !qrFile}
            className="mt-4 w-full py-3 bg-orange-600/20 border border-orange-500/50 hover:bg-orange-600/40 text-orange-200 rounded-lg font-bold tracking-widest text-sm transition flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {qrLoading ? (
              <span className="animate-pulse-glow">● DECODING...</span>
            ) : (
              "▶ EXECUTE SCAN"
            )}
          </button>

          {/* QR Results UI */}
          <div aria-live="polite">
            {qrLoading ? (
              <LoadingSkeleton tone="orange" />
            ) : qrResult ? (
              <div className="mt-6 space-y-4 animate-[fadeIn_0.3s_ease-in-out]">
                <VerdictPanel
                  verdict={qrResult.verdict}
                  confidence={qrResult.confidence}
                  modelUsed={qrResult.model_used}
                  titleHigh="⚠ MALICIOUS QR"
                  titleLow="✓ SAFE QR"
                  glow="glow-red"
                />
                {normalizeVerdict(qrResult.verdict) === "LOW" && (
                  <div className="hidden" />
                )}

                {/* extra parse error detail */}
                {normalizeVerdict(qrResult.verdict) !== "HIGH" &&
                  normalizeVerdict(qrResult.verdict) !== "LOW" && (
                    <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4">
                      <h3 className="text-yellow-400 font-bold tracking-wider">
                        ⚠ PARSE ERROR
                      </h3>
                      <p className="text-yellow-300/70 text-sm mt-1">
                        {qrResult.details?.message || "No URL found"}
                      </p>
                    </div>
                  )}

                {qrResult.details?.decoded_url && (
                  <div className="bg-black/60 border border-slate-800 rounded-lg p-4 font-mono text-xs">
                    <p className="text-slate-500 mb-1">DECODED PAYLOAD:</p>
                    <p className="text-cyan-400 break-all">
                      {qrResult.details.decoded_url}
                    </p>
                  </div>
                )}

                <div className="bg-black/60 border border-slate-800 rounded-lg p-4 font-mono text-xs">
                  <div className="flex items-center gap-2 text-slate-500 mb-2 border-b border-slate-800 pb-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                    MEMORY_CORE // PGVECTOR
                  </div>
                  <p className="text-cyan-400">
                    {"<"} Found: {qrResult.memory_matches} historical matches.
                  </p>
                </div>
              </div>
            ) : (
              <EmptyHint text="Awaiting scan… upload a QR image and execute the scan." />
            )}
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 border-t border-slate-800/50 pt-6 flex flex-col md:flex-row justify-between text-slate-600 text-xs tracking-widest">
        <span>DEV: MUHAMMAD ABDULLAH // FA23-BCE-049</span>
        <span>COMSATS UNIVERSITY LAHORE // CE DEPT</span>
      </footer>
    </main>
  );
}