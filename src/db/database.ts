import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

const databasePath = path.resolve(process.cwd(), config.databaseFile);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

export function initializeDatabase() {
  const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  db.exec(schema);
  db.exec(`
    INSERT OR IGNORE INTO levels (level, xp_required, growth_points_reward) VALUES
      (1, 0, 0), (2, 1000, 2), (3, 2500, 2), (4, 5000, 3), (5, 8500, 3),
      (6, 13000, 4), (7, 19000, 4), (8, 27000, 5), (9, 37000, 5), (10, 50000, 6);
  `);
}

initializeDatabase();
