import React from "react";
import "./LoadingSkeleton.css";

export function Skeleton({ width, height, circle, className = "", style = {} }) {
  const inlineStyle = {
    width: width || "100%",
    height: height || "16px",
    ...(circle ? { borderRadius: "50%" } : {}),
    ...style,
  };

  return (
    <div
      className={`radix-skeleton ${circle ? "radix-skeleton-circle" : ""} ${className}`.trim()}
      style={inlineStyle}
    />
  );
}

export function TableRowSkeleton({ rows = 5 }) {
  return (
    <div className="radix-table-skeleton" style={{ width: "100%" }}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="radix-skeleton-table-row">
          <Skeleton width="18px" height="18px" />
          <Skeleton width="80px" height="14px" />
          <Skeleton width="90px" height="14px" />
          <Skeleton width="50px" height="14px" />
          <Skeleton width="60px" height="18px" style={{ borderRadius: "12px" }} />
          <Skeleton width="70px" height="14px" />
          <Skeleton width="65px" height="14px" />
          <Skeleton width="65px" height="18px" style={{ borderRadius: "12px" }} />
          <Skeleton width="45px" height="14px" />
          <Skeleton width="120px" height="14px" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonRows({ rows = 5, columns = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="radix-table-shimmer-row">
          <td style={{ padding: "12px 14px", width: "36px" }}>
            <Skeleton width="16px" height="16px" style={{ borderRadius: "4px" }} />
          </td>
          <td style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Skeleton width="34px" height="34px" style={{ borderRadius: "6px", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "130px" }}>
                <Skeleton width="110px" height="13px" />
                <Skeleton width="75px" height="10px" />
              </div>
            </div>
          </td>
          <td style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <Skeleton width="75px" height="13px" />
              <Skeleton width="55px" height="10px" />
            </div>
          </td>
          <td style={{ padding: "12px 14px" }}>
            <Skeleton width="64px" height="22px" style={{ borderRadius: "12px" }} />
          </td>
          <td style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Skeleton width="38px" height="13px" />
              <Skeleton width="50px" height="6px" style={{ borderRadius: "3px" }} />
            </div>
          </td>
          <td style={{ padding: "12px 14px" }}>
            <Skeleton width="65px" height="12px" />
          </td>
          <td style={{ padding: "12px 14px" }}>
            <Skeleton width="140px" height="13px" />
          </td>
          {columns >= 8 && (
            <td style={{ padding: "12px 14px", textAlign: "right" }}>
              <Skeleton width="60px" height="26px" style={{ borderRadius: "6px", marginLeft: "auto" }} />
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

export function CardSkeleton({ count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="radix-skeleton-card">
          <Skeleton width="40%" height="12px" />
          <Skeleton width="60%" height="24px" style={{ margin: "4px 0" }} />
          <Skeleton width="80%" height="10px" />
        </div>
      ))}
    </>
  );
}

export default Skeleton;
