import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import { seedAssets } from "./seed.js";

const databaseFile = process.env.DATABASE_FILE || "server/data/inventory-ops.db";
fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
const db = new DatabaseSync(databaseFile);
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "local-development-secret";
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin', 'staff')), created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, location TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity >= 0), condition TEXT NOT NULL, status TEXT NOT NULL, cost REAL NOT NULL CHECK(cost >= 0), barcode_type TEXT, barcode TEXT, image TEXT, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS assets_unique_barcode ON assets(barcode) WHERE barcode IS NOT NULL AND barcode != '';
  CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, asset_id TEXT, action TEXT NOT NULL, actor_id TEXT, created_at TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}');
`);
const now = () => new Date().toISOString();
const assetFromRow = (row) => row && ({ ...row, barcodeType: row.barcode_type, archivedAt: row.archived_at, barcode_type: undefined, archived_at: undefined, created_at: undefined, updated_at: undefined });
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const audit = (action, assetId, actorId, details = {}) => db.prepare("INSERT INTO audit_events (id, asset_id, action, actor_id, created_at, details) VALUES (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), assetId, action, actorId, now(), JSON.stringify(details));
if (db.prepare("SELECT COUNT(*) AS count FROM assets").get().count === 0) {
  const insert = db.prepare("INSERT INTO assets (id, name, category, location, quantity, condition, status, cost, barcode_type, barcode, image, created_at, updated_at) VALUES (@id, @name, @category, @location, @quantity, @condition, @status, @cost, @barcodeType, @barcode, @image, @createdAt, @updatedAt)");
  db.exec("BEGIN");
  try {
    seedAssets.forEach((asset) => insert.run({ ...asset, barcodeType: null, barcode: null, image: null, createdAt: now(), updatedAt: now() }));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true }));
app.use(express.json());
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try { req.user = jwt.verify(token, jwtSecret); return next(); } catch { return res.status(401).json({ error: "Invalid or expired session" }); }
};
const allow = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: "You do not have permission for this action" });
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "inventory-ops-api" }));
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: "Name, email, and an 8-character password are required" });
    const user = { id: crypto.randomUUID(), name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: "staff", createdAt: now() };
    db.prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (@id, @name, @email, @passwordHash, @role, @createdAt)").run(user);
    const profile = publicUser(user); res.status(201).json({ user: profile, token: jwt.sign(profile, jwtSecret, { expiresIn: "8h" }) });
  } catch (error) { next(error); }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(req.body.email || "").toLowerCase());
    if (!user || !(await bcrypt.compare(req.body.password || "", user.password_hash))) return res.status(401).json({ error: "Incorrect email or password" });
    const profile = publicUser(user); return res.json({ user: profile, token: jwt.sign(profile, jwtSecret, { expiresIn: "8h" }) });
  } catch (error) { return next(error); }
});
app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: req.user }));
app.get("/api/assets", authenticate, (_req, res) => res.json(db.prepare("SELECT * FROM assets ORDER BY updated_at DESC").all().map(assetFromRow)));
app.get("/api/assets/:id", authenticate, (req, res) => { const asset = assetFromRow(db.prepare("SELECT * FROM assets WHERE id = ?").get(req.params.id)); return asset ? res.json(asset) : res.status(404).json({ error: "Asset not found" }); });
app.post("/api/assets", authenticate, allow("admin", "staff"), (req, res, next) => {
  try {
    const { name, category, location, quantity, condition, status, cost, barcodeType = null, barcode = null, image = null } = req.body;
    if (!name || !category || !location || !Number.isFinite(Number(quantity)) || !Number.isFinite(Number(cost))) return res.status(400).json({ error: "Name, category, location, quantity, and cost are required" });
    const asset = { id: `A${Date.now().toString().slice(-8)}`, name, category, location, quantity: Number(quantity), condition, status, cost: Number(cost), barcodeType, barcode, image, createdAt: now(), updatedAt: now() };
    db.prepare("INSERT INTO assets (id, name, category, location, quantity, condition, status, cost, barcode_type, barcode, image, created_at, updated_at) VALUES (@id, @name, @category, @location, @quantity, @condition, @status, @cost, @barcodeType, @barcode, @image, @createdAt, @updatedAt)").run(asset);
    audit("created", asset.id, req.user.id, { name: asset.name }); return res.status(201).json(asset);
  } catch (error) { return next(error); }
});
app.patch("/api/assets/:id", authenticate, allow("admin", "staff"), (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Asset not found" });
    const fields = ["name", "category", "location", "quantity", "condition", "status", "cost", "barcodeType", "barcode", "image"];
    const asset = { ...assetFromRow(existing), ...Object.fromEntries(fields.filter((key) => key in req.body).map((key) => [key, req.body[key]])), id: existing.id, updatedAt: now() };
    db.prepare("UPDATE assets SET name=@name, category=@category, location=@location, quantity=@quantity, condition=@condition, status=@status, cost=@cost, barcode_type=@barcodeType, barcode=@barcode, image=@image, updated_at=@updatedAt WHERE id=@id").run(asset);
    audit("updated", asset.id, req.user.id, { name: asset.name }); return res.json(asset);
  } catch (error) { return next(error); }
});
app.post("/api/assets/:id/archive", authenticate, allow("admin"), (req, res) => {
  const changed = db.prepare("UPDATE assets SET status = 'Archived', archived_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), req.params.id);
  if (!changed.changes) return res.status(404).json({ error: "Asset not found" }); audit("archived", req.params.id, req.user.id); return res.status(204).end();
});
app.get("/api/audit-events", authenticate, (_req, res) => res.json(db.prepare("SELECT audit_events.*, users.name AS actor_name FROM audit_events LEFT JOIN users ON users.id = audit_events.actor_id ORDER BY created_at DESC LIMIT 100").all()));
app.use((error, _req, res, _next) => { if (error.code?.startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That barcode or email is already in use" }); console.error(error); return res.status(500).json({ error: "Unexpected server error" }); });
app.listen(port, () => console.log(`Inventory Ops API listening on http://localhost:${port}`));
