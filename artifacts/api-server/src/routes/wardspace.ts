import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  ListWardItemsParams, ListWardItemsResponse, CreateWardItemParams, CreateWardItemBody, CreateWardItemResponse,
  UpdateWardItemParams, UpdateWardItemBody, UpdateWardItemResponse, DeleteWardItemParams,
  AddWardInterestParams, AddWardInterestResponse, RemoveWardInterestParams, RemoveWardInterestResponse,
  GetWardSummaryResponse, LoginWardStaffBody, LoginWardStaffResponse, LogoutWardStaffResponse, GetWardStaffStatusResponse,
} from "@workspace/api-zod";
import { sqlite, tableFor, insert, type Kind } from "../lib/wardspace-db";

const router: IRouter = Router();
// Prototype-only PIN; use a real authenticated staff identity before any real ward use.
const pin = process.env.WARDSPACE_STAFF_PIN || "2468";
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
const staff = (req: Request) => {
  const value = verified(cookies(req).ws_staff);
  return value !== null && Number(value) > Date.now();
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
  if (staff(req)) return true;
  res.status(401).json({ error: "Staff sign-in required" });
  return false;
};
const allowedStatus: Partial<Record<Kind, string[]>> = {
  activities: ["Draft", "Published", "Cancelled", "Completed"],
  "activity-suggestions": ["Pending", "Approved", "Declined"],
  requests: ["New", "Acknowledged", "Completed"],
  suggestions: ["New", "Reviewed", "Responded", "Approved", "Declined"],
};
const checkStatus = (kind: Kind, status: unknown) => !status || (allowedStatus[kind]?.includes(String(status)) ?? false);
const visible = (kind: Kind, row: any) => {
  if (kind === "requests") return false;
  if (kind === "activity-suggestions") return row.status === "Approved";
  if (kind === "activities") return row.status === "Published";
  if (kind === "suggestions") { const data = JSON.parse(row.data); return data.published === true && !!data.response; }
  const data = JSON.parse(row.data);
  return data.active !== false;
};
// Basic per-IP guard for submissions and PIN guesses. No request bodies are logged.
const attempts = new Map<string, { start: number; count: number }>();
router.use("/wardspace", (req, res, next) => {
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && new URL(origin).host !== req.get("host")) { res.status(403).json({ error: "Invalid origin" }); return; }
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
  const isStaff = staff(req);
  res.json(GetWardSummaryResponse.parse({
    todayActivities: count("activities", `date = '${today}' AND status = 'Published'`),
    upcomingActivities: count("activities", `date >= '${today}' AND status = 'Published'`),
    openRequests: isStaff ? count("practical_requests", "status != 'Completed'") : 0,
    newSuggestions: isStaff ? count("activity_suggestions", "status = 'Pending'") + count("general_suggestions", "status = 'New'") : 0,
    announcements: count("announcements", "1=1"),
  }));
});
router.get("/wardspace/staff/status", (req, res) => res.json(GetWardStaffStatusResponse.parse({ authenticated: staff(req) })));
router.post("/wardspace/staff/login", (req, res) => {
  const body = LoginWardStaffBody.safeParse(req.body);
  if (!body.success) { bodyError(res); return; }
  const attempted = Buffer.from(body.data.pin), expected = Buffer.from(pin);
  if (attempted.length !== expected.length || !timingSafeEqual(attempted, expected)) { res.status(401).json({ error: "Incorrect PIN" }); return; }
  const expiry = String(Date.now() + 8 * 3600 * 1000);
  res.cookie("ws_staff", `${expiry}.${sign(expiry)}`, { ...cookieOptions, maxAge: 8 * 3600 * 1000 });
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
  if (kind === "requests" && !staff(req)) { res.status(403).json({ error: "Staff sign-in required" }); return; }
  const rows = sqlite.prepare(`SELECT * FROM ${tableFor(kind)} ORDER BY date ASC, time ASC, id DESC`).all();
  res.json(ListWardItemsResponse.parse(rows.filter(row => staff(req) || visible(kind, row)).map(row => rowFor(kind, row, session))));
});
router.post("/wardspace/:kind", (req, res) => {
  const parsed = CreateWardItemParams.safeParse(req.params), body = CreateWardItemBody.safeParse(req.body);
  if (!parsed.success || !body.success || !body.data.title.trim()) { bodyError(res); return; }
  const kind = parsed.data.kind;
  const isStaff = staff(req);
  if (!isStaff && !["requests", "suggestions", "activity-suggestions"].includes(kind)) { res.status(403).json({ error: "Staff sign-in required" }); return; }
  if (!isStaff && Object.keys(body.data).some(key => !["title", "description", "category", "preferredTime", "location"].includes(key))) { bodyError(res); return; }
  if (kind === "requests" && !isStaff && !["Toiletries","Bedding","Clothing","Laundry","Books / Games","Room issue","Food / Drink question","Speak to someone","Other practical request"].includes(body.data.category || "")) { bodyError(res); return; }
  const status = isStaff ? body.data.status || (kind === "activities" ? "Draft" : "") : kind === "requests" || kind === "suggestions" ? "New" : "Pending";
  if (!checkStatus(kind, status)) { bodyError(res); return; }
  const fields = { ...body.data, title: body.data.title.trim(), status, published: isStaff ? body.data.published : false };
  const id = insert(kind, fields);
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
  const session = viewer(req, res);
  if (add) sqlite.prepare(`INSERT OR IGNORE INTO ${interestTable} (${col}, anonymous_session_id) VALUES (?, ?)`).run(id, session);
  else sqlite.prepare(`DELETE FROM ${interestTable} WHERE ${col}=? AND anonymous_session_id=?`).run(id, session);
  const item = rowFor(kind, raw, session);
  res.json((add ? AddWardInterestResponse : RemoveWardInterestResponse).parse({ interestCount: item.interestCount, interested: item.interested }));
}
router.post("/wardspace/:kind/:id/interest", (req, res) => interest(req, res, true));
router.delete("/wardspace/:kind/:id/interest", (req, res) => interest(req, res, false));
export default router;