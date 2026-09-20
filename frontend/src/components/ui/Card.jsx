import React from "react";
import "./ui.css";

export const Card = ({
  children,
  variant = "elevated", // elevated | outlined | glass | dark
  className = "",
  ...props
}) => {
  return (
    <div className={`radix-card radix-card-${variant} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = "", ...props }) => (
  <div className={`radix-card-header ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = "", ...props }) => (
  <h3 className={`radix-card-title ${className}`.trim()} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = "", ...props }) => (
  <p className={`radix-card-description ${className}`.trim()} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className = "", ...props }) => (
  <div className={`radix-card-content ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = "", ...props }) => (
  <div className={`radix-card-footer ${className}`.trim()} {...props}>
    {children}
  </div>
);

export default Card;
