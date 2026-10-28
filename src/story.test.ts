// Runtime validation coverage for offline story branching and browser persistence.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSampleScene,
  SAMPLE_SCENES,
  storeStories,
  loadStories,
  type StoryRecord,
} from "./story";

describe("prewritten story branches", () => {
  it("offers distinct choices at the opening and adapts the chosen theme", () => {
    const opening = createSampleScene("Work & ambition");

    expect(opening.choices).toHaveLength(2);
    expect(opening.choices[0].nextSceneId).not.toBe(opening.choices[1].nextSceneId);
    expect(opening.text).toContain("promised herself not to be late again");
  });

  it("keeps every branch connected to a reflective ending", () => {
    const seen = new Set<string>();
    const pending = ["morning"];
    let endings = 0;

    while (pending.length > 0) {
      const sceneId = pending.pop()!;
      if (seen.has(sceneId)) continue;
      seen.add(sceneId);
      const scene = SAMPLE_SCENES[sceneId];

      expect(scene, `missing scene ${sceneId}`).toBeDefined();
      if (scene.choices.length === 0) {
        endings += 1;
        expect(scene.reflection?.length).toBeGreaterThan(20);
      } else {
        for (const choice of scene.choices) {
          expect(choice.nextSceneId).toBeDefined();
          pending.push(choice.nextSceneId!);
        }
      }
    }

    expect(endings).toBe(8);
    expect(seen.size).toBe(Object.keys(SAMPLE_SCENES).length);
  });
});

describe("saved story persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips story progress through browser storage", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const story: StoryRecord = {
      id: "saved-story",
      title: "The 8:12",
      theme: "Friendship",
      source: "prewritten",
      createdAt: 1,
      updatedAt: 2,
      currentSceneId: "neighbor",
      scene: SAMPLE_SCENES.neighbor,
      sceneCount: 2,
      decisions: [{ sceneTitle: "The 8:12", choice: "Stay and help", consequence: "The bus leaves." }],
      timeline: [{ id: "choice-1", kind: "choice", title: "Stay and help", detail: "The bus leaves." }],
      facts: [],
      recentScenes: [{ title: "The 8:12", text: "Mara sees her neighbor." }],
      finished: false,
    };

    storeStories([story]);

    expect(loadStories()).toEqual([story]);
  });
});
