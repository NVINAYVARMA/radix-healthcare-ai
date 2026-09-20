import React from "react";
import { Inbox } from "lucide-react";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "No records found",
  description = "There are currently no items matching the specified criteria.",
  action = null,
  secondaryAction = null,
  compact = false,
  className = "",
}) {
  return (
    <div className={`radix-empty-state ${compact ? "compact" : ""} ${className}`.trim()}>
      <div className="radix-empty-icon-wrapper">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h4 className="radix-empty-title">{title}</h4>
      {description && <p className="radix-empty-desc">{description}</p>}
      {(action || secondaryAction) && (
        <div className="radix-empty-actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
