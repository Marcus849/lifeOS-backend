import { db, initializeDatabase } from "./database.js";

initializeDatabase();
console.log("LifeOS database initialized.");
db.close();
