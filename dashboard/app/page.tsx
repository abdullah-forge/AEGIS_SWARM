"use client";

import { useState, useEffect } from "react";

type AnalysisResult = {
  verdict: string;
  confidence: number;
  model_used: string;
  memory_matches: number;
  similar_threats: any[];
  details: any;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrResult, setQrResult] = useState<AnalysisResult | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Simulate data streams
  const addLog = (msg: string) => {
    setLogs((prev) => [...prev.slice(-8), `[${new Date().toISOString().split('T')[1].slice(0,-1)}] ${msg}`]);
  };

  const normalizeVerdict = (v: string | undefined | null) =>
    (v || "").toString().trim().toUpperCase();

  const confidencePercent = (v: number | undefined) => {
    const n = typeof v === "number" && !Number.isNaN(v) ? v : 0;
    return Math.max(0, Math.min(100, n));
  };

  const ConfidenceBar = ({ value, isThreat }: { value: number | undefined, isThreat: boolean }) => {
    const pct = confidencePercent(value);
    const color = isThreat ? "var(--neon-pink)" : "var(--neon-cyan)";
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-slate-400 font-black tracking-widest uppercase mb-2">
          <span>SYS_CONFIDENCE</span>
          <span style={{ color, textShadow: `0 0 10px ${color}` }}>{pct.toFixed(1)}%</span>
        </div>
        <div className="h-4 w-full bg-[#0a0a0a] border border-slate-700 relative overflow-hidden clip-path-slant">
          {/* Cyberpunk segmented bar effect */}
          <div className="absolute inset-0 flex">
            {[...Array(25)].map((_, i) => (
              <div key={i} className="flex-1 border-r border-black/80 z-10" />
            ))}
          </div>
          <div
            className="h-full relative z-0 transition-all duration-[1500ms] ease-out"
            style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 15px ${color}` }}
          />
        </div>
      </div>
    );
  };

  const VerdictPanel = ({
    verdict,
    confidence,
    modelUsed,
    titleHigh,
    titleLow,
    memoryMatches
  }: {
    verdict: string | undefined;
    confidence: number | undefined;
    modelUsed: string | undefined;
    titleHigh: string;
    titleLow: string;
    memoryMatches?: number;
  }) => {
    const v = normalizeVerdict(verdict);
    const isThreat = v === "HIGH" || v === "HIGH RISK";
    
    if (v === "HIGH" || v === "LOW" || v === "HIGH RISK" || v === "SAFE") {
      return (
        <div className={`cyber-card ${isThreat ? 'threat-high' : ''} mt-6`}>
          <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4 relative">
            <div className="absolute -left-2 top-0 bottom-0 w-1 bg-current" style={{ color: isThreat ? 'var(--neon-pink)' : 'var(--neon-cyan)' }}></div>
            <h3 className={`font-black tracking-widest text-2xl pl-2 ${isThreat ? 'text-[#ff00ff] glitch-text' : 'text-[#00ffff]'}`} data-text={isThreat ? titleHigh : titleLow}>
              {isThreat ? titleHigh : titleLow}
            </h3>
            <div className={`px-3 py-1 text-[10px] font-black tracking-widest border ${isThreat ? 'border-[#ff00ff] text-[#ff00ff] bg-[#ff00ff]/10' : 'border-[#00ffff] text-[#00ffff] bg-[#00ffff]/10'}`}>
              [ {isThreat ? 'CRITICAL_ALERT' : 'STATUS_SECURE'} ]
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">
            <div>
              <div className="mb-1 opacity-50">ANALYSIS_ENGINE</div>
              <div className="text-white font-bold">{modelUsed || "UNKNOWN"}</div>
            </div>
            {memoryMatches !== undefined && (
              <div>
                <div className="mb-1 opacity-50">DB_MATCHES</div>
                <div className={memoryMatches > 0 ? "text-[#fcee0a] font-bold" : "text-white font-bold"}>
                  {memoryMatches} FOUND
                </div>
              </div>
            )}
          </div>
          
          <ConfidenceBar value={confidence} isThreat={isThreat} />
        </div>
      );
    }

    return (
      <div className="cyber-card mt-6 border-red-500">
        <h3 className="text-[#ff003c] font-bold tracking-widest glitch-text" data-text="⚠ ERR: PARSE_FAILURE">⚠ ERR: PARSE_FAILURE</h3>
        <p className="text-slate-400 text-sm mt-2">Payload corrupted or unreadable.</p>
      </div>
    );
  };

  const LoadingSkeleton = ({ isThreat = false }) => (
    <div className={`mt-6 cyber-card overflow-hidden ${isThreat ? 'threat-high' : ''}`}>
      <div className={`scanner-bar ${isThreat ? 'threat' : ''}`}></div>
      <div className="flex items-center gap-3 mb-6">
        <span className={`w-3 h-3 ${isThreat ? 'bg-[#ff00ff]' : 'bg-[#00ffff]'} animate-pulse-fast`}></span>
        <span className={`text-sm font-black tracking-widest ${isThreat ? 'text-[#ff00ff]' : 'text-[#00ffff]'}`}>DECRYPTING_PAYLOAD...</span>
      </div>
      <div className="space-y-3">
        <div className="h-2 w-full bg-slate-800/50"></div>
        <div className="h-2 w-5/6 bg-slate-800/50"></div>
        <div className="h-2 w-4/6 bg-slate-800/50"></div>
      </div>
    </div>
  );

  const simulateLogs = async () => {
    addLog("INITIATING HANDSHAKE...");
    await new Promise(r => setTimeout(r, 400));
    addLog("EXTRACTING FEATURES...");
    await new Promise(r => setTimeout(r, 400));
    addLog("QUERYING ML INFERENCE ENGINE...");
    await new Promise(r => setTimeout(r, 400));
    addLog("SEARCHING PGVECTOR MEMORY CORE...");
  };

  const analyzeText = async () => {
    if (!text) return;
    setLoading(true);
    setResult(null);
    setLogs([]);
    
    // Fire off log simulation without awaiting
    simulateLogs();

    try {
      const res = await fetch(`${API_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      addLog(`ANALYSIS COMPLETE. VERDICT: ${data.verdict}`);
      setResult(data);
    } catch (e) {
      console.error(e);
      addLog("ERROR: CONNECTION FAILED");
    } finally {
      setLoading(false);
    }
  };

  const analyzeFile = async () => {
    if (!qrFile) return;
    setQrLoading(true);
    setQrResult(null);
    setLogs([]);

    simulateLogs();

    try {
      const formData = new FormData();
      formData.append("file", qrFile);
      
      const isDoc = qrFile.name.endsWith('.eml') || qrFile.name.endsWith('.txt');
      const endpoint = isDoc ? "/analyze/file" : "/analyze/qr";
      
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      addLog(`DECODE COMPLETE. VERDICT: ${data.verdict}`);
      setQrResult(data);
    } catch (e) {
      console.error(e);
      addLog("ERROR: DECODE FAILED");
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="vignette"></div>
      
      {/* Top Navigation / Header */}
      <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-end border-b border-white/10 pb-6 relative">
        <div className="absolute bottom-0 left-0 w-1/3 h-px bg-gradient-to-r from-[var(--neon-cyan)] to-transparent"></div>
        <div>
          <h1 className="text-5xl md:text-6xl font-black tracking-widest uppercase glitch-text text-white mb-2" data-text="AEGIS-SWARM">
            AEGIS-SWARM
          </h1>
          <div className="flex items-center gap-4">
            <span className="bg-[#00ffff] text-black text-[10px] font-black px-2 py-0.5 tracking-widest uppercase">SYS_ONLINE</span>
            <p className="text-[#00ffff] tracking-widest text-xs uppercase font-mono">
              Threat Intelligence Terminal v3.0 // CYBER_CORE
            </p>
          </div>
        </div>
        <div className="mt-6 md:mt-0 px-4 py-3 bg-[var(--dark-bg)] border border-[#00ffff]/30 text-[#00ffff] text-[10px] font-bold tracking-widest uppercase flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#ff00ff] animate-pulse-fast"></span>
            UPLINK: SECURE
          </div>
          <div className="opacity-50">NODE: {API_URL.replace("http://", "").replace("https://", "")}</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: TXT_INTERCEPTOR (Spans 5 cols) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
            <div className="flex items-center gap-3">
              <div className="bg-[#00ffff] text-black font-black px-2 py-1 text-[10px] tracking-widest">MOD_01</div>
              <h2 className="text-lg font-bold tracking-widest uppercase text-white">TXT_INTERCEPTOR</h2>
            </div>
            <div className="text-[10px] text-slate-500 font-mono tracking-widest">AWAITING_INPUT</div>
          </div>
          
          <div className="cyber-card flex-1 flex flex-col p-6">
            <div className="relative flex-1 min-h-[200px]">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00ffff]/50"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00ffff]/50"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00ffff]/50"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00ffff]/50"></div>
              
              <textarea
                className="w-full h-full min-h-[200px] bg-transparent border-none p-6 text-sm text-[#00ffff] placeholder-slate-600 focus:outline-none transition resize-none font-mono"
                placeholder="> PASTE_SUSPICIOUS_PAYLOAD_HERE..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            
            <button 
              onClick={analyzeText}
              disabled={loading || !text}
              className="cyber-button mt-6 w-full py-4 text-sm"
            >
              {loading ? "PROCESSING..." : "EXECUTE_SCAN //"}
            </button>

            {loading ? <LoadingSkeleton /> : result ? (
              <div className="animate-[fadeIn_0.3s_ease-in-out]">
                <VerdictPanel
                  verdict={result.verdict}
                  confidence={result.confidence}
                  modelUsed={result.model_used}
                  memoryMatches={result.memory_matches}
                  titleHigh="BREACH_DETECTED"
                  titleLow="PAYLOAD_SECURE"
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* MIDDLE COLUMN: FILE_DECODER (Spans 4 cols) */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
            <div className="flex items-center gap-3">
              <div className="bg-[#ff00ff] text-black font-black px-2 py-1 text-[10px] tracking-widest">MOD_02</div>
              <h2 className="text-lg font-bold tracking-widest uppercase text-white">FILE_DECODER</h2>
            </div>
          </div>
          
          <div className="cyber-card flex-1 flex flex-col p-6">
            <div className="cyber-dropzone flex-1 min-h-[200px] w-full flex items-center justify-center p-6 cursor-pointer">
              <label className="cursor-pointer w-full text-center h-full flex flex-col items-center justify-center">
                <input
                  type="file"
                  accept="image/png, image/jpeg, .eml, .txt"
                  onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {qrFile ? (
                  <div className="text-[#ff00ff]">
                    <div className="w-12 h-12 border-2 border-[#ff00ff] flex items-center justify-center mx-auto mb-4 rounded-sm bg-[#ff00ff]/10">
                      <span className="font-bold">FILE</span>
                    </div>
                    <p className="text-sm font-bold truncate max-w-[200px]">{qrFile.name}</p>
                    <p className="text-[10px] text-slate-500 mt-2 tracking-widest uppercase">CLICK_TO_OVERRIDE</p>
                  </div>
                ) : (
                  <div className="text-[#00ffff]">
                    <div className="w-12 h-12 border-2 border-[#00ffff]/30 flex items-center justify-center mx-auto mb-4 rounded-sm border-dashed">
                      <p className="text-2xl font-black">+</p>
                    </div>
                    <p className="text-xs font-bold tracking-widest uppercase">DROP_TARGET</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase">IMG / EML / TXT</p>
                  </div>
                )}
              </label>
            </div>
            
            <button 
              onClick={analyzeFile}
              disabled={qrLoading || !qrFile}
              className="cyber-button threat-btn mt-6 w-full py-4 text-sm"
            >
              {qrLoading ? "DECODING..." : "EXECUTE_SCAN //"}
            </button>

            {qrLoading ? <LoadingSkeleton isThreat={true} /> : qrResult ? (
              <div className="animate-[fadeIn_0.3s_ease-in-out]">
                <VerdictPanel
                  verdict={qrResult.verdict}
                  confidence={qrResult.confidence}
                  modelUsed={qrResult.model_used}
                  memoryMatches={qrResult.memory_matches}
                  titleHigh="MALWARE_DETECTED"
                  titleLow="FILE_SECURE"
                />
                
                {qrResult.details?.decoded_url && (
                  <div className="mt-6 border border-[#00ffff]/30 bg-black/50 p-4 text-xs font-mono relative">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#00ffff] to-transparent"></div>
                    <div className="text-[#00ffff] mb-2 font-bold tracking-widest">&gt; EXTRACTED_PAYLOAD:</div>
                    <div className="text-white break-all">{qrResult.details.decoded_url}</div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT COLUMN: DATA STREAM (Spans 3 cols) */}
        <div className="lg:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
            <div className="flex items-center gap-3">
              <div className="bg-[#fcee0a] text-black font-black px-2 py-1 text-[10px] tracking-widest">SYS_LOG</div>
              <h2 className="text-lg font-bold tracking-widest uppercase text-white">DATA_STREAM</h2>
            </div>
          </div>
          
          <div className="cyber-card flex-1 flex flex-col p-0 overflow-hidden bg-black/90 border-[#fcee0a]/30">
            <div className="p-4 bg-[#fcee0a]/5 border-b border-[#fcee0a]/20 flex justify-between items-center">
              <span className="text-[#fcee0a] text-[10px] font-black tracking-widest uppercase">LIVE_TRACE</span>
              <span className="w-2 h-2 rounded-full bg-[#fcee0a] animate-pulse"></span>
            </div>
            <div className="p-4 flex-1 data-stream font-mono text-slate-300 min-h-[400px]">
              {logs.length === 0 ? (
                <div className="opacity-50 italic">Waiting for telemetry...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="log-entry mb-2">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      <footer className="max-w-7xl mx-auto mt-16 pt-6 flex justify-between text-slate-600 text-[10px] tracking-widest border-t border-slate-800 uppercase font-bold">
        <span>AUTHOR: ABDULLAH // FA23-BCE-049</span>
        <span className="flex items-center gap-2">
          <span>SECURE_NODE</span>
          <span className="inline-block w-3 h-3 border border-slate-600 bg-slate-800"></span>
        </span>
      </footer>
    </main>
  );
}