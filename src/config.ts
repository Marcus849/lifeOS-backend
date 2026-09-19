import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET || "development-only-change-me",
  databaseFile: process.env.DATABASE_FILE || "./data/lifeos.sqlite",
  corsOrigin: process.env.CORS_ORIGIN || true,
};
