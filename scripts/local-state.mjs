import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export function localStatePath(value = process.env.TEAMVIBE_STATE_PATH) {
  if (value !== undefined && !value.trim()) {
    throw new Error("TEAMVIBE_STATE_PATH must be a non-empty directory path.");
  }
  return path.resolve(root, value ?? ".wrangler/state");
}

export function localRuntimeArgs(
  command,
  args = [],
  statePath = localStatePath(),
) {
  if (command === "db:init") {
    if (args.length)
      throw new Error(
        "db:init does not accept extra arguments. Use TEAMVIBE_STATE_PATH to select local data.",
      );
    return [
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      "wrangler.local.json",
      "--persist-to",
      statePath,
    ];
  }
  if (command !== "start") throw new Error("Expected db:init or start.");
  let port = "8787";
  if (args.length === 2 && args[0] === "--port") port = args[1];
  else if (args.length === 1 && args[0].startsWith("--port="))
    port = args[0].slice(7);
  else if (args.length)
    throw new Error(
      "Supported option: npm start -- --port 8787. This launcher uses local resources only.",
    );
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
    throw new Error("Port must be an integer between 1024 and 65535.");
  }
  return [
    "dev",
    "--config",
    "dist/server/wrangler.json",
    "--local",
    "--persist-to",
    statePath,
    "--ip",
    "127.0.0.1",
    "--port",
    port,
    "--inspector-port",
    "0",
  ];
}
