import "./sites-env.mjs";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { localRuntimeArgs, localStatePath } from "./local-state.mjs";

const [command, ...args] = process.argv.slice(2);
try {
  const statePath = localStatePath();
  const cliArgs = localRuntimeArgs(command, args, statePath);
  if (
    command === "start" &&
    !existsSync(new URL("../dist/server/wrangler.json", import.meta.url))
  ) {
    throw new Error(
      "Build output is missing. Run npm run build before npm start.",
    );
  }
  const cli = new URL(
    "../node_modules/wrangler/bin/wrangler.js",
    import.meta.url,
  );
  if (!existsSync(cli))
    throw new Error("Dependencies are missing. Run npm ci first.");
  console.log(`TeamVibe local data: ${statePath}`);
  const child = spawn(process.execPath, [fileURLToPath(cli), ...cliArgs], {
    stdio: "inherit",
  });
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", terminate);
  process.exitCode = code ?? 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
