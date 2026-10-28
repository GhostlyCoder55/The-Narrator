import { useEffect, useMemo, useRef, useState } from "react";
import {
  createId,
  createSampleScene,
  loadStories,
  SAMPLE_SCENES,
  storeStories,
  THEMES,
  type LocalStatus,
  type StoryChoice,
  type StoryRecord,
  type StoryScene,
  type Theme,
  type TimelineEntry,
} from "./story";

type Screen = "home" | "story" | "library";
type GenerationStage = "opening" | "continuation" | "ending";

const initialStatus: LocalStatus = {
  available: false,
  storyModelAvailable: false,
  voiceAvailable: false,
  model: "gemma4:e2b",
  speechModel: "phonon:latest",
  voice: "Zoey",
};

function isStoryScene(value: unknown): value is StoryScene {
  if (typeof value !== "object" || value === null) return false;
  const scene = value as StoryScene;
  return (
    typeof scene.title === "string" &&
    typeof scene.text === "string" &&
    Array.isArray(scene.choices) &&
    scene.choices.every(
      (choice) =>
        typeof choice.label === "string" &&
        typeof choice.consequence === "string",
    )
  );
}

async function requestScene(
  stage: GenerationStage,
  theme: Theme,
  story?: StoryRecord,
  selectedChoice?: StoryChoice,
): Promise<StoryScene> {
  const response = await fetch("/api/story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stage,
      theme,
      facts: story?.facts ?? [],
      decisions: story?.decisions ?? [],
      recentScenes: story?.recentScenes ?? [],
      selectedChoice,
    }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Local story generation failed (${response.status}).`;
    throw new Error(message);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("scene" in payload) ||
    !isStoryScene(payload.scene)
  ) {
    throw new Error("The local model returned an invalid scene.");
  }
  return payload.scene;
}

function makeStory(
  scene: StoryScene,
  theme: Theme,
  source: "generated" | "prewritten",
): StoryRecord {
  const now = Date.now();
  return {
    id: createId(),
    title: scene.title,
    theme,
    source,
    createdAt: now,
    updatedAt: now,
    currentSceneId: scene.id,
    scene,
    sceneCount: 1,
    decisions: [],
    timeline: [
      {
        id: createId(),
        kind: "ripple",
        title: "The day begins",
        detail: scene.text.slice(0, 150),
      },
    ],
    facts: scene.facts ?? [],
    recentScenes: [{ title: scene.title, text: scene.text }],
    finished: scene.choices.length === 0,
  };
}

function AudioControls({
  sceneId,
  text,
  voiceAvailable,
  voice,
  stopOnAdvance,
}: {
  sceneId: string;
  text: string;
  voiceAvailable: boolean;
  voice: string;
  stopOnAdvance: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "playing" | "paused" | "stopped" | "error">("loading");
  const [message, setMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let active = true;
    setStatus("loading");
    setMessage("");

    if (!voiceAvailable) {
      setStatus("error");
      setMessage(`${voice} is unavailable. You can still read this scene.`);
      return () => {
        active = false;
        audio.pause();
      };
    }

    audio.preload = "auto";
    audio.src = `/api/speech?text=${encodeURIComponent(text)}`;
    audio.onplaying = () => active && setStatus("playing");
    audio.onpause = () => {
      if (active && !audio.ended && audio.currentTime > 0) setStatus("paused");
    };
    audio.onended = () => active && setStatus("stopped");
    audio.onerror = () => {
      if (active) {
        setStatus("error");
        setMessage("Narration could not be generated. The story is still available to read.");
      }
    };

    const play = async () => {
      try {
        await audio.play();
        if (active) setStatus("playing");
      } catch {
        if (active) {
          setStatus("error");
          setMessage("Press play to start Zoey's narration.");
        }
      }
    };
    void play();

    return () => {
      active = false;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [sceneId, text, voice, voiceAvailable]);

  useEffect(() => {
    if (!stopOnAdvance) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setStatus("stopped");
    }
  }, [stopOnAdvance]);

  const replay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      setStatus("error");
      setMessage("Narration could not be started.");
    });
  };
  const pause = () => {
    const audio = audioRef.current;
    audio?.pause();
    if (audio) setStatus("paused");
  };
  const resume = () => {
    const audio = audioRef.current;
    if (audio) {
      void audio.play().catch(() => {
        setStatus("error");
        setMessage("Narration could not be resumed.");
      });
    }
  };
  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setStatus("stopped");
    }
  };

  return (
    <div className="narration" aria-label={`${voice} narration controls`}>
      <audio ref={audioRef} data-scene={sceneId} hidden />
      <span className="narration-label">
        <span className={`voice-indicator ${status === "playing" ? "is-playing" : ""}`} aria-hidden="true" />
        {status === "loading" ? "Preparing voice…" : `${voice} voice`}
      </span>
      <div className="audio-actions">
        {status === "playing" ? (
          <button className="audio-button" type="button" onClick={pause} aria-label="Pause narration" title="Pause">
            Ⅱ
          </button>
        ) : (
          <button
            className="audio-button"
            type="button"
            onClick={status === "paused" ? resume : replay}
            aria-label={status === "paused" ? "Resume narration" : "Play narration"}
            title={status === "paused" ? "Resume" : "Play"}
          >
            ▶
          </button>
        )}
        <button className="audio-button" type="button" onClick={replay} aria-label="Replay narration" title="Replay">
          ↻
        </button>
        <button className="audio-button" type="button" onClick={stop} aria-label="Stop narration" title="Stop">
          ■
        </button>
      </div>
      {message && <span className="narration-message" role="status">{message}</span>}
    </div>
  );
}

function App() {
  const [stories, setStories] = useState<StoryRecord[]>(loadStories);
  const [screen, setScreen] = useState<Screen>("home");
  const [activeStoryId, setActiveStoryId] = useState(
    () => localStorage.getItem("the-narrator-active-story") ?? "",
  );
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [status, setStatus] = useState<LocalStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingChoice, setPendingChoice] = useState<StoryChoice | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/status")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not check the local services.");
        const data = (await response.json()) as LocalStatus;
        if (mounted) setStatus(data);
      })
      .catch(() => {
        if (mounted) setStatus(initialStatus);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      storeStories(stories);
    } catch {
      setError("This browser could not save your library. Check available storage and try again.");
    }
  }, [stories]);

  useEffect(() => {
    try {
      if (activeStoryId) {
        localStorage.setItem("the-narrator-active-story", activeStoryId);
      } else {
        localStorage.removeItem("the-narrator-active-story");
      }
    } catch {
      setError("This browser could not save the selected story. Your library remains available for this visit.");
    }
  }, [activeStoryId]);

  const activeStory = useMemo(
    () => stories.find((story) => story.id === activeStoryId) ?? null,
    [stories, activeStoryId],
  );
  const latestStory = useMemo(
    () => [...stories].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null,
    [stories],
  );

  const saveStory = (next: StoryRecord) => {
    setStories((previous) => {
      const updated = [next, ...previous.filter((story) => story.id !== next.id)];
      try {
        storeStories(updated);
      } catch {
        setError("Your browser could not save this story. You can keep reading for now.");
      }
      return updated;
    });
    setActiveStoryId(next.id);
  };

  const startStory = async () => {
    setBusy(true);
    setError("");
    setPendingChoice(null);
    let newStory: StoryRecord;
    if (status.available && status.storyModelAvailable) {
      try {
        const scene = await requestScene("opening", theme);
        newStory = makeStory(scene, theme, "generated");
      } catch (reason) {
        const scene = createSampleScene(theme);
        newStory = makeStory(scene, theme, "prewritten");
        setError(`Local story generation failed (${reason instanceof Error ? reason.message : "unknown error"}). A prewritten story is ready instead.`);
      }
    } else {
      newStory = makeStory(createSampleScene(theme), theme, "prewritten");
      setError("The local story model is unavailable. A complete prewritten story is ready to play.");
    }
    saveStory(newStory);
    setScreen("story");
    setBusy(false);
  };

  const advanceStory = async (choice: StoryChoice, current = activeStory) => {
    if (!current || busy) return;
    setBusy(true);
    setError("");
    setPendingChoice(choice);

    const decision = {
      sceneTitle: current.scene.title,
      choice: choice.label,
      consequence: choice.consequence,
    };
    const decisionEntry: TimelineEntry = {
      id: createId(),
      kind: "choice",
      title: choice.label,
      detail: choice.consequence,
    };
    const nextDecisions = [...current.decisions, decision];

    if (current.source === "prewritten") {
      const nextId = choice.nextSceneId;
      const nextScene = nextId ? SAMPLE_SCENES[nextId] : undefined;
      if (!nextScene) {
        setError("This story branch could not be found. Your saved progress has not changed.");
        setBusy(false);
        return;
      }
      const nextStory: StoryRecord = {
        ...current,
        currentSceneId: nextScene.id,
        scene: nextScene,
        updatedAt: Date.now(),
        sceneCount: current.sceneCount + 1,
        decisions: nextDecisions,
        timeline: [
          ...current.timeline,
          decisionEntry,
          {
            id: createId(),
            kind: "ripple",
            title: nextScene.title,
            detail: nextScene.text.slice(0, 160),
          },
        ],
        recentScenes: [...current.recentScenes, { title: nextScene.title, text: nextScene.text }].slice(-3),
        finished: nextScene.choices.length === 0,
      };
      saveStory(nextStory);
      setPendingChoice(null);
      setBusy(false);
      return;
    }

    const requestStory: StoryRecord = {
      ...current,
      decisions: nextDecisions,
      recentScenes: [...current.recentScenes, { title: current.scene.title, text: current.scene.text }].slice(-3),
    };
    try {
      const stage: GenerationStage = nextDecisions.length >= 3 ? "ending" : "continuation";
      const nextScene = await requestScene(stage, current.theme, requestStory, choice);
      const sceneWithId = { ...nextScene, id: createId(), label: stage === "ending" ? "The final scene" : `Scene ${current.sceneCount + 1}` };
      const nextStory: StoryRecord = {
        ...current,
        title: current.title,
        currentSceneId: sceneWithId.id,
        scene: sceneWithId,
        updatedAt: Date.now(),
        sceneCount: current.sceneCount + 1,
        decisions: nextDecisions,
        facts: [...new Set([...current.facts, ...(nextScene.facts ?? [])])].slice(-10),
        timeline: [
          ...current.timeline,
          decisionEntry,
          {
            id: createId(),
            kind: "ripple",
            title: sceneWithId.title,
            detail: sceneWithId.text.slice(0, 160),
          },
        ],
        recentScenes: [...requestStory.recentScenes, { title: sceneWithId.title, text: sceneWithId.text }].slice(-3),
        finished: stage === "ending",
      };
      saveStory(nextStory);
      setPendingChoice(null);
    } catch (reason) {
      setError(`The local model could not continue this story: ${reason instanceof Error ? reason.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const retryPendingChoice = () => {
    if (pendingChoice) void advanceStory(pendingChoice);
  };

  const switchToPrewritten = () => {
    const next = makeStory(createSampleScene(activeStory?.theme ?? theme), activeStory?.theme ?? theme, "prewritten");
    saveStory(next);
    setPendingChoice(null);
    setError("Started a complete prewritten path so you can keep reading without the local model.");
  };

  const removeStory = (id: string) => {
    setStories((previous) => {
      const next = previous.filter((story) => story.id !== id);
      try {
        storeStories(next);
      } catch {
        setError("The story could not be removed from browser storage.");
      }
      return next;
    });
    if (activeStoryId === id) setActiveStoryId("");
  };

  const chooseStory = (story: StoryRecord) => {
    setActiveStoryId(story.id);
    setTheme(story.theme);
    setScreen("story");
    setError("");
  };

  const nav = (
    <nav className="top-nav" aria-label="Main navigation">
      <button className={screen === "home" ? "nav-link active" : "nav-link"} onClick={() => { setScreen("home"); setError(""); }}>
        Home
      </button>
      <button className={screen === "library" ? "nav-link active" : "nav-link"} onClick={() => { setScreen("library"); setError(""); }}>
        Library <span className="nav-count">{stories.length}</span>
      </button>
    </nav>
  );

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="wordmark" onClick={() => { setScreen("home"); setError(""); }} aria-label="The Narrator home">
          <span className="brand-mark">n.</span>
          <span>The Narrator</span>
        </button>
        {nav}
        <div className="service-status" title={`Story model: ${status.model}; narration: ${status.voice}`}>
          <span className={`status-dot ${status.storyModelAvailable ? "online" : ""}`} />
          <span>{status.storyModelAvailable ? "Local AI ready" : "Prewritten stories ready"}</span>
        </div>
      </header>

      <main>
        {screen === "home" && (
          <section className="home-page">
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-line" /> A story changes with you</p>
              <h1>Small choices.<br /><em>Unexpected lives.</em></h1>
              <p className="hero-description">
                A missed bus. A familiar face. One ordinary moment, opening onto a life you didn't expect.
              </p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={() => void startStory()} disabled={busy}>
                  {busy ? <><span className="spinner" /> Finding a beginning…</> : <>Begin a story <span aria-hidden="true">↗</span></>}
                </button>
                {latestStory && (
                  <button className="button button-quiet" onClick={() => chooseStory(latestStory)}>
                    Continue <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
              <div className="home-footnote">
                <span className="tiny-spark" aria-hidden="true">✳</span>
                <span>Made one choice at a time. Your stories stay on this device.</span>
              </div>
            </div>
            <aside className="story-seed" aria-label="Story preview">
              <div className="seed-topline">
                <span className="seed-number">01</span>
                <span className="seed-rule" />
                <span className="seed-kicker">A small beginning</span>
              </div>
              <p className="seed-quote">“The bus is already turning the corner.”</p>
              <p className="seed-caption">Somewhere, the day takes a different shape.</p>
              <div className="seed-orbit" aria-hidden="true">
                <span className="orbit-dot dot-one" />
                <span className="orbit-dot dot-two" />
                <span className="orbit-dot dot-three" />
                <span className="orbit-line" />
              </div>
              <div className="seed-bottom">
                <span>One day, many possible lives</span>
                <span aria-hidden="true">↗</span>
              </div>
            </aside>
            <section className="theme-section">
              <div className="theme-heading">
                <span className="section-index">01 / SET THE TONE</span>
                <span className="section-hint">Choose a thread to follow</span>
              </div>
              <div className="theme-options" role="group" aria-label="Story theme">
                {THEMES.map((item, index) => (
                  <button
                    key={item}
                    className={theme === item ? "theme-option selected" : "theme-option"}
                    onClick={() => setTheme(item)}
                    aria-pressed={theme === item}
                  >
                    <span className="theme-index">0{index + 1}</span>
                    <span>{item}</span>
                    <span className="theme-arrow" aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </section>
            {error && <div className="notice" role="status">{error}</div>}
            <div className="home-integrations">
              <span><span className={`mini-dot ${status.storyModelAvailable ? "online" : ""}`} /> Stories {status.storyModelAvailable ? `with ${status.model}` : "available offline"}</span>
              <span><span className={`mini-dot ${status.voiceAvailable ? "online" : ""}`} /> Voice {status.voiceAvailable ? `with ${status.voice}` : "available when Phonon is running"}</span>
            </div>
          </section>
        )}

        {screen === "story" && (
          <section className="reader-page">
            {activeStory ? (
              <>
                <div className="reader-toolbar">
                  <button className="back-link" onClick={() => { setScreen("home"); setError(""); }}>← <span>All stories</span></button>
                  <span className={`source-tag ${activeStory.source}`}>
                    {activeStory.source === "generated" ? `Local story · ${status.model}` : "Prewritten path"}
                  </span>
                </div>
                <div className="reader-grid">
                  <article className="story-column">
                    <div className="scene-meta">
                      <span className="eyebrow"><span className="eyebrow-line" /> {activeStory.scene.label}</span>
                      <span>{activeStory.theme}</span>
                    </div>
                    <div className="progress-row">
                      <span>YOUR STORY</span>
                      <span>{activeStory.finished ? "Complete" : `Chapter ${Math.min(activeStory.sceneCount, 4)} of 4`}</span>
                    </div>
                    <div className="progress-track" aria-label={activeStory.finished ? "Story complete" : "Story in progress"}>
                      <span style={{ width: `${activeStory.finished ? 100 : Math.min(20 + (activeStory.decisions.length * 22), 84)}%` }} />
                    </div>
                    <h2 className="scene-title">{activeStory.scene.title}</h2>
                    <AudioControls
                      key={activeStory.currentSceneId}
                      sceneId={activeStory.currentSceneId}
                      text={activeStory.scene.text}
                      voiceAvailable={status.voiceAvailable}
                      voice={status.voice}
                      stopOnAdvance={busy}
                    />
                    <p className="story-prose">{activeStory.scene.text}</p>
                    {activeStory.scene.choices.length > 0 ? (
                      <div className="choice-section">
                        <p className="choice-prompt">What happens next?</p>
                        <div className="choice-list">
                          {activeStory.scene.choices.map((choice, index) => (
                            <button
                              className="choice-button"
                              key={choice.id}
                              disabled={busy}
                              onClick={() => void advanceStory(choice)}
                            >
                              <span className="choice-number">0{index + 1}</span>
                              <span className="choice-label">{choice.label}</span>
                              <span className="choice-arrow" aria-hidden="true">{busy ? "…" : "↗"}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="ending-block">
                        <p className="ending-label"><span aria-hidden="true">✳</span> A moment to keep</p>
                        <p className="ending-reflection">{activeStory.scene.reflection}</p>
                        <button className="button button-primary alternate-button" onClick={() => { setTheme(activeStory.theme); void startStory(); }}>
                          Explore another path <span aria-hidden="true">↗</span>
                        </button>
                      </div>
                    )}
                    {busy && <div className="generating" role="status"><span className="spinner" /> Writing the next moment…</div>}
                    {error && (
                      <div className="notice story-notice" role="alert">
                        <span>{error}</span>
                        {pendingChoice && activeStory.source === "generated" && (
                          <div className="notice-actions">
                            <button className="text-button" onClick={retryPendingChoice} disabled={busy}>Retry</button>
                            <button className="text-button" onClick={switchToPrewritten} disabled={busy}>Continue with a prewritten story</button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                  <aside className="timeline-column">
                    <div className="timeline-heading">
                      <span className="section-index">THE RIPPLE EFFECT</span>
                      <h3>Small moments,<br /><em>long shadows.</em></h3>
                      <p>Choices and the details they set in motion.</p>
                    </div>
                    <ol className="timeline">
                      {activeStory.timeline.map((item, index) => (
                        <li key={item.id} className={item.kind === "choice" ? "timeline-item decision" : "timeline-item"}>
                          <span className="timeline-marker" aria-hidden="true">{item.kind === "choice" ? "↗" : "·"}</span>
                          <div>
                            <span className="timeline-type">{item.kind === "choice" ? "A choice" : index === 0 ? "The beginning" : "A ripple"}</span>
                            <strong>{item.title}</strong>
                            <p>{item.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {activeStory.decisions.length > 0 && (
                      <div className="decision-recap">
                        <span className="section-index">THE PATH SO FAR</span>
                        <p>{activeStory.decisions.length} {activeStory.decisions.length === 1 ? "decision" : "decisions"} have shaped this version.</p>
                      </div>
                    )}
                  </aside>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p className="eyebrow"><span className="eyebrow-line" /> No story open</p>
                <h2>Every story starts somewhere.</h2>
                <button className="button button-primary" onClick={() => { setScreen("home"); }}>Choose a beginning <span aria-hidden="true">↗</span></button>
              </div>
            )}
          </section>
        )}

        {screen === "library" && (
          <section className="library-page">
            <div className="library-intro">
              <p className="eyebrow"><span className="eyebrow-line" /> Your reading room</p>
              <h1>Stories in<br /><em>the making.</em></h1>
              <p>Every path is saved on this device, just as you left it.</p>
            </div>
            {stories.length === 0 ? (
              <div className="library-empty">
                <span className="empty-mark">n.</span>
                <p>Your library is waiting for its first story.</p>
                <button className="button button-primary" onClick={() => setScreen("home")}>Find a beginning <span aria-hidden="true">↗</span></button>
              </div>
            ) : (
              <div className="library-list">
                {[...stories].sort((a, b) => b.updatedAt - a.updatedAt).map((story, index) => (
                  <article className="library-item" key={story.id}>
                    <span className="library-number">0{index + 1}</span>
                    <div className="library-copy">
                      <span className="section-index">{story.theme} · {story.source === "generated" ? "Locally generated" : "Prewritten"}</span>
                      <h2>{story.title}</h2>
                      <p>{story.finished ? "A complete story" : `${story.decisions.length} ${story.decisions.length === 1 ? "choice" : "choices"} · in progress`}</p>
                    </div>
                    <button className="library-open" onClick={() => chooseStory(story)}>{story.finished ? "Revisit" : "Continue"} <span aria-hidden="true">↗</span></button>
                    <button className="delete-button" onClick={() => removeStory(story.id)} aria-label={`Delete ${story.title}`} title="Delete story">×</button>
                  </article>
                ))}
              </div>
            )}
            {error && <div className="notice" role="status">{error}</div>}
            <div className="library-footer">
              <button className="back-link" onClick={() => setScreen("home")}>← <span>Back to home</span></button>
              <span>Saved privately in this browser</span>
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>THE NARRATOR <span aria-hidden="true">·</span> A LOCAL STORY ENGINE</span>
        <span>Small choices. Unexpected lives.</span>
      </footer>
    </div>
  );
}

export default App;
