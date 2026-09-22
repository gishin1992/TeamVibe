// Local browser verification helper. Never contacts an external service.
import http from "node:http";
import { writeFileSync } from "node:fs";
const upstream = "http://localhost:5174";
let hold = false;
let sequence = 0;
const held = [];
const events = [];
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/__refresh-test/")) {
      if (req.method !== "POST" && req.url !== "/__refresh-test/status") {
        res.writeHead(405);
        res.end();
        return;
      }
      if (req.url.endsWith("/hold")) hold = true;
      if (req.url.endsWith("/release-oldest")) {
        const entry = held.shift();
        if (entry) {
          events.push({
            action: "release",
            id: entry.id,
            at: new Date().toISOString(),
          });
          entry.send();
        }
      }
      if (req.url.endsWith("/release-all")) {
        hold = false;
        while (held.length) held.shift().send();
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          hold,
          held: held.map((x) => ({ id: x.id, projectVersions: x.versions })),
          events,
        }),
      );
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];
    if (headers.origin) headers.origin = upstream;
    const response = await fetch(upstream + req.url, {
      method: req.method,
      headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
      redirect: "manual",
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const outputHeaders = Object.fromEntries(response.headers);
    delete outputHeaders["content-encoding"];
    delete outputHeaders["transfer-encoding"];
    delete outputHeaders["content-length"];
    const send = () => {
      if (!res.destroyed) {
        res.writeHead(response.status, outputHeaders);
        res.end(bytes);
      }
    };
    if (
      hold &&
      req.method === "GET" &&
      req.url === "/api/bootstrap" &&
      response.status === 200
    ) {
      const data = JSON.parse(bytes);
      const id = ++sequence;
      const versions = Object.fromEntries(
        data.projects
          .filter((p) => p.name.startsWith("늦은 갱신"))
          .map((p) => [p.id, p.version]),
      );
      held.push({ id, send, versions });
      events.push({
        action: "hold",
        id,
        at: new Date().toISOString(),
        userId: data.user?.id,
        projectVersions: versions,
      });
      res.on("close", () => {
        const index = held.findIndex((x) => x.id === id);
        if (index >= 0) held.splice(index, 1);
      });
    } else send();
  } catch (error) {
    if (!res.headersSent) res.writeHead(502);
    res.end(String(error));
  }
});
server.on("upgrade", (req, client, head) => {
  const target = new URL(upstream);
  const connection = http.request(new URL(req.url, upstream), {
    headers: { ...req.headers, host: target.host, origin: upstream },
  });
  connection.on("upgrade", (response, remote, remoteHead) => {
    client.write(
      `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n` +
        Object.entries(response.headers)
          .map(([key, value]) => `${key}: ${value}\r\n`)
          .join("") +
        "\r\n",
    );
    if (head.length) remote.write(head);
    if (remoteHead.length) client.write(remoteHead);
    remote.pipe(client);
    client.pipe(remote);
    remote.on("error", () => client.destroy());
    client.on("error", () => remote.destroy());
  });
  connection.on("error", () => client.destroy());
  connection.end();
});
server.listen(Number(process.env.TEAMVIBE_PROXY_PORT || 0), "127.0.0.1", () => {
  const address = "http://127.0.0.1:" + server.address().port;
  writeFileSync(
    "evidence/refresh-delay-proxy.json",
    JSON.stringify(
      {
        address,
        upstream,
        pid: process.pid,
        note: "Local-only delayed bootstrap response proxy for actual browser verification. HMR websocket is forwarded after the first attempt exposed a Vite overlay.",
      },
      null,
      2,
    ),
  );
  console.log(address);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    hold = false;
    while (held.length) held.shift().send();
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
