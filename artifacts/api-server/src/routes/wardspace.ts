import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  ListWardItemsParams, ListWardItemsResponse, CreateWardItemParams, CreateWardItemBody, CreateWardItemResponse,
  UpdateWardItemParams, UpdateWardItemBody, UpdateWardItemResponse, DeleteWardItemParams,
  AddWardInterestParams, AddWardInterestResponse, RemoveWardInterestParams, RemoveWardInterestResponse,
  GetWardSummaryResponse, LoginWardStaffBody, LoginWardStaffResponse, LogoutWardStaffResponse, GetWardStaffStatusResponse,
  GetCurrentDailyChallengeResponse, SubmitChallengeEntryBody, SubmitChallengeEntryResponse, GetStaffDailyChallengeResponse,
  SaveDailyChallengeBody, ListChallengeSubmissionsResponse, UpdateChallengeSubmissionBody, UpdateChallengeSubmissionResponse,
  GetMonthlyEngagementMetricsResponse,
} from "@workspace/api-zod";
import { sqlite, tableFor, insert, trackEngagement, type Kind } from "../lib/wardspace-db";

const router: IRouter = Router();
const pin = process.env.WARDSPACE_STAFF_PIN || "";
const secret = process.env.SESSION_SECRET || randomUUID();
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/api/wardspace" };
const sign = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
const cookies = (req: Request) => Object.fromEntries((req.headers.cookie || "").split(";").map(part => part.trim().split("=")).filter(([key]) => key));
const verified = (value?: string) => {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const message = value.slice(0, dot), signature = value.slice(dot + 1);
  const expected = sign(message);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return message;
};
const staff = (req: Request, res?: Response) => {
  const value = verified(cookies(req).ws_staff);
  const expires = value === null ? 0 : Number(value);
  if (!pin || !Number.isFinite(expires) || expires <= Date.now()) return false;
  if (res) {
    const nextExpiry = String(Date.now() + 30 * 60 * 1000);
    res.cookie("ws_staff", `${nextExpiry}.${sign(nextExpiry)}`, { ...cookieOptions, maxAge: 30 * 60 * 1000 });
  }
  return true;
};
const viewer = (req: Request, res: Response) => {
  let id = verified(cookies(req).ws_anon);
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID();
    res.cookie("ws_anon", `${id}.${sign(id)}`, { ...cookieOptions, maxAge: 365 * 24 * 3600 * 1000 });
  }
  return id;
};
function rowFor(kind: Kind, raw: any, session: string) {
  const data = JSON.parse(raw.data) as Record<string, unknown>;
  const interestTable = kind === "activities" ? "activity_interest" : kind === "activity-suggestions" ? "suggestion_interest" : null;
  const idColumn = kind === "activities" ? "activity_id" : "suggestion_id";
  const interest = interestTable ? sqlite.prepare(`SELECT COUNT(*) AS n, MAX(CASE WHEN anonymous_session_id = ? THEN 1 ELSE 0 END) AS mine FROM ${interestTable} WHERE ${idColumn} = ?`).get(session, raw.id) as { n: number; mine: number } : null;
  return { ...data, id: raw.id as number, kind, title: raw.title as string, category: raw.category as string, date: raw.date as string, time: raw.time as string, status: raw.status as string, createdAt: raw.created_at as string, interestCount: interest?.n || 0, interested: Boolean(interest?.mine) };
}
const idParams = (schema: { safeParse: (input: unknown) => any }, req: Request, res: Response) => {
  const parsed = schema.safeParse(req.params);
  if (!parsed.success || parsed.data.id < 1) { res.status(400).json({ error: "Invalid item" }); return null; }
  return parsed.data as { kind: Kind; id: number };
};
const bodyError = (res: Response) => res.status(400).json({ error: "Please check the form fields and try again." });
const requireStaff = (req: Request, res: Response) => {
  if (staff(req, res)) return true;
  res.status(401).json({ error: "Staff sign-in required" });
  return false;
};
const allowedStatus: Partial<Record<Kind, string[]>> = {
  activities: ["Draft", "Published", "Cancelled", "Completed"],
  "activity-suggestions": ["Pending", "Under Review", "Approved", "Archived", "Declined"],
  requests: ["New", "Acknowledged", "Completed"],
  suggestions: ["New", "Reviewed", "Under Review", "In Progress", "Implemented", "Responded", "Approved", "Archived", "Declined"],
};
const checkStatus = (kind: Kind, status: unknown) => !status || (allowedStatus[kind]?.includes(String(status)) ?? false);
const visible = (kind: Kind, row: any) => {
  const data = JSON.parse(row.data);
  if (kind === "requests") return false;
  if (data.active === false) return false;
  if (kind === "activity-suggestions") return row.status === "Approved" && data.published !== false;
  if (kind === "activities") return row.status === "Published" && data.published !== false;
  if (kind === "suggestions") return data.published === true && !!data.response && !["Archived", "Declined"].includes(row.status);
  return data.published !== false;
};
// Basic per-IP guard for submissions and PIN guesses. No request bodies are logged.
const attempts = new Map<string, { start: number; count: number }>();
router.use("/wardspace", (req, res, next) => {
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    try {
      if (origin && new URL(origin).host !== req.get("host")) { res.status(403).json({ error: "Invalid origin" }); return; }
    } catch {
      res.status(403).json({ error: "Invalid origin" });
      return;
    }
    const key = `${req.ip}:${req.path.includes("/staff/login") ? "login" : "write"}`;
    const now = Date.now(), entry = attempts.get(key);
    const current = !entry || now - entry.start > 60000 ? { start: now, count: 0 } : entry;
    current.count++;
    attempts.set(key, current);
    if (attempts.size > 5000) attempts.clear();
    if (current.count > (key.endsWith("login") ? 8 : 60)) { res.status(429).json({ error: "Too many attempts. Please try later." }); return; }
  }
  next();
});
router.get("/wardspace/summary", (req, res) => {
  const count = (table: string, where: string) => (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as { n: number }).n;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const isStaff = staff(req, res);
  res.json(GetWardSummaryResponse.parse({
    todayActivities: count("activities", `date = '${today}' AND status = 'Published'`),
    upcomingActivities: count("activities", `date >= '${today}' AND status = 'Published'`),
    openRequests: isStaff ? count("practical_requests", "status != 'Completed'") : 0,
    newSuggestions: isStaff ? count("activity_suggestions", "status = 'Pending'") + count("general_suggestions", "status = 'New'") : 0,
    announcements: count("announcements", "1=1"),
  }));
});
router.get("/wardspace/staff/status", (req, res) => res.json(GetWardStaffStatusResponse.parse({ authenticated: staff(req, res) })));
router.post("/wardspace/staff/login", (req, res) => {
  const body = LoginWardStaffBody.safeParse(req.body);
  if (!body.success) { bodyError(res); return; }
  if (!pin) { res.status(503).json({ error: "Staff sign-in is not configured" }); return; }
  const attempted = Buffer.from(body.data.pin), expected = Buffer.from(pin);
  if (attempted.length !== expected.length || !timingSafeEqual(attempted, expected)) { res.status(401).json({ error: "Incorrect PIN" }); return; }
  const expiry = String(Date.now() + 30 * 60 * 1000);
  res.cookie("ws_staff", `${expiry}.${sign(expiry)}`, { ...cookieOptions, maxAge: 30 * 60 * 1000 });
  res.json(LoginWardStaffResponse.parse({ authenticated: true }));
});
router.post("/wardspace/staff/logout", (_req, res) => {
  res.clearCookie("ws_staff", cookieOptions);
  res.json(LogoutWardStaffResponse.parse({ authenticated: false }));
});
router.get("/wardspace/:kind", (req, res) => {
  const parsed = ListWardItemsParams.safeParse(req.params);
  if (!parsed.success) { res.status(404).json({ error: "Unknown section" }); return; }
  const kind = parsed.data.kind, session = viewer(req, res);
  const isStaff = staff(req, res);
  if (kind === "requests" && !isStaff) { res.status(403).json({ error: "Staff sign-in required" }); return; }
  const rows = sqlite.prepare(`SELECT * FROM ${tableFor(kind)} ORDER BY date ASC, time ASC, id DESC`).all();
  res.json(ListWardItemsResponse.parse(rows.filter(row => isStaff || visible(kind, row)).map(row => rowFor(kind, row, session))));
});
router.post("/wardspace/:kind", (req, res) => {
  const parsed = CreateWardItemParams.safeParse(req.params), body = CreateWardItemBody.safeParse(req.body);
  if (!parsed.success || !body.success || !body.data.title.trim()) { bodyError(res); return; }
  const kind = parsed.data.kind;
  const isStaff = staff(req, res);
  if (!isStaff && !["requests", "suggestions", "activity-suggestions"].includes(kind)) { res.status(403).json({ error: "Staff sign-in required" }); return; }
  if (!isStaff && Object.keys(body.data).some(key => !["title", "description", "category", "preferredTime", "location"].includes(key))) { bodyError(res); return; }
  if (kind === "requests" && !isStaff && !["Toiletries","Bedding","Clothing","Laundry","Books / Games","Room issue","Food / Drink question","Speak to someone","Other practical request"].includes(body.data.category || "")) { bodyError(res); return; }
  const status = isStaff ? body.data.status || (kind === "activities" ? "Draft" : "") : kind === "requests" || kind === "suggestions" ? "New" : "Pending";
  if (!checkStatus(kind, status)) { bodyError(res); return; }
  const fields = { ...body.data, title: body.data.title.trim(), status, published: isStaff ? body.data.published : false };
  const id = insert(kind, fields);
  if (!isStaff) trackEngagement(kind === "requests" ? "request_submitted" : "suggestion_submitted");
  const row = sqlite.prepare(`SELECT * FROM ${tableFor(kind)} WHERE id = ?`).get(id);
  res.status(201).json(CreateWardItemResponse.parse(rowFor(kind, row, viewer(req, res))));
});
router.patch("/wardspace/:kind/:id", (req, res) => {
  if (!requireStaff(req, res)) return;
  const params = idParams(UpdateWardItemParams, req, res), body = UpdateWardItemBody.safeParse(req.body);
  if (!params || !body.success || !Object.keys(body.data).length || !checkStatus(params.kind, body.data.status)) { if (params) bodyError(res); return; }
  const table = tableFor(params.kind), old = sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(params.id) as any;
  if (!old) { res.status(404).json({ error: "Item not found" }); return; }
  const fields = { ...JSON.parse(old.data), ...body.data };
  if (typeof fields.title !== "string" || !fields.title.trim()) { bodyError(res); return; }
  sqlite.prepare(`UPDATE ${table} SET title=?, category=?, status=?, date=?, time=?, data=?, updated_at=datetime('now') WHERE id=?`)
    .run(fields.title, fields.category || "", fields.status || "", fields.date || "", fields.time || "", JSON.stringify(fields), params.id);
  res.json(UpdateWardItemResponse.parse(rowFor(params.kind, sqlite.prepare(`SELECT * FROM ${table} WHERE id=?`).get(params.id), viewer(req, res))));
});
router.delete("/wardspace/:kind/:id", (req, res) => {
  if (!requireStaff(req, res)) return;
  const params = idParams(DeleteWardItemParams, req, res);
  if (!params) return;
  const result = sqlite.prepare(`DELETE FROM ${tableFor(params.kind)} WHERE id = ?`).run(params.id);
  if (!result.changes) { res.status(404).json({ error: "Item not found" }); return; }
  res.sendStatus(204);
});
function interest(req: Request, res: Response, add: boolean) {
  const params = idParams(add ? AddWardInterestParams : RemoveWardInterestParams, req, res);
  if (!params) return;
  const { kind, id } = params;
  if (kind !== "activities" && kind !== "activity-suggestions") { res.status(400).json({ error: "Interest is unavailable here" }); return; }
  const table = tableFor(kind), raw = sqlite.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!raw || !visible(kind, raw)) { res.status(404).json({ error: "Activity not found" }); return; }
  const interestTable = kind === "activities" ? "activity_interest" : "suggestion_interest";
  const col = kind === "activities" ? "activity_id" : "suggestion_id";
  const sharedDevice = add && req.get("X-WardSpace-Device-Mode") === "shared";
  const session = sharedDevice ? randomUUID() : viewer(req, res);
  if (add) {
    const result = sqlite.prepare(`INSERT OR IGNORE INTO ${interestTable} (${col}, anonymous_session_id) VALUES (?, ?)`).run(id, session);
    if (result.changes) trackEngagement(kind === "activities" ? "activity_interest_added" : "suggestion_interest_added");
  }
  else sqlite.prepare(`DELETE FROM ${interestTable} WHERE ${col}=? AND anonymous_session_id=?`).run(id, session);
  const item = rowFor(kind, raw, session);
  res.json((add ? AddWardInterestResponse : RemoveWardInterestResponse).parse({ interestCount: item.interestCount, interested: item.interested }));
}
router.post("/wardspace/:kind/:id/interest", (req, res) => interest(req, res, true));
router.delete("/wardspace/:kind/:id/interest", (req, res) => interest(req, res, false));

