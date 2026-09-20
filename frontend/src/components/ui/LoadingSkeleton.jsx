import React from "react";

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

export function TableRowSkeleton({ _columns = 8, rows = 5 }) {
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

