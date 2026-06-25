import { useEffect, useState } from "react";

const GUIDE_KEY = "tm-admin-layout-guide-open";

export function AdminLayoutGuide() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(GUIDE_KEY) !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <details
      className="admin-layout-guide mb-5 rounded-lg border border-white/10 bg-[#0e0e14] px-4 py-3"
      open={open}
      onToggle={(e) => {
        const isOpen = (e.target as HTMLDetailsElement).open;
        setOpen(isOpen);
        try {
          localStorage.setItem(GUIDE_KEY, isOpen ? "1" : "0");
        } catch {
          /* ignore */
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold text-zinc-200">
        Form layout guide — field sizes & screen widths
      </summary>
      <div className="mt-3 space-y-3 text-sm text-zinc-400">
        <p>
          Forms stay in a <strong className="text-zinc-300">centered column</strong> so fields are not edge-to-edge on
          large monitors. On viewports <strong className="text-zinc-300">1500px and wider</strong>, pages set to
          two-column layout place section cards side by side.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li className="flex flex-wrap items-center gap-2">
            <span className="admin-size-badge admin-size-badge--short">Short</span>
            <span>One line — initials, badges</span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="admin-size-badge admin-size-badge--medium">Medium</span>
            <span>Titles, names, URLs</span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="admin-size-badge admin-size-badge--long">Long</span>
            <span>Taglines, descriptions, stories</span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span className="admin-size-badge admin-size-badge--full">Full width</span>
            <span>Uploads, social rows, lists</span>
          </li>
        </ul>
      </div>
    </details>
  );
}
