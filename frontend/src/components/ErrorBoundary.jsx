import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("RADIX Application Uncaught Error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#020813",
          color: "#f8fafc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
          textAlign: "center"
        }}>
          <div style={{
            background: "#091322",
            border: "1px solid #1e3a5f",
            borderRadius: "16px",
            padding: "36px 40px",
            maxWidth: "520px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
          }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              fontSize: "24px",
              marginBottom: "16px"
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: "700", marginBottom: "8px", color: "#ffffff" }}>
              RADIX Clinical Session Interrupted
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: "1.5", marginBottom: "20px" }}>
              A runtime interface error occurred. Clinical data remains safely preserved on the server.
            </p>
            {this.state.error && (
              <div style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "0.75rem",
                color: "#f87171",
                fontFamily: "monospace",
                textAlign: "left",
                marginBottom: "24px",
                overflowX: "auto"
              }}>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={this.handleReload}
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Reload RADIX Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;