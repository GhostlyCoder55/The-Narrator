export type Theme = "Chance encounters" | "Work & ambition" | "Friendship";
export type StorySource = "generated" | "prewritten";

export interface StoryChoice {
  id: string;
  label: string;
  consequence: string;
  nextSceneId?: string;
}

export interface StoryScene {
  id: string;
  label: string;
  title: string;
  text: string;
  choices: StoryChoice[];
  reflection?: string;
  facts?: string[];
}

export interface TimelineEntry {
  id: string;
  kind: "choice" | "ripple";
  title: string;
  detail: string;
}

export interface StoryRecord {
  id: string;
  title: string;
  theme: Theme;
  source: StorySource;
  createdAt: number;
  updatedAt: number;
  currentSceneId: string;
  scene: StoryScene;
  sceneCount: number;
  decisions: Array<{ sceneTitle: string; choice: string; consequence: string }>;
  timeline: TimelineEntry[];
  facts: string[];
  recentScenes: Array<{ title: string; text: string }>;
  finished: boolean;
}

export interface LocalStatus {
  available: boolean;
  storyModelAvailable: boolean;
  voiceAvailable: boolean;
  model: string;
  speechModel: string;
  voice: string;
}

export const THEMES: Theme[] = [
  "Chance encounters",
  "Work & ambition",
  "Friendship",
];

