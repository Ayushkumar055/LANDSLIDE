import { NATIONAL_HELPLINES, NER_STATE_HELPLINES } from "./emergencyContacts";

export default function EmergencyDialGrid({ selectedState = "Mizoram", onClose }) {
  const stateData = NER_STATE_HELPLINES[selectedState] || NER_STATE_HELPLINES["Mizoram"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 8, 14, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "520px",
          maxWidth: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#0d1420",
          border: "1px solid rgba(255, 48, 79, 0.35)",
          borderRadius: "14px",
          padding: "22px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>📞</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", color: "#ff5066" }}>Emergency Quick Dial Relay</h3>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#7f91a8" }}>
                Instant one-tap calling for disaster rescue & medical evacuation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              color: "#94a3b8",
              fontSize: "16px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* State-Specific Direct Operations */}
        <div
          style={{
            padding: "14px",
            borderRadius: "10px",
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <strong style={{ fontSize: "12px", color: "#38bdf8" }}>
              📍 Local Station Control: {selectedState.toUpperCase()}
            </strong>
            <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "10px", background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: "bold" }}>
              ● RELAY READY
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            <a
              href={`tel:${stateData.sdma}`}
              style={{
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                padding: "10px",
                borderRadius: "8px",
                background: "#080c14",
                border: "1px solid rgba(56,189,248,0.2)",
              }}
            >
              <small style={{ color: "#7f91a8", fontSize: "10px" }}>State SDMA Control</small>
              <strong style={{ color: "#38bdf8", fontSize: "14px", margin: "4px 0" }}>{stateData.sdma}</strong>
              <span style={{ fontSize: "9px", color: "#22c55e", fontWeight: "bold" }}>Tap to Call 📞</span>
            </a>

            <a
              href={`tel:${stateData.deoc}`}
              style={{
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                padding: "10px",
                borderRadius: "8px",
                background: "#080c14",
                border: "1px solid rgba(245,158,11,0.25)",
              }}
            >
              <small style={{ color: "#7f91a8", fontSize: "10px" }}>District DEOC</small>
              <strong style={{ color: "#f59e0b", fontSize: "14px", margin: "4px 0" }}>{stateData.deoc}</strong>
              <span style={{ fontSize: "9px", color: "#22c55e", fontWeight: "bold" }}>Toll-Free Dial 📞</span>
            </a>
          </div>
        </div>

        {/* National 24x7 Helplines Grid */}
        <div style={{ marginBottom: "14px" }}>
          <span style={{ fontSize: "11px", fontWeight: "bold", color: "#7f91a8", letterSpacing: "0.5px" }}>
            NATIONAL DISASTER RESCUE LINES
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
          {NATIONAL_HELPLINES.map((item) => (
            <a
              key={item.number}
              href={`tel:${item.number}`}
              style={{
                textDecoration: "none",
                padding: "12px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${item.color}33`,
                borderLeft: `4px solid ${item.color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "background 0.2s",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{item.icon}</span>
                  <strong style={{ fontSize: "12px", color: "#e2e8f0" }}>{item.name}</strong>
                </div>
                <div style={{ fontSize: "10px", color: "#7f91a8", marginTop: "3px" }}>{item.role}</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: item.color, marginTop: "6px" }}>
                  {item.number}
                </div>
              </div>

              <div
                style={{
                  background: `${item.color}18`,
                  border: `1px solid ${item.color}44`,
                  color: item.color,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: "bold",
                }}
              >
                CALL 📞
              </div>
            </a>
          ))}
        </div>

        <p style={{ margin: "18px 0 0", fontSize: "10px", color: "#5d6873", textAlign: "center" }}>
          ℹ️ Tapping any card opens your mobile phone dialer immediately without requiring cellular data.
        </p>
      </div>
    </div>
  );
}