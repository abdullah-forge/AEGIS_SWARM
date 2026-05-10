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

const API_URL = "https://aegis-swarm-api.onrender.com";

export default function Home() {
  const [text, setText] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [activeReport, setActiveReport] = useState<AnalysisResult | null>(null);
  const [reportType, setReportType] = useState<"TXT" | "FILE" | null>(null);
  const [loading, setLoading] = useState(false);
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
    memoryMatches,
    details,
    similarThreats
  }: {
    verdict: string | undefined;
    confidence: number | undefined;
    modelUsed: string | undefined;
    titleHigh: string;
    titleLow: string;
    memoryMatches?: number;
    details?: any;
    similarThreats?: any[];
  }) => {
    const v = normalizeVerdict(verdict);
    const isThreat = v === "HIGH" || v === "HIGH RISK";
    
    if (v === "HIGH" || v === "LOW" || v === "HIGH RISK" || v === "SAFE" || v === "UNKNOWN") {
      return (
        <div className={`cyber-card ${isThreat ? 'threat-high' : ''} mt-6 flex-1 flex flex-col overflow-y-auto pr-2`}>
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

          {/* Details Section */}
          {details && Object.keys(details).length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="text-[10px] text-slate-500 tracking-widest font-bold uppercase mb-3">TELEMETRY_DATA</h4>
              <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                {Object.entries(details).map(([k, v]) => (
                  <div key={k} className="bg-black/30 p-3 border border-white/5 break-all">
                    <span className="text-[#00ffff]/70 mr-2 uppercase tracking-widest">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-white">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar Threats */}
          {similarThreats && similarThreats.length > 0 && (
             <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="text-[10px] text-slate-500 tracking-widest font-bold uppercase mb-3">MEMORY_CORE_MATCHES</h4>
              <div className="flex flex-col gap-2 text-xs font-mono">
                {similarThreats.map((t, i) => (
                  <div key={i} className="bg-black/50 p-3 border border-[#fcee0a]/30">
                    <div className="text-[#fcee0a] mb-2 font-bold tracking-widest">MATCH [{i+1}] - {t.threat_type}</div>
                    <div className="text-slate-300 break-words opacity-80">{t.content}</div>
                  </div>
                ))}
              </div>
             </div>
          )}
          
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
    <div className={`mt-6 h-full flex-1 cyber-card overflow-hidden ${isThreat ? 'threat-high' : ''}`}>
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
    setActiveReport(null);
    setLogs([]);
    
    simulateLogs();

    try {
      const res = await fetch(`${API_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      addLog(`ANALYSIS COMPLETE. VERDICT: ${data.verdict}`);
      setActiveReport(data);
      setReportType("TXT");
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
    setActiveReport(null);
    setLogs([]);

    simulateLogs();

    try {
      const formData = new FormData();
      formData.append("file", qrFile);
      
      const isDoc = qrFile.name.toLowerCase().endsWith('.eml') || qrFile.name.toLowerCase().endsWith('.txt');
      const isImage = qrFile.type.startsWith('image/');
      
      let endpoint = "/analyze/qr";
      if (isDoc) {
        endpoint = "/analyze/file";
      } else if (!isImage) {
        throw new Error("Unsupported file type");
      }
      
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      addLog(`DECODE COMPLETE. VERDICT: ${data.verdict}`);
      setActiveReport(data);
      setReportType("FILE");
    } catch (e) {
      console.error(e);
      addLog("ERROR: DECODE FAILED");
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col h-screen overflow-hidden">
      <div className="vignette"></div>
      
      {/* Top Navigation / Header */}
      <header className="max-w-7xl w-full mx-auto mb-8 flex flex-col md:flex-row justify-between items-end border-b border-white/10 pb-6 relative shrink-0">
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

      <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: INTERCEPTORS (Spans 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* TXT_INTERCEPTOR */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <div className="flex items-center gap-3">
                <div className="bg-[#00ffff] text-black font-black px-2 py-1 text-[10px] tracking-widest">MOD_01</div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-white">TXT_INTERCEPTOR</h2>
              </div>
            </div>
            
            <div className="cyber-card p-4">
              <div className="relative h-[120px]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00ffff]/50"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00ffff]/50"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00ffff]/50"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00ffff]/50"></div>
                
                <textarea
                  className="w-full h-full bg-transparent border-none p-4 text-xs text-[#00ffff] placeholder-slate-600 focus:outline-none transition resize-none font-mono"
                  placeholder="> PASTE_SUSPICIOUS_PAYLOAD_HERE..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              
              <button 
                onClick={analyzeText}
                disabled={loading || !text || qrLoading}
                className="cyber-button mt-4 w-full py-3 text-xs"
              >
                {loading ? "PROCESSING..." : "EXECUTE_SCAN //"}
              </button>
            </div>
          </div>

          {/* FILE_DECODER */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <div className="flex items-center gap-3">
                <div className="bg-[#ff00ff] text-black font-black px-2 py-1 text-[10px] tracking-widest">MOD_02</div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-white">FILE_DECODER</h2>
              </div>
            </div>
            
            <div className="cyber-card p-4">
              <div className="cyber-dropzone h-[120px] w-full flex items-center justify-center p-4 cursor-pointer">
                <label className="cursor-pointer w-full text-center h-full flex flex-col items-center justify-center">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, .eml, .txt"
                    onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  {qrFile ? (
                    <div className="text-[#ff00ff]">
                      <p className="text-sm font-bold truncate max-w-[200px] mb-1">{qrFile.name}</p>
                      <p className="text-[10px] text-slate-500 tracking-widest uppercase">CLICK_TO_OVERRIDE</p>
                    </div>
                  ) : (
                    <div className="text-[#00ffff]">
                      <p className="text-xs font-bold tracking-widest uppercase mb-1">DROP_TARGET</p>
                      <p className="text-[10px] text-slate-500 uppercase">IMG / EML / TXT</p>
                    </div>
                  )}
                </label>
              </div>
              
              <button 
                onClick={analyzeFile}
                disabled={qrLoading || !qrFile || loading}
                className="cyber-button threat-btn mt-4 w-full py-3 text-xs"
              >
                {qrLoading ? "DECODING..." : "EXECUTE_SCAN //"}
              </button>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: ANALYSIS REPORT (Spans 5 cols) */}
        <div className="lg:col-span-5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2 shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-[#00ffff] text-black font-black px-2 py-1 text-[10px] tracking-widest">MOD_03</div>
              <h2 className="text-lg font-bold tracking-widest uppercase text-white">ANALYSIS_REPORT</h2>
            </div>
          </div>
          
          <div className="cyber-card flex-1 flex flex-col p-6 min-h-0 relative overflow-hidden">
             {(loading || qrLoading) ? (
               <LoadingSkeleton isThreat={qrLoading} />
             ) : activeReport ? (
               <div className="animate-[fadeIn_0.3s_ease-in-out] h-full flex flex-col overflow-hidden">
                 <VerdictPanel
                   verdict={activeReport.verdict}
                   confidence={activeReport.confidence}
                   modelUsed={activeReport.model_used}
                   memoryMatches={activeReport.memory_matches}
                   titleHigh={reportType === "FILE" ? "MALWARE_DETECTED" : "BREACH_DETECTED"}
                   titleLow={reportType === "FILE" ? "FILE_SECURE" : "PAYLOAD_SECURE"}
                   details={activeReport.details}
                   similarThreats={activeReport.similar_threats}
                 />
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-slate-700 p-8 text-center bg-black/30 opacity-70">
                 <div className="w-12 h-12 border-2 border-slate-700 flex items-center justify-center mb-4 rounded-full">
                    <span className="text-slate-500">i</span>
                 </div>
                 NO_ACTIVE_REPORT<br/><br/>
                 AWAITING_SCAN_EXECUTION FROM MOD_01 OR MOD_02
               </div>
             )}
          </div>
        </div>

        {/* RIGHT COLUMN: DATA STREAM (Spans 3 cols) */}
        <div className="lg:col-span-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2 shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-[#fcee0a] text-black font-black px-2 py-1 text-[10px] tracking-widest">SYS_LOG</div>
              <h2 className="text-lg font-bold tracking-widest uppercase text-white">DATA_STREAM</h2>
            </div>
          </div>
          
          <div className="cyber-card flex-1 flex flex-col p-0 overflow-hidden bg-black/90 border-[#fcee0a]/30">
            <div className="p-4 bg-[#fcee0a]/5 border-b border-[#fcee0a]/20 flex justify-between items-center shrink-0">
              <span className="text-[#fcee0a] text-[10px] font-black tracking-widest uppercase">LIVE_TRACE</span>
              <span className="w-2 h-2 rounded-full bg-[#fcee0a] animate-pulse"></span>
            </div>
            <div className="p-4 flex-1 data-stream font-mono text-slate-300 overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <div className="opacity-50 italic text-xs">Waiting for telemetry...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="log-entry mb-2 text-xs">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      <footer className="max-w-7xl mx-auto mt-8 pt-4 flex justify-between text-slate-600 text-[10px] tracking-widest border-t border-slate-800 uppercase font-bold shrink-0">
        <span>AUTHOR: ABDULLAH // FA23-BCE-049</span>
        <span className="flex items-center gap-2">
          <span>SECURE_NODE</span>
          <span className="inline-block w-3 h-3 border border-slate-600 bg-slate-800"></span>
        </span>
      </footer>
    </main>
  );
}
