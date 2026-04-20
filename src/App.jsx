import { useState, useEffect } from "react";

const CALL_TYPES = ["Inbound Support", "Outbound Sales", "Appointment Scheduling", "Lead Qualification", "Collections / Billing", "Other"];

const SYSTEM_PROMPT = `You are a senior UX designer specializing in conversational AI and voice agent interfaces. Your job is to audit voice agent scripts and call flows for UX quality — specifically friction, clarity, and caller drop-off risk.

Analyze the provided voice agent script or call flow description and return ONLY a JSON object with this exact structure (no markdown, no preamble):

{
  "overall_score": <number 1-10>,
  "score_label": "<one of: Critical Issues | Needs Work | Decent Foundation | Strong Design | Excellent>",
  "summary": "<2-3 sentence plain-language diagnosis of the biggest UX issue and opportunity>",
  "friction_points": [
    { "issue": "<specific problem>", "severity": "<High|Medium|Low>", "recommendation": "<specific fix>" }
  ],
  "clarity_issues": [
    { "issue": "<what's unclear>", "example": "<quote or moment from the script>", "fix": "<how to rewrite or redesign it>" }
  ],
  "dropoff_risks": [
    { "moment": "<when in the call>", "reason": "<why callers bail>", "mitigation": "<design solution>" }
  ],
  "wins": ["<thing done well>"],
  "quick_wins": ["<high-impact, low-effort improvement>"]
}

Be specific, opinionated, and act like a designer who has shipped real voice products. Don't be generic. Reference the actual script content in your feedback. Return ONLY valid JSON.`;

const C = {
  bg:        "#1E2019",  // Carbon Black
  surface:   "#272B27",  // slightly lifted surface
  surfaceAlt:"#2E3330",  // card bg
  border:    "#393E41",  // Gunmetal
  borderSub: "#2C3030",
  gold:      "#E2C044",  // Old Gold — primary accent
  goldDim:   "#E2C04422",
  blue:      "#587B7F",  // Pine Blue — secondary
  blueDim:   "#587B7F22",
  textPrimary: "#F5F3EE", // near white — main text
  textSub:   "#D3D0CB",  // Dust Grey — secondary
  textMuted: "#8A8880",  // muted — char count etc
  white:     "#FFFFFF",
};

function ScoreMeter({ score }) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference * (1 - score / 10);
  const scoreColor = score >= 8 ? C.gold : score >= 5 ? C.blue : "#C0504A";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 92, height: 92, margin: "0 auto" }}>
        <svg width="92" height="92" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="46" cy="46" r="38" fill="none" stroke={C.border} strokeWidth="6" />
          <circle cx="46" cy="46" r="38" fill="none" stroke={scoreColor}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: C.white, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 10, color: C.textMuted }}>/ 10</span>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ level }) {
  const map = {
    High:   { bg: "#C0504A22", color: "#E07570", border: "#C0504A55" },
    Medium: { bg: "#E2C04422", color: "#E2C044", border: "#E2C04455" },
    Low:    { bg: "#587B7F22", color: "#7AAAB0", border: "#587B7F55" },
  };
  const s = map[level] || map.Low;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      padding: "2px 9px", borderRadius: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap"
    }}>{level}</span>
  );
}

function SectionLabel({ title, icon, accent = C.gold }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 13, color: accent }}>{icon}</span>
      <span style={{ fontSize: 10, color: accent, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>{title}</span>
    </div>
  );
}

