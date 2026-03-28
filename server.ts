import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);
  if (process.env.GEMINI_API_KEY) {
    console.log(`[Server] GEMINI_API_KEY is present (starts with ${process.env.GEMINI_API_KEY.substring(0, 4)}...)`);
  } else {
    console.warn("[Server] GEMINI_API_KEY is NOT present in environment variables.");
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Using Vite middleware");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: "spa",
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
        'process.env.APP_URL': JSON.stringify(process.env.APP_URL || ''),
      }
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
