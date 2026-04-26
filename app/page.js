import Link from "next/link";

const features = [
  {
    icon: "🧠",
    title: "AI-Powered OCR",
    description:
      "Real-time confidence scoring on every scanned field report. Low-confidence submissions are automatically flagged for human review.",
    accent: "from-violet-600/20 to-indigo-600/10",
    border: "border-violet-500/20",
    iconBg: "bg-violet-500/10",
  },
  {
    icon: "📡",
    title: "Offline-First Mobile",
    description:
      "Field workers submit reports without internet. The app queues them locally and syncs the moment connectivity returns.",
    accent: "from-sky-600/20 to-cyan-600/10",
    border: "border-sky-500/20",
    iconBg: "bg-sky-500/10",
  },
  {
    icon: "⚡",
    title: "Real-Time Dashboard",
    description:
      "Approve or reject incoming reports from a unified admin panel with live polling, tab-based filtering, and audit trails.",
    accent: "from-emerald-600/20 to-teal-600/10",
    border: "border-emerald-500/20",
    iconBg: "bg-emerald-500/10",
  },
];

const stats = [
  { value: "99.2%", label: "OCR Accuracy" },
  { value: "<2 s",  label: "Avg. Sync Time" },
  { value: "4",     label: "Report Categories" },
  { value: "∞",     label: "Offline Queue" },
];

export default function Home() {
  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-[#080b14]">

      {/* ── Ambient background orbs ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 animate-fade-in"
      >
        {/* Top-left violet orb */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "-8%",
            width: "55vw",
            height: "55vw",
            maxWidth: 700,
            maxHeight: 700,
            background:
              "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />
        {/* Bottom-right cyan orb */}
        <div
          style={{
            position: "absolute",
            bottom: "-15%",
            right: "-10%",
            width: "50vw",
            height: "50vw",
            maxWidth: 650,
            maxHeight: 650,
            background:
              "radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />
        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <nav className="relative z-10 flex items-center justify-end px-6 py-5 sm:px-10 lg:px-16 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link
            href="/submit"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Submit Report
          </Link>
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white pulse-glow"
            style={{
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              border: "1px solid rgba(99,102,241,0.6)",
            }}
          >
            Dashboard →
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-10 sm:pt-28 lg:pt-36">

        <div
          className="animate-fade-up mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest uppercase"
          style={{
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#a5b4fc",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#6366f1",
              display: "inline-block",
              boxShadow: "0 0 6px 2px rgba(99,102,241,0.7)",
            }}
          />
          Ground-level Survey &amp; Operations Layer
        </div>

        <h1
          className="animate-fade-up-delay-1 text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight text-white max-w-4xl"
        >
          Field intelligence,{" "}
          <span className="shimmer-text">at the speed</span>
          <br className="hidden sm:block" /> of the ground.
        </h1>

        <p
          className="animate-fade-up-delay-2 mt-6 max-w-xl text-base sm:text-lg leading-relaxed"
          style={{ color: "#94a3b8" }}
        >
          GSOL aggregates citizen and survey reports from any channel — mobile,
          WhatsApp, or paper — validates them with AI-powered OCR, and surfaces
          actionable insights to field operation teams in real time.
        </p>

        <div className="animate-fade-up-delay-3 mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/admin/reports"
            id="cta-dashboard"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-100"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              boxShadow: "0 0 24px rgba(99,102,241,0.4)",
            }}
          >
            Open Admin Dashboard
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/submit"
            id="cta-submit"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold transition-all hover:scale-105 active:scale-100"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#e2e8f0",
            }}
          >
            Submit a Field Report
          </Link>
        </div>
      </main>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <section
        aria-label="Key metrics"
        className="relative z-10 mx-6 sm:mx-10 lg:mx-16 mt-14 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <ul className="grid grid-cols-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <li
              key={s.label}
              className="flex flex-col items-center py-7 px-4 gap-1"
              style={{
                borderRight:
                  i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <span
                className="text-3xl font-black tracking-tight"
                style={{ color: "#a5b4fc" }}
              >
                {s.value}
              </span>
              <span className="text-xs font-medium" style={{ color: "#64748b" }}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────── */}
      <section
        aria-labelledby="features-heading"
        className="relative z-10 px-6 sm:px-10 lg:px-16 mt-16 pb-20"
      >
        <h2
          id="features-heading"
          className="text-center text-xs font-bold uppercase tracking-widest mb-10"
          style={{ color: "#475569" }}
        >
          Platform Capabilities
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f) => (
            <article
              key={f.title}
              className="group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: `linear-gradient(145deg, ${f.accent.replace("from-", "").replace(" to-", ", ")})`,
                border: `1px solid`,
                borderColor: f.border.replace("border-", "").replace("/20", ""),
              }}
            >
              <div
                className={`mb-4 w-11 h-11 rounded-xl flex items-center justify-center text-xl ${f.iconBg}`}
              >
                {f.icon}
              </div>
              <h3 className="font-bold text-white mb-2 text-base">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                {f.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 border-t flex items-center justify-between px-6 sm:px-10 lg:px-16 py-5 text-xs"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "#475569" }}
      >
        <span className="font-bold tracking-tight text-slate-500">GSOL</span>
        <span>Ground-level Survey &amp; Operations Layer · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

