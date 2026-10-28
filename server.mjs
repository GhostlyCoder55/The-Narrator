import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createServer as createViteServer } from "vite";

const port = Number(process.env.PORT ?? 5173);
const host = "127.0.0.1";
const production = process.argv.includes("--production");
const ollamaBaseUrl = new URL(process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434");
const storyModel = process.env.OLLAMA_MODEL ?? "gemma4:e2b";
const speechModel = process.env.PHONON_MODEL ?? "phonon:latest";
const voice = process.env.PHONON_VOICE ?? "Zoey";
const maxSpeechCharacters = 4096;

if (
  !["http:", "https:"].includes(ollamaBaseUrl.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(ollamaBaseUrl.hostname) ||
  ollamaBaseUrl.username ||
  ollamaBaseUrl.password
) {
  throw new Error("OLLAMA_BASE_URL must point to a credential-free loopback address.");
}

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    text: { type: "string" },
    choices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          consequence: { type: "string" },
        },
        required: ["label", "consequence"],
      },
    },
    facts: { type: "array", items: { type: "string" } },
    reflection: { type: "string" },
  },
  required: ["title", "text", "choices", "facts", "reflection"],
};

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

async function readJson(req, limit = 32_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function getStatus() {
  const response = await fetch(new URL("/api/tags", ollamaBaseUrl), {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
  const data = await response.json();
  const models = Array.isArray(data.models) ? data.models : [];
  const modelAvailable = models.some((item) => item.name === storyModel);
  const speechAvailable = models.some((item) => item.name === speechModel);
  let voiceAvailable = false;
  if (speechAvailable) {
    const show = await fetch(new URL("/api/show", ollamaBaseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: speechModel }),
      signal: AbortSignal.timeout(5000),
    });
    if (show.ok) {
      const details = await show.json();
      const voices = details.model_info?.voices ?? details.voices ?? [];
      voiceAvailable = Array.isArray(voices) && voices.some((item) => String(item).toLowerCase() === voice.toLowerCase());
    }
  }
  return {
    available: true,
    storyModelAvailable: modelAvailable,
    voiceAvailable,
    model: storyModel,
    speechModel,
    voice,
  };
}

function validateScene(scene, stage) {
  if (
    typeof scene?.title !== "string" ||
    typeof scene?.text !== "string" ||
    scene.title.trim().length < 2 ||
    scene.text.trim().length < 60 ||
    scene.text.length > 5000 ||
    !Array.isArray(scene.choices) ||
    !Array.isArray(scene.facts) ||
    typeof scene.reflection !== "string"
  ) {
    throw new Error("The local model returned an incomplete scene.");
  }
  const expectedChoices = stage === "ending" ? 0 : 2;
  if (
    scene.choices.length !== expectedChoices ||
    scene.choices.some(
      (choice) =>
        typeof choice?.label !== "string" ||
        choice.label.trim().length < 4 ||
        choice.label.length > 180 ||
        typeof choice.consequence !== "string" ||
        choice.consequence.trim().length < 8 ||
        choice.consequence.length > 240,
    )
  ) {
    throw new Error("The local model returned choices in an unexpected format.");
  }
  if (stage === "ending" && scene.reflection.trim().length < 20) {
    throw new Error("The local model returned an ending without a meaningful reflection.");
  }
  if (scene.facts.some((fact) => typeof fact !== "string" || fact.length > 220)) {
    throw new Error("The local model returned invalid story facts.");
  }
  return {
    title: scene.title.trim().slice(0, 100),
    text: scene.text.trim(),
    choices: scene.choices.map((choice) => ({
      label: choice.label.trim(),
      consequence: choice.consequence.trim(),
    })),
    facts: scene.facts.slice(0, 8).map((fact) => fact.trim()),
    reflection: scene.reflection.trim().slice(0, 600),
  };
}

function makePrompt(input) {
  const {
    stage,
    theme,
    facts = [],
    decisions = [],
    recentScenes = [],
    selectedChoice,
  } = input;
  const recent = recentScenes
    .slice(-2)
    .map((item) => `${item.title}: ${item.text.slice(0, 650)}`)
    .join("\n");
  const decisionNotes = decisions
    .slice(-4)
    .map((item) => `- ${item.sceneTitle}: ${item.choice} (${item.consequence})`)
    .join("\n");
  const requirements =
    stage === "ending"
      ? "Write a satisfying, grounded ending with no simplistic moral lesson. Include no choices and a 1-2 sentence reflection about the actual decisions."
      : "Write one scene of 100-160 words and exactly two distinct, consequential choices. Each choice needs a short concrete consequence that can unfold later.";
  return `Write one scene for an interactive, realistic everyday-life story about ${theme}.
${requirements}
Keep character names, facts, and prior events consistent. Do not resolve every consequence immediately.
The title field is a short heading for this scene, not the overall story title. Give each new scene a distinct title that does not repeat any recent scene.
Return only JSON matching the requested schema. For choices, use label and consequence. Include up to 5 short established facts in facts. Use an empty choices array for an ending. Reflection may be an empty string except at an ending.

Story facts:
${facts.slice(-8).map((fact) => `- ${fact}`).join("\n") || "- No facts established yet."}

Recent scenes:
${recent || "- This is the opening scene."}

Previous decisions:
${decisionNotes || "- The story is just beginning."}

${selectedChoice ? `The reader just chose: ${selectedChoice.label}. Its stated consequence was: ${selectedChoice.consequence}. Continue from that choice without undoing it.` : ""}

Make the prose natural and specific. No markdown, headings, or interface text.`;
}

async function generateScene(input) {
  const prompt = makePrompt(input);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(new URL("/api/generate", ollamaBaseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: storyModel,
          prompt,
          format: schema,
          think: false,
          stream: false,
          options: { temperature: 0.75, num_predict: 420 },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Ollama generation failed (${response.status}): ${detail.slice(0, 300)}`);
      }
      const data = await response.json();
      if (typeof data.response !== "string" || !data.response.trim()) {
        throw new Error("Ollama returned an empty scene.");
      }
      try {
        return validateScene(JSON.parse(data.response), input.stage);
      } catch (error) {
        if (attempt === 1) throw error;
        lastError = error;
      }
    } catch (error) {
      if (lastError) throw lastError;
      throw error;
    }
  }
  throw lastError ?? new Error("The local model did not return a valid scene.");
}

const vite = production
  ? null
  : await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

const distRoot = resolve("dist");
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

async function serveProductionFile(req, res, pathname) {
  const requestedPath = resolve(distRoot, `.${decodeURIComponent(pathname)}`);
  if (!requestedPath.startsWith(`${distRoot}${sep}`) && requestedPath !== distRoot) {
    res.writeHead(400);
    res.end("Invalid path");
    return;
  }
  let filePath = requestedPath;
  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      "Cache-Control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    res.end(file);
  } catch {
    if (extname(pathname)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    filePath = resolve(distRoot, "index.html");
    try {
      const file = await readFile(filePath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(file);
    } catch {
      res.writeHead(503);
      res.end("Production build not found. Run npm run build first.");
    }
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);
  try {
    if (requestUrl.pathname === "/api/status" && req.method === "GET") {
      try {
        sendJson(res, 200, await getStatus());
      } catch (error) {
        sendJson(res, 200, {
          available: false,
          storyModelAvailable: false,
          voiceAvailable: false,
          model: storyModel,
          speechModel,
          voice,
          error: error instanceof Error ? error.message : "Local Ollama service is unavailable.",
        });
      }
      return;
    }
    if (requestUrl.pathname === "/api/story" && req.method === "POST") {
      const input = await readJson(req);
      const allowedStages = new Set(["opening", "continuation", "ending"]);
      if (
        !allowedStages.has(input.stage) ||
        typeof input.theme !== "string" ||
        input.theme.length > 80 ||
        !["Chance encounters", "Work & ambition", "Friendship"].includes(input.theme)
      ) {
        sendJson(res, 400, { error: "The story request has invalid fields." });
        return;
      }
      const scene = await generateScene(input);
      sendJson(res, 200, { source: "generated", scene });
      return;
    }
    if (requestUrl.pathname === "/api/speech" && req.method === "GET") {
      const text = requestUrl.searchParams.get("text") ?? "";
      if (!text.trim() || text.length > maxSpeechCharacters) {
        sendJson(res, 400, { error: `Narration text must contain 1-${maxSpeechCharacters} characters.` });
        return;
      }
      const upstream = await fetch(new URL("/v1/audio/speech", ollamaBaseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: speechModel,
          input: text,
          voice,
          response_format: "wav",
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text();
        sendJson(res, upstream.status || 502, {
          error: `Zoey speech generation failed: ${detail.slice(0, 300)}`,
        });
        return;
      }
      res.writeHead(200, {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "Transfer-Encoding": "chunked",
      });
      Readable.fromWeb(upstream.body).pipe(res);
      return;
    }

    if (production) {
      await serveProductionFile(req, res, requestUrl.pathname);
    } else {
      vite.middlewares(req, res, (error) => {
        if (error) {
          vite.ssrFixStacktrace(error);
          sendJson(res, 500, { error: "The local app server encountered an error." });
        } else if (!res.headersSent) {
          res.writeHead(404);
          res.end("Not found");
        }
      });
    }
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    const message = error instanceof Error ? error.message : "Local service request failed.";
    sendJson(res, message.includes("Request body") ? 400 : 502, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`The Narrator is running at http://${host}:${port}`);
  console.log(`Ollama: ${ollamaBaseUrl.origin} · story: ${storyModel} · voice: ${speechModel}/${voice}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    server.close();
    await vite?.close();
    process.exit(0);
  });
}
