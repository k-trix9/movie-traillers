
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { issueCsrfToken, csrfProtection } from "./middleware/csrf.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.routes.js";
import movieRoutes from "./routes/movie.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import streamRoutes from "./routes/stream.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import accountRoutes from "./routes/account.routes.js";
import { flutterwaveWebhook } from "./routes/webhook.routes.js";

const { Pool } = pg;
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false
});
const PgSession = connectPgSimple(session);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
      scriptSrc: ["'self'", "https://esm.sh"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: [
        "'self'",
        "https://*.cloudflarestream.com",
        "https://*.videodelivery.net",
        "blob:"
      ],
      frameSrc: [
        "'self'",
        "https://*.cloudflarestream.com",
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com"
      ],
      connectSrc: [
        "'self'",
        "https://api.flutterwave.com",
        "https://api.cloudflare.com",
        "https://*.cloudflarestream.com",
        "https://*.videodelivery.net",
        "https://upload.videodelivery.net",
        "https://esm.sh"
      ]
    }
  }
}));

app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  credentials: true
}));

// Flutterwave webhook needs the untouched request bytes for signature verification.
app.post("/api/webhooks/flutterwave", express.raw({ type: "application/json", limit: "256kb" }), flutterwaveWebhook);

app.use(express.json({ limit: "1mb" }));
app.use(session({
  name: env.SESSION_COOKIE_NAME,
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "filmora-api" });
});

app.get("/api/auth/csrf", issueCsrfToken);
app.use("/api", csrfProtection);

app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/account", accountRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ error: { message: "API route not found." } });
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// The React app is built by Vite into frontend/dist (run "npm run build" inside frontend/).
const frontendDir = path.resolve(currentDir, "../../frontend/dist");
app.use(express.static(frontendDir));

// Any non-API page (/movie/some-slug, /account, /admin ...) is handled by React Router.
app.get("*", (req, res, next) => {
  res.sendFile(path.join(frontendDir, "index.html"), (error) => {
    if (error) next();
  });
});

app.use(errorHandler);

export { app, pool };