function Card({ children, leftColor }) {
  return (
    <div style={{
      background: C.surfaceAlt,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${leftColor || C.border}`,
      borderRadius: 8, padding: "12px 14px", marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Panel({ children, style = {} }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12, padding: 20, marginBottom: 12,
      ...style
    }}>
      {children}
    </div>
  );
}

export default function VoiceUXAuditor() {
  const [script, setScript]     = useState("");
  const [callType, setCallType] = useState("Inbound Support");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [dots, setDots]         = useState("");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.3} }
      * { box-sizing: border-box; }
      textarea::placeholder { color: #5A5856; }
      textarea:focus { outline: none !important; border-color: #E2C044 !important; box-shadow: 0 0 0 3px #E2C04418 !important; }
      button { font-family: 'Open Sans', sans-serif; }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const i = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);
    return () => clearInterval(i);
  }, [loading]);

  async function analyze() {
    if (!script.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Call Type: ${callType}\n\nScript:\n${script}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setResult(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch {
      setError("Analysis failed. Please try again.");
    }
    setLoading(false);
  }

  const canRun = !loading && script.trim().length > 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Open Sans', sans-serif", color: C.textPrimary, padding: "36px 20px" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, animation: "fadeUp 0.5s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold }} />
            <span style={{ fontSize: 10, color: C.gold, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
              Voice UX Auditor
            </span>
          </div>
          <h1 style={{ margin: "0 0 12px", fontSize: 34, fontWeight: 700, color: C.white, lineHeight: 1.2 }}>
            Is your voice agent<br />
            <span style={{ color: C.gold }}>losing callers?</span>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textPrimary, lineHeight: 1.75, maxWidth: 480 }}>
            Paste your script or describe your call flow. Get a UX audit covering friction points, clarity issues, and drop-off risks in seconds.
          </p>
        </div>

        {/* Input Panel */}
        <Panel style={{ animation: "fadeUp 0.5s ease 0.08s both" }}>
          {/* Call Type */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 10, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 10 }}>
              Call Type
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CALL_TYPES.map(t => (
                <button key={t} onClick={() => setCallType(t)} style={{
                  fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                  border: callType === t ? `1.5px solid ${C.gold}` : `1.5px solid ${C.border}`,
                  background: callType === t ? C.goldDim : "transparent",
                  color: callType === t ? C.gold : C.textPrimary,
                  fontWeight: callType === t ? 600 : 400,
                  transition: "all 0.15s"
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label style={{ fontSize: 10, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 10 }}>
              Script or Call Flow Description
            </label>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              placeholder={`Paste your voice agent script here...\n\nExample: "Thank you for calling. To continue in English, press 1. For billing, press 2..."`}
              rows={8}
              style={{
                width: "100%",
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                borderRadius: 8, color: C.textPrimary,
                fontSize: 13, lineHeight: 1.75,
                padding: 14, resize: "vertical",
                fontFamily: "'Open Sans', sans-serif",
                transition: "border-color 0.2s, box-shadow 0.2s"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>{script.length} chars</span>
              <button
                onClick={analyze}
                disabled={!canRun}
                style={{
                  background: canRun ? C.gold : "#393E41",
                  color: canRun ? "#1E2019" : "#9A9894",
                  border: "none", borderRadius: 8,
                  padding: "10px 28px", fontSize: 13, fontWeight: 700,
                  cursor: canRun ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 8
                }}
              >
                {loading
                  ? <><span style={{ animation: "pulse 1s infinite" }}>●</span> Analyzing{dots}</>
                  : "Run UX Audit →"}
              </button>
            </div>
          </div>
        </Panel>

        {/* Error */}
        {error && (
          <div style={{ background: "#C0504A18", border: "1px solid #C0504A55", borderRadius: 8, padding: 14, marginBottom: 12, color: "#E07570", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>

            {/* Score + Summary */}
            <Panel style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 24, alignItems: "center" }}>
              <ScoreMeter score={result.overall_score} />
              <div>
                <span style={{
                  display: "inline-block", background: C.goldDim,
                  color: C.gold, border: `1px solid ${C.gold}44`,
                  fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
                  fontWeight: 700, padding: "3px 10px", borderRadius: 4, marginBottom: 10
                }}>{result.score_label}</span>
                <p style={{ margin: 0, fontSize: 14, color: C.textPrimary, lineHeight: 1.75 }}>{result.summary}</p>
              </div>
            </Panel>

            {/* Wins + Quick Wins */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {result.wins?.length > 0 && (
                <Panel style={{ margin: 0 }}>
                  <SectionLabel title="What's Working" icon="✓" accent="#6BAF8A" />
                  {result.wins.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: C.textPrimary, lineHeight: 1.6 }}>
                      <span style={{ color: "#6BAF8A", fontWeight: 700, flexShrink: 0 }}>+</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </Panel>
              )}
              {result.quick_wins?.length > 0 && (
                <Panel style={{ margin: 0 }}>
                  <SectionLabel title="Quick Wins" icon="⚡" accent={C.gold} />
                  {result.quick_wins.map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: C.textPrimary, lineHeight: 1.6 }}>
                      <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0 }}>→</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </Panel>
              )}
            </div>

            {/* Friction Points */}
            {result.friction_points?.length > 0 && (
              <Panel>
                <SectionLabel title="Friction Points" icon="⚠" accent={C.gold} />
                {result.friction_points.map((f, i) => (
                  <Card key={i} leftColor={C.gold}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.white, marginRight: 10 }}>{f.issue}</span>
                      <SeverityBadge level={f.severity} />
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: C.textPrimary, lineHeight: 1.65 }}>
                      <span style={{ color: C.gold, fontWeight: 600 }}>Fix: </span>{f.recommendation}
                    </p>
                  </Card>
                ))}
              </Panel>
            )}

            {/* Clarity Issues */}
            {result.clarity_issues?.length > 0 && (
              <Panel>
                <SectionLabel title="Clarity Issues" icon="◎" accent={C.blue} />
                {result.clarity_issues.map((c, i) => (
                  <Card key={i} leftColor={C.blue}>
                    <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: C.white }}>{c.issue}</p>
                    {c.example && (
                      <div style={{
                        background: C.bg, border: `1px solid ${C.border}`,
                        borderLeft: `2px solid ${C.blue}`,
                        borderRadius: 6, padding: "7px 12px", marginBottom: 8,
                        fontSize: 12, color: C.textSub, fontStyle: "italic"
                      }}>"{c.example}"</div>
                    )}
                    <p style={{ margin: 0, fontSize: 12, color: C.textPrimary, lineHeight: 1.65 }}>
                      <span style={{ color: "#7AAAB0", fontWeight: 600 }}>Rewrite: </span>{c.fix}
                    </p>
                  </Card>
                ))}
              </Panel>
            )}

            {/* Drop-off Risks */}
            {result.dropoff_risks?.length > 0 && (
              <Panel>
                <SectionLabel title="Drop-off Risks" icon="↘" accent="#E07570" />
                {result.dropoff_risks.map((d, i) => (
                  <Card key={i} leftColor="#C0504A">
                    <div style={{ fontSize: 9, color: "#E07570", marginBottom: 5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{d.moment}</div>
                    <p style={{ margin: "0 0 6px", fontSize: 13, color: C.white }}>{d.reason}</p>
                    <p style={{ margin: 0, fontSize: 12, color: C.textPrimary, lineHeight: 1.65 }}>
                      <span style={{ color: "#E07570", fontWeight: 600 }}>Mitigation: </span>{d.mitigation}
                    </p>
                  </Card>
                ))}
              </Panel>
            )}

            <div style={{ textAlign: "center", paddingTop: 4, paddingBottom: 8 }}>
              <button
                onClick={() => { setResult(null); setScript(""); }}
                style={{
                  background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.textMuted, fontSize: 12,
                  padding: "8px 22px", cursor: "pointer", letterSpacing: "0.04em",
                  transition: "all 0.15s"
                }}
              >← Audit Another Script</button>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 40, fontSize: 11, color: C.textMuted, letterSpacing: "0.04em" }}>
          Built by Sarah Khan · sarahkhan.co
        </div>
      </div>
    </div>
  );
}
