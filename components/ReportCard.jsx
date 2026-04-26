"use client";

import React, { useCallback, useMemo, useState } from "react";

const REJECTION_PRESETS = [
  "Illegible handwriting / insufficient details",
  "Duplicate report",
  "Location unverifiable",
  "Image too blurry",
  "Outside service area",
];

export default function ReportCard({ report, onApprove, onReject }) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason]           = useState("");
  const [approving, setApproving]     = useState(false);
  const [rejecting, setRejecting]     = useState(false);

  // ── OCR confidence ────────────────────────────────────────────────────────
  const ocrPct = useMemo(() => {
    const raw = report?.ocrConfidence;
    if (raw == null) return null;
    const n = typeof raw === "string" ? Number(raw) : raw;
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(100, n <= 1 ? n * 100 : n));
  }, [report?.ocrConfidence]);

  const ocrColor =
    ocrPct == null ? "#64748b"
    : ocrPct < 60  ? "#ef4444"
    : ocrPct <= 80 ? "#f59e0b"
    : "#10b981";

  // ── Severity ──────────────────────────────────────────────────────────────
  const sev = (report?.severity || "").toLowerCase();
  const sevConfig =
    sev === "high"   ? { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "High" }
    : sev === "medium" ? { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Medium" }
    : sev === "low"    ? { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Low" }
    : { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: report?.severity || "—" };

  // ── Coordinates ───────────────────────────────────────────────────────────
  const coordsText = useMemo(() => {
    const { lat, lng } = report?.location || {};
    if (typeof lat !== "number" || typeof lng !== "number") return "—";
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }, [report?.location]);

  // ── Relative time ─────────────────────────────────────────────────────────
  const timeAgo = useMemo(() => {
    if (!report?.createdAt) return "—";
    const diff = (Date.now() - new Date(report.createdAt).getTime()) / 1000;
    if (diff < 60)   return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }, [report?.createdAt]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    setApproving(true);
    try { await onApprove?.(report.id); }
    finally { setApproving(false); }
  }, [onApprove, report?.id]);

  const handleRejectConfirm = useCallback(async () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setRejecting(true);
    try {
      await onReject?.(report.id, trimmed);
      setIsRejecting(false);
      setReason("");
    } finally { setRejecting(false); }
  }, [onReject, reason, report?.id]);

  const isPending = report?.status === "Pending";

  // ── Status badge (non-pending) ────────────────────────────────────────────
  const statusConfig = report?.status === "Approved"
    ? { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Approved", icon: "✓" }
    : { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Rejected", icon: "✕" };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
        e.currentTarget.style.boxShadow   = "0 0 0 1px rgba(99,102,241,0.1)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.boxShadow   = "none";
      }}
    >
      <div style={{ display: "flex", gap: 0 }}>

        {/* ── Thumbnail / no-image ── */}
        <div style={{ width: 100, flexShrink: 0, position: "relative", overflow: "hidden" }}>
          {report?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.thumbnailUrl}
              alt={report?.category ? `${report.category} thumbnail` : "Report"}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%", minHeight: 120,
              background: "rgba(255,255,255,0.03)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 6,
            }}>
              <span style={{ fontSize: 22, opacity: 0.3 }}>🖼</span>
              <span style={{ fontSize: 10, color: "#334155", fontWeight: 600 }}>No image</span>
            </div>
          )}
          {/* Severity stripe */}
          <div style={{
            position: "absolute", top: 0, left: 0, width: 3, height: "100%",
            background: sevConfig.color,
          }} />
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, padding: "16px 18px", minWidth: 0 }}>

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <span style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>
              {report?.category || "Uncategorized"}
            </span>

            {/* Severity */}
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: sevConfig.color, background: sevConfig.bg,
              border: `1px solid ${sevConfig.color}33`,
              borderRadius: 100, padding: "2px 9px",
            }}>
              {sevConfig.label}
            </span>

            {/* OCR confidence */}
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              color: ocrColor, background: `${ocrColor}18`,
              border: `1px solid ${ocrColor}33`,
              borderRadius: 100, padding: "2px 9px",
            }}
              title="OCR confidence score"
            >
              OCR {ocrPct == null ? "—" : `${Math.round(ocrPct)}%`}
            </span>

            {/* Time */}
            <span style={{
              marginLeft: "auto", fontSize: 11, color: "#334155", fontWeight: 500, flexShrink: 0,
            }}>
              {timeAgo}
            </span>
          </div>

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", marginBottom: 10 }}>
            {[
              { label: "Source",   value: report?.sourceChannel || "—" },
              { label: "Coords",   value: coordsText },
              { label: "Report ID",value: report?.id || "—" },
              { label: "Channel",  value: report?.sourceChannel || "—" },
            ].slice(0, 2).map(({ label, value }) => (
              <div key={label} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: "#334155", fontWeight: 600, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Coords full row */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: report?.notes ? 10 : 0 }}>
            <span style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>📍</span>
            <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{coordsText}</span>
          </div>

          {/* Notes */}
          {report?.notes && (
            <p style={{
              fontSize: 13, color: "#64748b", lineHeight: 1.55,
              margin: "10px 0 0",
              borderLeft: "2px solid rgba(99,102,241,0.3)",
              paddingLeft: 10,
            }}>
              {report.notes}
            </p>
          )}

          {/* Rejection reason (non-pending rejected) */}
          {report?.rejectionReason && !isPending && (
            <div style={{
              marginTop: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              color: "#fca5a5",
            }}>
              <span style={{ fontWeight: 700 }}>Reason: </span>{report.rejectionReason}
            </div>
          )}
        </div>

        {/* ── Actions panel ── */}
        <div style={{
          width: 176,
          flexShrink: 0,
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 8,
        }}>
          {isPending ? (
            !isRejecting ? (
              <>
                <button
                  type="button"
                  disabled={approving}
                  onClick={handleApprove}
                  style={{
                    width: "100%",
                    padding: "9px 0",
                    borderRadius: 10,
                    border: "1px solid rgba(16,185,129,0.4)",
                    background: "rgba(16,185,129,0.15)",
                    color: "#34d399",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: approving ? "not-allowed" : "pointer",
                    opacity: approving ? 0.6 : 1,
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  onMouseEnter={e => { if (!approving) { e.currentTarget.style.background = "rgba(16,185,129,0.25)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.6)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; }}
                >
                  {approving ? "…" : "✓ Approve"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsRejecting(true)}
                  style={{
                    width: "100%",
                    padding: "9px 0",
                    borderRadius: 10,
                    border: "1px solid rgba(239,68,68,0.4)",
                    background: "rgba(239,68,68,0.1)",
                    color: "#f87171",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; }}
                >
                  ✕ Reject
                </button>
              </>
            ) : (
              /* ── Rejection flow ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Reason
                </label>

                {/* Presets */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflowY: "auto" }}>
                  {REJECTION_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReason(p)}
                      style={{
                        textAlign: "left",
                        background: reason === p ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                        border: reason === p ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 7,
                        padding: "5px 8px",
                        fontSize: 10,
                        color: reason === p ? "#fca5a5" : "#64748b",
                        cursor: "pointer",
                        lineHeight: 1.4,
                        transition: "all 0.15s",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Or type a reason…"
                  rows={2}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: "6px 8px",
                    fontSize: 11,
                    color: "#cbd5e1",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    disabled={!reason.trim() || rejecting}
                    onClick={handleRejectConfirm}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      border: "1px solid rgba(239,68,68,0.4)",
                      background: "rgba(239,68,68,0.15)",
                      color: "#f87171",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: !reason.trim() || rejecting ? "not-allowed" : "pointer",
                      opacity: !reason.trim() || rejecting ? 0.5 : 1,
                      transition: "all 0.2s",
                    }}
                  >
                    {rejecting ? "…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsRejecting(false); setReason(""); }}
                    style={{
                      flex: 1,
                      padding: "7px 0",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#475569",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ── Non-pending status badge ── */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: statusConfig.bg,
                border: `1px solid ${statusConfig.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, color: statusConfig.color,
              }}>
                {statusConfig.icon}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: statusConfig.color,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}>
                {statusConfig.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
