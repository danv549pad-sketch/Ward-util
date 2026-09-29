import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const kinds = ["schedule", "activities", "activity-suggestions", "requests", "suggestions", "announcements", "ward-guide", "things-to-do", "learning"] as const;
export type Kind = typeof kinds[number];
const tables: Record<Kind, string> = {
  schedule: "schedule_events",
  activities: "activities",
  "activity-suggestions": "activity_suggestions",
  requests: "practical_requests",
  suggestions: "general_suggestions",
  announcements: "announcements",
  "ward-guide": "ward_guide",
  "things-to-do": "things_to_do",
  learning: "learning_resources",
};
export const tableFor = (kind: Kind) => tables[kind];
const path = resolve(process.env.WARDSPACE_DB_PATH || "artifacts/api-server/data/wardspace.sqlite");
mkdirSync(dirname(path), { recursive: true });
export const sqlite = new DatabaseSync(path);
sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
for (const table of Object.values(tables)) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS ${table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    time TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}
sqlite.exec(`
CREATE TABLE IF NOT EXISTS activity_interest (
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  anonymous_session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activity_id, anonymous_session_id)
);
CREATE TABLE IF NOT EXISTS suggestion_interest (
  suggestion_id INTEGER NOT NULL REFERENCES activity_suggestions(id) ON DELETE CASCADE,
  anonymous_session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (suggestion_id, anonymous_session_id)
);
CREATE TABLE IF NOT EXISTS daily_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  allow_submissions INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS daily_challenges_dates ON daily_challenges(start_date, end_date, published);
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Published', 'Hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS challenge_submissions_challenge ON challenge_submissions(challenge_id, status, created_at);
CREATE TABLE IF NOT EXISTS engagement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK (event_type IN ('activity_interest_added', 'suggestion_interest_added', 'suggestion_submitted', 'request_submitted', 'challenge_submission')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS engagement_events_date_type ON engagement_events(created_at, event_type);
`);

