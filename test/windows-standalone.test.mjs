import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const serverPath = fileURLToPath(new URL("../server/index.mjs", import.meta.url));
const launcherSource = await readFile(new URL("../src-tauri/src/main.rs", import.meta.url), "utf8");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  if (!port) throw new Error("Could not reserve a loopback port");
  return port;
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "not attempted";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        const body = await response.json();
        if (body.status === "ok") return body;
        lastError = JSON.stringify(body);
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for Taskboard health on 127.0.0.1:${port}: ${lastError}`);
}

test("Windows standalone policy keeps the local service off the Codex injector path", () => {
  assert.match(launcherSource, /fn start_windows_standalone_locked/);
  assert.match(launcherSource, /wait_for_taskboard_ready\(taskboard_port, TASKBOARD_READY_TIMEOUT\)/);
  assert.match(launcherSource, /show_or_create_taskboard_window\(app, &taskboard_url\)/);
  assert.match(launcherSource, /write_runtime_descriptor\(state, pid, &taskboard_url\)/);
  assert.doesNotMatch(
    launcherSource,
    /fn start_windows_standalone_locked[\s\S]*?find_codex_app[\s\S]*?fn start_launcher_locked/,
  );
  assert.doesNotMatch(
    launcherSource,
    /fn start_windows_standalone_locked[\s\S]*?quit_codex_normally[\s\S]*?fn start_launcher_locked/,
  );
  assert.doesNotMatch(
    launcherSource,
    /fn start_windows_standalone_locked[\s\S]*?codex-injector\.mjs[\s\S]*?fn start_launcher_locked/,
  );
});

test("the standalone Taskboard service is ready on loopback and publishes a taskctl runtime", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-taskboard-windows-standalone-"));
  const port = await reservePort();
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      CODEX_TASKBOARD_DATA_DIR: directory,
      CODEX_TASKBOARD_HOST: "127.0.0.1",
      CODEX_TASKBOARD_PORT: String(port),
      CODEX_TASKBOARD_VERSION: "windows-standalone-test",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  try {
    const health = await waitForHealth(port, 10_000);
    assert.equal(health.status, "ok");
    const runtime = {
      version: 1,
      pid: child.pid,
      url: `http://127.0.0.1:${port}`,
    };
    const runtimeFile = path.join(directory, "launcher-runtime.json");
    await writeFile(runtimeFile, `${JSON.stringify(runtime)}\n`);
    const saved = JSON.parse(await readFile(runtimeFile, "utf8"));
    assert.equal(saved.version, 1);
    assert.equal(saved.pid, child.pid);
    assert.equal(saved.url, `http://127.0.0.1:${port}`);
    assert.match(output.join(""), /Codex Taskboard listening on http:\/\/127\.0\.0\.1:/);
  } finally {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      wait(3_000),
    ]);
    await rm(directory, { recursive: true, force: true });
  }
});
