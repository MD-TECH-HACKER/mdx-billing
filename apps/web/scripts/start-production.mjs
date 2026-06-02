import { spawn } from "node:child_process";

const children = new Map();
let shuttingDown = false;

function startChild(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  children.set(name, child);
  child.on("exit", (code, signal) => {
    children.delete(name);
    if (shuttingDown) return;
    if (name === "web") {
      console.error(`Web server exited with ${signal || code || 0}.`);
      shutdown(code || 1);
      return;
    }
    console.error(`${name} process exited with ${signal || code || 0}.`);
  });
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children.values()) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 500).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

startChild("telegram-backup", ["scripts/telegram-backup.mjs", "--watch"]);
startChild("web", ["build/server/index.js"]);
