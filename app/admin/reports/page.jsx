"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReportCard from "../../../components/ReportCard";

// ── Mock API ─────────────────────────────────────────────────────────────────
const mockApi = (() => {
  const seed = [
    {
      id: "rpt_1001",
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      status: "Pending",
      category: "Pothole",
      severity: "High",
      sourceChannel: "WhatsApp",
      thumbnailUrl: null,
      location: { lat: 19.076, lng: 72.8777 },
      ocrConfidence: 0.57,
      notes: "Large pothole near the main junction; causing frequent near-misses.",
      rejectionReason: null,
    },
    {
      id: "rpt_1002",
      createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      status: "Pending",
      category: "Water Leak",
      severity: "Medium",
      sourceChannel: "Paper Survey",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=400&q=60",
      location: { lat: 18.5204, lng: 73.8567 },
      ocrConfidence: 0.78,
      notes: "Leak observed for 3 days; water pooling on sidewalk.",
      rejectionReason: null,
    },
    {
      id: "rpt_0999",
      createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
      status: "Approved",
      category: "Streetlight Out",
      severity: "Low",
      sourceChannel: "WhatsApp",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1504222490345-c075b6008014?auto=format&fit=crop&w=400&q=60",
      location: { lat: 12.9716, lng: 77.5946 },
      ocrConfidence: 0.91,
      notes: "Streetlight not working since last week.",
      rejectionReason: null,
    },
    {
      id: "rpt_0998",
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      status: "Rejected",
      category: "Garbage",
      severity: "Medium",
      sourceChannel: "Paper Survey",
      thumbnailUrl: null,
      location: { lat: 22.5726, lng: 88.3639 },
      ocrConfidence: 0.49,
      notes: "Handwriting is unclear; location ambiguous.",
      rejectionReason: "Illegible handwriting / insufficient details",
    },
  ];

  let store = [...seed];
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  return {
    async getReports(filter) {
      await delay(450);
      const f = filter || "Pending";
      return store.filter((r) => r.status === f).map((r) => ({ ...r }));
    },
    async getAllCounts() {
      await delay(100);
      return {
        Pending:  store.filter((r) => r.status === "Pending").length,
        Approved: store.filter((r) => r.status === "Approved").length,
        Rejected: store.filter((r) => r.status === "Rejected").length,
      };
    },
    async approveReport(id) {
      await delay(300);
      store = store.map((r) =>
        r.id === id ? { ...r, status: "Approved", rejectionReason: null } : r
      );
      return { ok: true };
    },
    async rejectReport(id, reason) {
      await delay(350);
      store = store.map((r) =>
        r.id === id ? { ...r, status: "Rejected", rejectionReason: reason || "No reason provided" } : r
      );
      return { ok: true };
    },
  };
})();

const TABS = [
  { key: "Pending",  label: "Pending",  color: "#f59e0b" },
  { key: "Approved", label: "Approved", color: "#10b981" },
  { key: "Rejected", label: "Rejected", color: "#ef4444" },
];

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "2px solid rgba(99,102,241,0.3)",
        borderTopColor: "#6366f1",
        animation: "spin 0.7s linear infinite",
      }}
      aria-label="Loading"
    />
  );
}