const challengeFromRow = (row: any) => ({
  id: row.id as number,
  title: row.title as string,
  instructions: row.instructions as string,
  category: row.category as string,
  startDate: row.start_date as string,
  endDate: row.end_date as string,
  allowSubmissions: Boolean(row.allow_submissions),
  published: Boolean(row.published),
});
const submissionFromRow = (row: any) => ({
  id: row.id as number,
  challengeId: row.challenge_id as number,
  text: row.text as string,
  status: row.status as "Pending" | "Published" | "Hidden",
  createdAt: row.created_at as string,
});

router.get("/wardspace/staff/requests", (req, res) => {
  if (!requireStaff(req, res)) return;
  const rawStatus = req.query.status;
  if (rawStatus !== undefined && (typeof rawStatus !== "string" || !["New", "Acknowledged", "Completed"].includes(rawStatus))) {
    bodyError(res);
    return;
  }
  const status = typeof rawStatus === "string" ? rawStatus : "";
  const rows = sqlite.prepare(`SELECT * FROM practical_requests WHERE (? = '' OR status = ?)
    ORDER BY created_at DESC, id DESC`).all(status, status);
  res.json(ListWardItemsResponse.parse(rows.map(row => rowFor("requests", row, ""))));
});

router.get("/wardspace/challenges/current", (req, res) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const row = sqlite.prepare(`SELECT * FROM daily_challenges WHERE published = 1 AND start_date <= ? AND end_date >= ?
    ORDER BY start_date DESC, id DESC LIMIT 1`).get(today, today);
  const submissions = row ? sqlite.prepare(`SELECT * FROM challenge_submissions WHERE challenge_id = ? AND status = 'Published'
    ORDER BY created_at DESC LIMIT 50`).all((row as any).id).map(submissionFromRow) : [];
  res.json(GetCurrentDailyChallengeResponse.parse({ challenge: row ? challengeFromRow(row) : null, submissions }));
});