export const SAMPLE_SCENES: Record<string, StoryScene> = {
  morning: {
    id: "morning",
    label: "Scene one · 8:12 a.m.",
    title: "The 8:12",
    text: "Mara is halfway down the front steps when she sees Mrs. Alvarez at the bottom, a paper grocery bag split open beside her. The bus is already turning the corner. In the pocket of Mara's coat, a job application waits to be delivered across town.",
    choices: [
      {
        id: "help",
        label: "Stay and help gather the groceries",
        consequence: "The bus pulls away while Mara is still on the steps.",
        nextSceneId: "neighbor",
      },
      {
        id: "bus",
        label: "Run for the bus and keep the appointment",
        consequence: "Mara makes it aboard, breathless, with one glove missing.",
        nextSceneId: "bus",
      },
    ],
  },
  neighbor: {
    id: "neighbor",
    label: "Scene two · the long way",
    title: "A borrowed umbrella",
    text: "Mrs. Alvarez insists she is fine, though one orange has rolled into the gutter. By the time the groceries are upstairs, the next bus is forty minutes away. She offers Mara an umbrella and mentions that her grandson Leo has been trying to find someone to look at a set of old photographs.",
    choices: [
      {
        id: "walk",
        label: "Walk with Mrs. Alvarez and hear about the photographs",
        consequence: "Mara takes the long way, and learns Leo is looking for a missing street in the pictures.",
        nextSceneId: "photographs",
      },
      {
        id: "call",
        label: "Call the office and ask to move the appointment",
        consequence: "The receptionist offers a later slot, but not the one Mara expected.",
        nextSceneId: "appointment",
      },
    ],
  },
  bus: {
    id: "bus",
    label: "Scene two · across town",
    title: "A seat by the window",
    text: "The bus rocks away from the curb. Mara finds a seat beside a canvas tote someone has left behind. A folded envelope peeks out, addressed to a community theatre on the other side of town. Her interview is in twelve minutes.",
    choices: [
      {
        id: "return",
        label: "Hand the tote to the driver before getting off",
        consequence: "The driver radios the lost-property desk; the envelope gets a second chance to arrive.",
        nextSceneId: "tote",
      },
      {
        id: "appointment",
        label: "Leave it and hurry to the interview",
        consequence: "Mara reaches the building on time, but the tote stays on the bus.",
        nextSceneId: "interview",
      },
    ],
  },
  photographs: {
    id: "photographs",
    label: "Scene three · a familiar corner",
    title: "The street that moved",
    text: "The photographs show the neighborhood before the new road cut it in two. Mara recognizes the little bakery in one picture: her mother used to take her there after school. Leo has been trying to identify the block for a small exhibition at the library.",
    choices: [
      {
        id: "share",
        label: "Offer to help identify the place",
        consequence: "Mara sends Leo a picture of the bakery sign from her mother's old album.",
        nextSceneId: "ending-exhibit",
      },
      {
        id: "leave",
        label: "Thank them and head for the later appointment",
        consequence: "Mara keeps her day moving, but carries the old bakery image with her.",
        nextSceneId: "ending-later",
      },
    ],
  },
  appointment: {
    id: "appointment",
    label: "Scene three · after lunch",
    title: "A different room",
    text: "The later appointment is with a different manager. The conversation is less formal, and the office window looks out over the bus depot. When the manager asks what Mara notices about a place, she thinks of Mrs. Alvarez's careful stories.",
    choices: [
      {
        id: "tell",
        label: "Tell the story about the photographs",
        consequence: "The manager asks Mara to help with a neighborhood project alongside the new role.",
        nextSceneId: "ending-project",
      },
      {
        id: "keep",
        label: "Keep the interview focused on the job",
        consequence: "Mara leaves with a clear answer and an offer to consider.",
        nextSceneId: "ending-offer",
      },
    ],
  },
  tote: {
    id: "tote",
    label: "Scene three · a note returned",
    title: "Lost property",
    text: "At the interview, Mara mentions the tote only because she is late. The manager smiles: the theatre is run by her sister. That afternoon, a message arrives from the person who left it behind—a lighting designer named Jules, who has been looking for the right person to help with a small community production.",
    choices: [
      {
        id: "meet",
        label: "Meet Jules after work",
        consequence: "Mara trades an hour of her evening for a conversation she hadn't planned to have.",
        nextSceneId: "ending-jules",
      },
      {
        id: "wait",
        label: "Save the message and decide tomorrow",
        consequence: "The message stays unanswered overnight, but the invitation is still there.",
        nextSceneId: "ending-message",
      },
    ],
  },
  interview: {
    id: "interview",
    label: "Scene three · the interview",
    title: "Right on time",
    text: "Mara gets the interview. On the way home, she notices a poster for the community theatre and remembers the tote on the bus. The lost-property desk has called the owner; nobody knows why, but the details sound oddly familiar.",
    choices: [
      {
        id: "call-owner",
        label: "Call the theatre and ask if the owner was found",
        consequence: "The call connects Mara to someone who has been waiting for the envelope.",
        nextSceneId: "ending-call",
      },
      {
        id: "go-home",
        label: "Let the day end and go home",
        consequence: "Mara keeps the interview's promise separate from the rest of the day.",
        nextSceneId: "ending-home",
      },
    ],
  },
  "ending-exhibit": {
    id: "ending-exhibit",
    label: "A few weeks later",
    title: "The wall of photographs",
    text: "The bakery turns out to have been on the very corner where the library now stands. At the exhibition, Mara finds her mother's handwriting on the back of one print. Leo saves a place for her beside the wall, and the two of them begin collecting the stories people tell about streets that are gone.",
    choices: [],
    reflection: "A missed bus did not make Mara's day better or worse by itself. It gave an old photograph time to find the person who could name its street.",
  },
  "ending-later": {
    id: "ending-later",
    label: "A few months later",
    title: "The picture in her pocket",
    text: "Mara takes the job. The photograph stays in her coat through a rainy week, then makes its way to Leo in a message she almost forgets to send. They never hold an exhibition together, but the bakery's old address finds its way into the library archive.",
    choices: [],
    reflection: "Not every small decision becomes a turning point. Sometimes it becomes a detail that quietly reaches the right person later.",
  },
  "ending-project": {
    id: "ending-project",
    label: "That summer",
    title: "The neighborhood project",
    text: "The job comes with a project no one planned to start: recording the memories of people along the bus route. Mrs. Alvarez lends the first photograph. Mara learns the old street name from a handwritten caption, then carries it into the next meeting.",
    choices: [],
    reflection: "An appointment moved by forty minutes put Mara in a room where a passing story became useful in a new way.",
  },
  "ending-offer": {
    id: "ending-offer",
    label: "That spring",
    title: "A steady beginning",
    text: "Mara accepts the offer. She still helps Mrs. Alvarez carry groceries on Thursdays, and sometimes hears a new story about the neighborhood while they sort oranges. The job is not the answer to everything, but it is a place to begin.",
    choices: [],
    reflection: "Mara chose to keep one conversation private. The choice did not close every door; it simply left this one to open on its own time.",
  },
  "ending-jules": {
    id: "ending-jules",
    label: "Opening night",
    title: "A seat in the wings",
    text: "The theatre's play is stitched together from letters people never sent. Jules asks Mara to help organize them, and she recognizes one address from the tote. On opening night, she sits in the wings beside the person whose lost envelope set the whole thing in motion.",
    choices: [],
    reflection: "Returning what was not hers did not guarantee a reward. It did make room for a conversation neither person had planned.",
  },
  "ending-message": {
    id: "ending-message",
    label: "The next day",
    title: "An open invitation",
    text: "Mara answers the message the following morning. Jules has already found the envelope's owner, but still needs a hand with the production. They meet for coffee; the project starts two weeks later, without either of them being quite sure how.",
    choices: [],
    reflection: "Waiting changed the timing, not the possibility. Some invitations stay open long enough for an ordinary day to catch up.",
  },
  "ending-call": {
    id: "ending-call",
    label: "Later that week",
    title: "The envelope's address",
    text: "The envelope belonged to a retired actor who had written to the theatre after twenty years away. The director invites Mara to a reading. She listens from the last row, not knowing whether she is there for the story or for the person who tells it.",
    choices: [],
    reflection: "Mara did not carry the tote, but asking one question let its journey touch hers anyway.",
  },
  "ending-home": {
    id: "ending-home",
    label: "The following Monday",
    title: "A quiet evening",
    text: "Mara accepts the job a few days later. The tote finds its owner through the bus depot, and the theatre carries on without her. On Monday, she walks past the poster again and sees a small handwritten note about an upcoming reading.",
    choices: [],
    reflection: "A choice can leave a door unopened without locking it. The next ordinary day still has its own small invitations.",
  },
};

export function createSampleScene(theme: Theme): StoryScene {
  const scene = SAMPLE_SCENES.morning;
  return {
    ...scene,
    text:
      theme === "Work & ambition"
        ? "Mara is halfway down the front steps when she sees Mrs. Alvarez at the bottom, a paper grocery bag split open beside her. The bus is already turning the corner. In Mara's pocket, a job application waits to be delivered across town—and she has promised herself not to be late again."
        : theme === "Friendship"
          ? "Mara is halfway down the front steps when she sees Mrs. Alvarez at the bottom, a paper grocery bag split open beside her. The bus is already turning the corner. She remembers the neighbor once keeping watch for her when she was sick, and the job application in her pocket suddenly feels less urgent."
          : scene.text,
  };
}

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STORAGE_KEY = "the-narrator-stories-v1";

export function loadStories(): StoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is StoryRecord =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as StoryRecord).id === "string" &&
        typeof (item as StoryRecord).currentSceneId === "string" &&
        typeof (item as StoryRecord).scene?.text === "string",
    );
  } catch {
    return [];
  }
}

export function storeStories(stories: StoryRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
}
