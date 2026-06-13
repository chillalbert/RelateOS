import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" })); // Support large base64 uploads

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze-photo", async (req, res) => {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body" });
    }

    try {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not defined");
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };

      const textPart = {
        text: "Analyze this photo containing a memory with my friend. Write a concise 2-3 sentence descriptive summary profiling the context, shared activities, or vibe of this image to help me write personalized milestone letters later.",
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
      });

      const description = response.text || "No description could be generated.";
      res.json({ description });
    } catch (err: any) {
      console.error("Error analyzing photo on server:", err);
      res.status(500).json({ error: err.message || "Failed to analyze photo" });
    }
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
