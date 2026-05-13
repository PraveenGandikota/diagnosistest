import type { ReactNode } from "react";

export const ResponsiveTableWrapper = ({ children }: { children: ReactNode }) => (
  <div className="panel overflow-hidden">
    <div className="-mx-px overflow-x-auto">{children}</div>
  </div>
);