type Fields = Record<string, string | number | boolean | undefined>;
const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
};
export function insert(kind: Kind, fields: Fields) {
  const text = (value: Fields[string]) => typeof value === "string" ? value : "";
  const result = sqlite.prepare(`INSERT INTO ${tableFor(kind)} (title, category, status, date, time, data) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(text(fields.title), text(fields.category), text(fields.status), text(fields.date), text(fields.time), JSON.stringify(fields));
  return Number(result.lastInsertRowid);
}
export function trackEngagement(event: "activity_interest_added" | "suggestion_interest_added" | "suggestion_submitted" | "request_submitted" | "challenge_submission") {
  sqlite.prepare("INSERT INTO engagement_events (event_type) VALUES (?)").run(event);
}
function seed(kind: Kind, rows: Fields[]) {
  if ((sqlite.prepare(`SELECT COUNT(*) AS n FROM ${tableFor(kind)}`).get() as { n: number }).n) return;
  for (const row of rows) insert(kind, row);
}

seed("schedule", [
  ["08:00", "Breakfast", "Dining room", "A relaxed start to the day", "Meals"],
  ["09:00", "Morning meeting", "Lounge", "A chance to hear the day's plans", "Community"],
  ["10:30", "Occupational Therapy Group", "Activity room", "Join a practical group activity", "Creative"],
  ["12:00", "Lunch", "Dining room", "Midday meal", "Meals"],
  ["13:30", "Walking Group", "Meet in lounge", "A group walk if the weather suits", "Outdoors"],
  ["15:00", "Quiz", "Lounge", "Take part in a friendly quiz", "Games"],
  ["17:30", "Dinner", "Dining room", "Evening meal", "Meals"],
  ["19:00", "Film Night", "Lounge", "A film chosen by the group", "Social"],
].map(([time, title, location, description, category]) => ({ time, title, location, description, category, date: iso(0) })));
seed("activities", [
  ["Walking Group", 0, "13:30", "Meet in lounge", "Outdoors", "Join an easy-going group walk."],
  ["Art Session", 1, "11:00", "Activity room", "Creative", "Try drawing, painting or collage."],
  ["Pool Tournament", 2, "18:00", "Lounge", "Games", "A friendly tournament; all levels welcome."],
  ["Film Night", 0, "19:00", "Lounge", "Social", "Settle in for a film with others."],
  ["Board Games", 3, "14:00", "Lounge", "Games", "Choose a board game and join in."],
  ["Quiz Night", 4, "18:30", "Lounge", "Games", "Teams and solo players welcome."],
  ["Cooking Group", 5, "11:00", "Kitchen", "Creative", "Make something simple together."],
  ["Music Session", 6, "15:00", "Activity room", "Music", "Listen, share or make music."],
  ["Gardening", 7, "10:30", "Garden", "Outdoors", "Help tend the ward garden."],
  ["Beginner Coding Session", 8, "14:00", "Activity room", "Technology", "Explore the basics of a webpage."],
  ["Pizza and Film", 9, "19:00", "Lounge", "Film", "Choose a film together and enjoy a relaxed evening."],
  ["Karaoke Hour", 10, "18:30", "Activity room", "Music", "Pick a favourite song or come along to listen."],
  ["Indoor Garden Club", 12, "11:30", "Activity room", "Outdoors", "Plan a small container garden together."],
].map(([title, offset, time, location, category, description]) => ({ title: String(title), date: iso(Number(offset)), time: String(time), location: String(location), category: String(category), description: String(description), status: "Published", capacity: 12 })));
seed("activity-suggestions", [
  { title: "Pool tournament", description: "Could we have a friendly tournament?", category: "Games", preferredTime: "Evening", status: "Approved" },
  { title: "Photography walk", description: "Take photos of interesting things outside.", category: "Creative", preferredTime: "Afternoon", status: "Approved" },
  { title: "Book club", description: "Choose a short story and talk about it.", category: "Reading", preferredTime: "No preference", status: "Approved" },
  { title: "Fictional restaurant menu", description: "Invent a menu for a restaurant on the moon.", category: "Creative", preferredTime: "Any time", status: "Approved" },
]);
seed("requests", [
  { title: "Could I have some clean towels?", category: "Bedding", status: "New", location: "Lounge" },
  { title: "The reading lamp is not working", category: "Room issue", status: "Acknowledged", location: "Shared lounge" },
]);
seed("suggestions", [
  { title: "Could we have a pool tournament?", description: "A friendly evening competition.", category: "Activities", status: "Responded", response: "A pool tournament has been added for Friday evening.", published: true },
  { title: "Could there be more books available?", description: "More variety in the lounge.", category: "Entertainment", status: "Responded", response: "We've added a book swap shelf in the lounge.", published: true },
  { title: "Could we have more puzzles?", description: "Something to try together.", category: "Entertainment", status: "Responded", response: "A new collection of puzzles is now in the activity room.", published: true },
]);
seed("announcements", [
  { title: "Community meeting", description: "The community meeting has moved to 10:00 tomorrow.", active: true },
  { title: "New books", description: "New books have been added to the lounge.", active: true },
  { title: "Weekend activity", description: "Look out for the weekend board-games afternoon.", active: true },
]);
seed("ward-guide", [
  ["Daily Routine", "What does a typical day look like?", "The timetable shows meals, meetings and activities. Plans can change; ask staff for today's details."],
  ["Staff Roles", "Who are the different staff?", "Nurses coordinate day-to-day care; healthcare support workers help with everyday needs; occupational therapists support meaningful activities; psychiatrists and psychologists are clinical specialists; social workers help with practical and social needs; pharmacists advise the team about medicines; advocates can help you express your views."],
  ["Meals", "When are meals?", "Check today's schedule for meal times. Ask a member of staff about local arrangements or dietary questions."],
  ["Visiting", "Can people visit?", "Visiting arrangements vary. Ask staff about times and how to arrange a visit."],
  ["Phone & Devices", "Can I use my phone?", "Rules about phones and devices vary by ward. Ask a member of staff about the arrangements here."],
  ["Laundry", "How do I arrange laundry?", "Ask a member of staff about the laundry arrangements on this ward."],
  ["Activities", "How can I join an activity?", "Browse Activities to see what's coming up. Select 'I'm interested' to show anonymous interest, and ask staff about joining."],
  ["Ward Round", "What is a ward round?", "A ward round is generally a meeting where someone's care and progress are discussed with relevant members of the clinical team. Exact arrangements vary between wards. Ask a member of staff about how ward rounds work here."],
  ["Leave", "Who can explain leave arrangements?", "Speak directly with a member of your clinical team about leave arrangements; WardSpace cannot advise on individual decisions."],
  ["Advocacy", "What is an advocate?", "An advocate is someone who can help you understand options and express your views. Ask staff how to contact an advocate here."],
  ["Feedback & Complaints", "How do I share feedback?", "You can use the suggestions page for everyday ideas. For formal feedback or a complaint, ask staff about the ward's process."],
  ["Discharge Planning", "Who can explain discharge planning?", "Your care team can explain what discharge planning involves for you. Ask a member of staff about local arrangements."],
].map(([category, title, description]) => ({ category, title, description, active: true })));
seed("things-to-do", [
  ["15-minute drawing challenge", "Choose an object in the room and sketch it without lifting the pen.", "Creative", "15 minutes"],
  ["Learn something random", "Find a fact you didn't know and tell someone about it.", "General Knowledge", "5 minutes"],
  ["Mini coding challenge", "Create a simple HTML page with a heading and paragraph.", "Technology", "30 minutes"],
  ["Write a film review", "Rate the story, acting, soundtrack and ending of a film you enjoyed.", "Writing", "15 minutes"],
  ["Brain teaser", "Three boxes are labelled apples, oranges and mixed, but every label is wrong. What is the fewest pieces of fruit you need to pick to label them correctly? Answer: one, from the box labelled mixed.", "Games", "15 minutes"],
  ["Design something", "Design a logo for an imaginary company.", "Creative", "30 minutes"],
  ["Pick a playlist", "Choose five songs around a theme and share why you chose them.", "Music", "15 minutes"],
  ["Read a short story", "Choose a story and note one question it leaves you with.", "Reading", "30 minutes"],
  ["Conversation starter", "Ask someone about a favourite place or hobby.", "Social", "5 minutes"],
  ["Design a flag", "Create a flag for an imaginary island and decide what each colour means.", "Creative", "15 minutes"],
  ["Six-line story", "Write a story in exactly six lines, with an unexpected final line.", "Writing", "15 minutes"],
  ["Terrible movie synopsis", "Describe a familiar kind of film as dramatically badly as possible.", "Writing", "5 minutes"],
  ["Twenty-piece build", "Make a small structure from exactly 20 everyday craft pieces.", "Creative", "30 minutes"],
  ["Word puzzle", "Find as many smaller words as you can inside the word 'noticeboard'.", "Games", "15 minutes"],
  ["Make a trivia round", "Write five friendly questions about a topic you enjoy.", "Social", "30 minutes"],
  ["Gentle movement break", "Try a few comfortable stretches or walk around the room if you feel like it.", "Movement", "5 minutes"],
].map(([title, description, category, duration]) => ({ title, description, category, duration, active: true })));
seed("learning", [
  ["Build your first webpage", "Learn basic HTML and create a page with a heading, paragraph and image.", "Coding", "30 minutes", "Beginner", "Start with <h1>Your heading</h1>, then add a <p>paragraph</p> and an <img> with alt text. Save the file as index.html and open it in a browser."],
  ["How DNS works", "Learn how a website name finds its server.", "Digital Skills", "15 minutes", "Beginner", "DNS is like an address book for website names. Your browser asks for the address of a site, then connects to it. Quick quiz: Does DNS store a website's entire page? No; it helps find its address."],
  ["Create a simple monthly budget", "Try a fictional budgeting exercise; no real financial details needed.", "Money Basics", "15 minutes", "Beginner", "Fictional example: £1,000 comes in. Set aside £450 for rent, £200 for food, £100 for travel and £50 for phone. How much remains? £200."],
  ["Learn ten Spanish phrases", "Begin with everyday greetings and useful words.", "Languages", "15 minutes", "Beginner", "Hola = hello; adiós = goodbye; gracias = thank you; por favor = please; sí = yes; no = no; buenos días = good morning; buenas noches = good night; ¿cómo estás? = how are you?; hasta luego = see you later. Quiz: what does gracias mean? Thank you."],
  ["Write a better CV summary", "Draft a short introduction focused on skills and experience.", "CV & Careers", "30 minutes", "Beginner", "Try two sentences describing what you can do and what you want to contribute. Example: 'Organised and dependable retail assistant with experience helping customers and managing stock. Looking to bring strong communication skills to a new team.'"],
  ["Photo composition basics", "Notice framing, light and perspective in everyday photos.", "Photography", "30 minutes", "Beginner", "Choose an everyday object. Take three pictures from different angles and compare which tells the clearest story."],
].map(([title, description, category, duration, difficulty, content]) => ({ title, description, category, duration, difficulty, content, active: true })));

const challengeCount = (sqlite.prepare("SELECT COUNT(*) AS n FROM daily_challenges").get() as { n: number }).n;
if (!challengeCount) {
  const start = iso(0);
  const end = iso(365);
  sqlite.prepare(`INSERT INTO daily_challenges (title, instructions, category, start_date, end_date, allow_submissions, published)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "Design a flag for an imaginary place",
    "Create a flag for an imaginary island, town or planet. Give it a name and decide what its colours and symbols represent.",
    "Creative",
    start,
    end,
    1,
    1,
  );
}