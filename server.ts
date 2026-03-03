import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

/**
 * 🔒 SECURE KEY VAULT (Server-Side Only)
 * If you don't want to use environment variables, you can paste your 
 * BASE64 ENCODED key below. This keeps it hidden from the browser 
 * and adds a layer of protection against casual source code snooping.
 * 
 * To get your encoded key: Paste your API key into https://www.base64encode.org/
 */
const OBFUSCATED_FALLBACK = "QUl6YVN5Q1VsLTEtZ1Qza2hDd2Y1S2I3bmIzdERmaXZ0RElnQ0pn"; // <--- PASTE YOUR ENCODED KEY HERE

const getApiKey = () => {
  // 1. Check for standard environment variable (Best Practice)
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  // 2. Check for the obfuscated fallback in the code
  if (OBFUSCATED_FALLBACK) {
    try {
      return Buffer.from(OBFUSCATED_FALLBACK, 'base64').toString('utf8').trim();
    } catch (e) {
      console.error("Vault Error: Could not decode the fallback key.");
    }
  }

  return null;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini API Proxy
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, systemInstruction, config } = req.body;
      const apiKey = getApiKey();

      if (!apiKey) {
        return res.status(500).json({ 
          error: "API Key Missing. Please set GEMINI_API_KEY or use the Secure Vault in server.ts" 
        });
      }

      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          ...config,
          systemInstruction: systemInstruction || config?.systemInstruction,
        },
      });

      const response = await model;
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
