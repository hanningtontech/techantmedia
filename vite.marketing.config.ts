import path from "node:path";
import fs from "node:fs";
import { mergeConfig, defineConfig, type Plugin } from "vite";
import base from "./vite.config";

function vitePluginMarketingIndex(): Plugin {
  return {
    name: "marketing-index-html",
    apply: "build",
    closeBundle() {
      const dir = path.resolve(import.meta.dirname, "dist", "marketing");
      const from = path.join(dir, "marketing.html");
      const to = path.join(dir, "index.html");
      if (fs.existsSync(from)) fs.renameSync(from, to);
    },
  };
}

/** Unified techantmedia.com site — all public and private routes in one bundle. */
export default mergeConfig(
  base,
  defineConfig({
    define: {
      "import.meta.env.VITE_HOSTING_TARGET": JSON.stringify("marketing"),
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist", "marketing"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        input: path.resolve(import.meta.dirname, "client", "marketing.html"),
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("firebase")) return "firebase";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("mammoth")) return "mammoth";
            if (id.includes("tesseract")) return "tesseract";
            if (id.includes("exceljs")) return "exceljs";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("lucide-react")) return "icons";
          },
        },
      },
    },
    plugins: [
      ...(base.plugins?.filter((p) => {
        const name = typeof p === "object" && p && "name" in p ? String(p.name) : "";
        return name !== "app-robots-txt";
      }) ?? []),
      vitePluginMarketingIndex(),
    ],
  }),
);
