import { cpSync, rmSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(functionsDir, "..");
const sourceDir = path.resolve(repoRoot, "server");
const destDir = path.resolve(functionsDir, "server");

function shouldSkip(entryPath) {
  const normalized = entryPath.replace(/\\/g, "/");
  return (
    normalized.includes("/node_modules") ||
    normalized.includes("/.git") ||
    normalized.endsWith("/package-lock.json") ||
    normalized.includes("/coverage/") ||
    normalized.includes("/.cache/") ||
    normalized.includes("/.firebase/")
  );
}

function copyDirectory() {
  try {
    const stats = statSync(sourceDir);
    if (!stats.isDirectory()) {
      throw new Error("server directory not found");
    }
  } catch (err) {
    console.error("[copy-server] unable to locate server directory:", err);
    process.exit(1);
  }

  rmSync(destDir, { force: true, recursive: true });
  cpSync(sourceDir, destDir, {
    recursive: true,
    force: true,
    filter: (src) => !shouldSkip(src),
  });
  console.log("[copy-server] copied server/ into functions/server");
}

copyDirectory();
