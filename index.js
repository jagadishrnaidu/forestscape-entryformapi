// ✅ Complete working Render API code for your Google Sheet ('Form responses' tab)
// Handles Indian date format (dd/MM/yyyy HH:mm:ss)

import express from "express";
import { google } from "googleapis";

const app = express();
const PORT = process.env.PORT || 8080;

const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;

// ===================== MAIN ENDPOINT =====================
app.get("/visitors", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // ✅ Sheet tab and range setup
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Form responses'!A:L",
    });

    const rows = result.data.values || [];

    if (rows.length <= 1) {
      return res.json({ message: "No data found in sheet." });
    }

    // Remove header row
    const dataRows = rows.slice(1);

    // Get today's date in India timezone
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;
    const todayYear = today.getFullYear();

    // Parse dd/MM/yyyy HH:mm:ss format manually
    const total = dataRows.filter((r) => {
      if (!r[0]) return false;
      const parts = r[0].split("/");
      if (parts.length < 3) return false;

      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2].split(" ")[0]);

      return day === todayDay && month === todayMonth && year === todayYear;
    }).length;

    res.json({ total_visitors_today: total, total_rows: dataRows.length });
  } catch (error) {
    console.error("Sheets API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch visitor data" });
  }
});

// ===================== HEALTH ENDPOINT =====================
app.get("/health", (req, res) => {
  res.send("✅ Forestscape API is healthy. Endpoints: /visitors");
});

// ===================== ROOT ENDPOINT =====================
app.get("/", (req, res) => {
  res.send("🌿 Forestscape API is live! Use /health or /visitors endpoints.");
});

// ===================== START SERVER =====================
app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