export default function AdminReportsPage() {
  const [reports, setReports]         = useState([]);
  const [counts, setCounts]           = useState({ Pending: 0, Approved: 0, Rejected: 0 });
  const [filter, setFilter]           = useState("Pending");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [minsAgo, setMinsAgo]         = useState(0);
  const [loading, setLoading]         = useState(true);
  const [isFetching, setIsFetching]   = useState(false);

  const initialFetchDoneRef = useRef(false);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [reports]
  );

  const computeMinsAgo = useCallback(
    (ms) => (ms ? Math.max(0, Math.floor((Date.now() - ms) / 60000)) : 0),
    []
  );

  const refreshCounts = useCallback(async () => {
    const c = await mockApi.getAllCounts();
    setCounts(c);
  }, []);

  const fetchReports = useCallback(
    async ({ showFullSpinner } = {}) => {
      if (showFullSpinner) setLoading(true);
      setIsFetching(true);
      try {
        const data = await mockApi.getReports(filter);
        data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setReports(data);
        const now = Date.now();
        setLastUpdated(now);
        setMinsAgo(computeMinsAgo(now));
        await refreshCounts();
      } finally {
        setIsFetching(false);
        if (showFullSpinner) setLoading(false);
      }
    },
    [computeMinsAgo, filter, refreshCounts]
  );

  useEffect(() => {
    const first = !initialFetchDoneRef.current;
    initialFetchDoneRef.current = true;
    fetchReports({ showFullSpinner: first });
  }, [filter, fetchReports]);

  useEffect(() => {
    const id = setInterval(() => fetchReports(), 60000);
    return () => clearInterval(id);
  }, [fetchReports]);

  useEffect(() => {
    const id = setInterval(() => setMinsAgo(computeMinsAgo(lastUpdated)), 10000);
    return () => clearInterval(id);
  }, [computeMinsAgo, lastUpdated]);

  const handleApprove = useCallback(
    async (id) => {
      await mockApi.approveReport(id);
      setReports((prev) =>
        filter === "Pending" ? prev.filter((r) => r.id !== id) : prev.map((r) => r.id === id ? { ...r, status: "Approved", rejectionReason: null } : r)
      );
      await refreshCounts();
    },
    [filter, refreshCounts]
  );

  const handleReject = useCallback(
    async (id, reason) => {
      await mockApi.rejectReport(id, reason);
      setReports((prev) =>
        filter === "Pending" ? prev.filter((r) => r.id !== id) : prev.map((r) => r.id === id ? { ...r, status: "Rejected", rejectionReason: reason } : r)
      );
      await refreshCounts();
    },
    [filter, refreshCounts]
  );

  // ── Full-page loader ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#080b14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
      }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "3px solid rgba(99,102,241,0.2)",
          borderTopColor: "#6366f1",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ color: "#475569", fontSize: 14, fontWeight: 500 }}>Loading reports…</p>
      </div>
    );
  }

  const currentTab = TABS.find((t) => t.key === filter);

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", fontFamily: "var(--font-inter, system-ui, sans-serif)" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .report-row { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        .tab-btn { cursor: pointer; border: none; background: transparent; transition: all 0.2s; }
        .tab-btn:hover { opacity: 0.85; }
      `}</style>

      {/* ── Ambient orbs ── */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-5%", left: "-5%",
          width: "40vw", height: "40vw", maxWidth: 500, maxHeight: 500,
          background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%",
          width: "35vw", height: "35vw", maxWidth: 450, maxHeight: 450,
          background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
          borderRadius: "50%", filter: "blur(40px)",
        }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* ── Top bar ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#6366f1", textTransform: "uppercase" }}>GSOL</span>
              <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.12)" }} />
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Admin</span>
            </div>
            <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
              Field Reports
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 12, color: "#334155" }}>Updated {minsAgo} min{minsAgo !== 1 ? "s" : ""} ago</span>
              {isFetching && <Spinner />}
            </div>
          </div>

          {/* Count badges */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <div key={t.key} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: "10px 18px", minWidth: 64,
              }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: t.color, lineHeight: 1 }}>{counts[t.key]}</span>
                <span style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: 5,
        }}>
          {TABS.map((t) => {
            const active = t.key === filter;
            return (
              <button
                key={t.key}
                type="button"
                className="tab-btn"
                onClick={() => setFilter(t.key)}
                style={{
                  flex: 1,
                  padding: "9px 16px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 0.1,
                  color: active ? "#fff" : "#475569",
                  background: active
                    ? `linear-gradient(135deg, ${t.color}22, ${t.color}11)`
                    : "transparent",
                  border: active ? `1px solid ${t.color}44` : "1px solid transparent",
                  boxShadow: active ? `0 0 12px ${t.color}22` : "none",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: active ? t.color : "#334155",
                  boxShadow: active ? `0 0 6px ${t.color}` : "none",
                  display: "inline-block",
                  flexShrink: 0,
                }} />
                {t.label}
                {counts[t.key] > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: active ? t.color : "#334155",
                    background: active ? `${t.color}22` : "rgba(255,255,255,0.04)",
                    borderRadius: 100,
                    padding: "1px 7px",
                    letterSpacing: 0,
                  }}>
                    {counts[t.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Report list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedReports.length === 0 ? (
            <div style={{
              border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "52px 24px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>
                {filter === "Pending" ? "📭" : filter === "Approved" ? "✅" : "🚫"}
              </div>
              <p style={{ color: "#475569", fontSize: 14, fontWeight: 500 }}>
                No {filter.toLowerCase()} reports
              </p>
            </div>
          ) : (
            sortedReports.map((r, i) => (
              <div
                key={r.id}
                className="report-row"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <ReportCard report={r} onApprove={handleApprove} onReject={handleReject} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