router.post("/wardspace/challenges/submissions", (req, res) => {
  const body = SubmitChallengeEntryBody.safeParse(req.body);
  if (!body.success || !body.data.text.trim()) { bodyError(res); return; }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const challenge = sqlite.prepare(`SELECT id FROM daily_challenges WHERE published = 1 AND allow_submissions = 1
    AND start_date <= ? AND end_date >= ? ORDER BY start_date DESC, id DESC LIMIT 1`).get(today, today) as { id: number } | undefined;
  if (!challenge) { res.status(404).json({ error: "Submissions are not available for today's challenge" }); return; }
  sqlite.prepare("INSERT INTO challenge_submissions (challenge_id, text) VALUES (?, ?)").run(challenge.id, body.data.text.trim());
  trackEngagement("challenge_submission");
  res.status(201).json(SubmitChallengeEntryResponse.parse({ received: true }));
});

router.get("/wardspace/staff/challenges/current", (req, res) => {
  if (!requireStaff(req, res)) return;
  const row = sqlite.prepare("SELECT * FROM daily_challenges ORDER BY start_date DESC, id DESC LIMIT 1").get();
  if (!row) { res.status(404).json({ error: "No challenge exists" }); return; }
  const challenge = challengeFromRow(row);
  const raw = row as any;
  res.json(GetStaffDailyChallengeResponse.parse({ ...challenge, createdAt: raw.created_at, updatedAt: raw.updated_at }));
});

