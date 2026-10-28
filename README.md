# The Narrator

A private, local-first interactive storytelling app. Stories and progress stay in your browser; language generation and narration run through your local Ollama installation.

## Requirements

- Node.js 20 or newer
- Ollama 0.40.9 or newer, running on this Mac
- A local story model (default: `gemma4:e2b`)
- Phonon (default model: `phonon:latest`) for Zoey narration

The current local setup was verified with Ollama 0.40.11, `gemma4:e2b`, and `phonon:latest`. The Phonon model reports the `Zoey` voice. A real sample was generated through Ollama's documented `/v1/audio/speech` endpoint as 16-bit, mono, 24 kHz WAV audio. Gemma was tested through `/api/generate` with structured JSON output and thinking disabled.

## Run locally

```sh
npm install
npm run dev
```

Open the loopback address printed in the terminal (by default, `http://127.0.0.1:5173`). The app binds only to `127.0.0.1`; it is not exposed to the network.

To create and serve a production build:

```sh
npm run build
npm start
```

## Local model setup

Start Ollama before opening the app. It does not download models automatically.

```sh
ollama serve
ollama list
ollama show phonon:latest
```

Install any missing model yourself only if you choose:

```sh
ollama pull gemma4:e2b
ollama pull phonon
```

The story service calls Ollama's local `/api/generate` endpoint and validates each JSON scene before it reaches the browser. Zoey speech uses the documented OpenAI-compatible `/v1/audio/speech` endpoint. Speech bytes are streamed to the browser as WAV; changing scenes stops the previous audio. If Ollama, the story model, or Phonon is unavailable, the app remains readable and complete prewritten story branches remain playable.

Configuration can be supplied through environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5173` | Local app port |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama address |
| `OLLAMA_MODEL` | `gemma4:e2b` | Installed story model identifier |
| `PHONON_MODEL` | `phonon:latest` | Installed speech model identifier |
| `PHONON_VOICE` | `Zoey` | Phonon voice name |

For example:

```sh
OLLAMA_MODEL=gemma4:e2b npm run dev
```

## Story library and privacy

Saved stories, selected choices, and timelines use this browser's `localStorage`. Removing a story in the library deletes that saved entry. No account, cloud sync, analytics, external AI API, or automatic model download is used. Ollama requests are made only to the configured local service.

## Troubleshooting

- **Prewritten stories are shown:** start Ollama and verify the configured model with `ollama list`; then refresh the page.
- **Zoey narration is unavailable:** verify that `ollama show phonon:latest` lists `Zoey`, and that Ollama is running. The app always leaves the story text available.
- **A generated scene fails validation:** retry the local generation or switch to the complete prewritten path. Only validated scenes are saved.
- **Port 5173 is occupied:** start with another port, for example `PORT=5174 npm run dev`.

Ollama speech API reference: <https://docs.ollama.com/capabilities/speech>
