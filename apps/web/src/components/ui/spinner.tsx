import { Loader2 } from "lucide-react";

import { cx } from "./variants";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cx("size-4 shrink-0 animate-spin", className)} />;
}