router.put("/wardspace/staff/challenges/current", (req, res) => {
  if (!requireStaff(req, res)) return;
  const body = SaveDailyChallengeBody.safeParse(req.body);
  const validDate = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!body.success || !body.data.title.trim() || body.data.startDate > body.data.endDate
    || !validDate(body.data.startDate) || !validDate(body.data.endDate)) { bodyError(res); return; }
  const current = sqlite.prepare("SELECT id FROM daily_challenges ORDER BY start_date DESC, id DESC LIMIT 1").get() as { id: number } | undefined;
  if (current) {
    sqlite.prepare(`UPDATE daily_challenges SET title=?, instructions=?, category=?, start_date=?, end_date=?,
      allow_submissions=?, published=?, updated_at=datetime('now') WHERE id=?`)
      .run(body.data.title.trim(), body.data.instructions, body.data.category, body.data.startDate, body.data.endDate,
        Number(body.data.allowSubmissions), Number(body.data.published), current.id);
  } else {
    sqlite.prepare(`INSERT INTO daily_challenges (title, instructions, category, start_date, end_date, allow_submissions, published)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(body.data.title.trim(), body.data.instructions, body.data.category, body.data.startDate, body.data.endDate,
        Number(body.data.allowSubmissions), Number(body.data.published));
  }
  const saved = sqlite.prepare("SELECT * FROM daily_challenges ORDER BY start_date DESC, id DESC LIMIT 1").get() as any;
  res.json(GetStaffDailyChallengeResponse.parse({ ...challengeFromRow(saved), createdAt: saved.created_at, updatedAt: saved.updated_at }));
});

router.get("/wardspace/staff/challenges/submissions", (req, res) => {
  if (!requireStaff(req, res)) return;
  const rows = sqlite.prepare("SELECT * FROM challenge_submissions ORDER BY created_at DESC, id DESC").all().map(submissionFromRow);
  res.json(ListChallengeSubmissionsResponse.parse(rows));
});

router.patch("/wardspace/staff/challenges/submissions/:id", (req, res) => {
  if (!requireStaff(req, res)) return;
  const id = Number(req.params.id);
  const body = UpdateChallengeSubmissionBody.safeParse(req.body);
  if (!Number.isInteger(id) || id < 1 || !body.success) { bodyError(res); return; }
  const result = sqlite.prepare("UPDATE challenge_submissions SET status=?, updated_at=datetime('now') WHERE id=?").run(body.data.status, id);
  if (!result.changes) { res.status(404).json({ error: "Submission not found" }); return; }
  const row = sqlite.prepare("SELECT * FROM challenge_submissions WHERE id=?").get(id);
  res.json(UpdateChallengeSubmissionResponse.parse(submissionFromRow(row)));
});

router.get("/wardspace/staff/metrics/monthly", (req, res) => {
  if (!requireStaff(req, res)) return;
  const now = new Date();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).format(now);
  const start = `${month}-01 00:00:00`;
  const count = (sql: string, ...args: string[]) => (sqlite.prepare(sql).get(...args) as { n: number }).n;
  const nextMonth = new Date(`${month}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const endDate = nextMonth.toISOString().slice(0, 10);
  const end = `${endDate} 00:00:00`;
  res.json(GetMonthlyEngagementMetricsResponse.parse({
    month,
    suggestionsReceived: count("SELECT COUNT(*) AS n FROM engagement_events WHERE event_type='suggestion_submitted' AND created_at >= ? AND created_at < ?", start, end),
    suggestionsImplemented: count("SELECT COUNT(*) AS n FROM general_suggestions WHERE status IN ('Responded','Implemented') AND json_extract(data, '$.published') = 1 AND updated_at >= ? AND updated_at < ?", start, end),
    activitiesCreated: count("SELECT COUNT(*) AS n FROM activities WHERE created_at >= ? AND created_at < ?", start, end),
    activityInterestClicks: count("SELECT COUNT(*) AS n FROM engagement_events WHERE event_type='activity_interest_added' AND created_at >= ? AND created_at < ?", start, end),
    suggestionInterestClicks: count("SELECT COUNT(*) AS n FROM engagement_events WHERE event_type='suggestion_interest_added' AND created_at >= ? AND created_at < ?", start, end),
    requestsReceived: count("SELECT COUNT(*) AS n FROM engagement_events WHERE event_type='request_submitted' AND created_at >= ? AND created_at < ?", start, end),
    challengeEntries: count("SELECT COUNT(*) AS n FROM engagement_events WHERE event_type='challenge_submission' AND created_at >= ? AND created_at < ?", start, end),
  }));
});
export default router;