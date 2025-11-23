// ✅ Complete working version of Render Sheets API (for your 'Form responses' sheet)

import express from "express";
import { google } from "googleapis";

const app = express();
const PORT = process.env.PORT || 8080;

const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;

app.get("/visitors", async (req, res) => {
  try {
    // Authenticate using the service account JSON stored in Render env var
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // ✅ Correct range for your sheet ('Form responses') and columns (A:L)
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Form responses'!A:L",
    });

    const rows = result.data.values || [];

    if (rows.length === 0) {
      return res.json({ message: "No data found in sheet." });
    }

    // Assume first row is headers, skip it
    const dataRows = rows.slice(1);
    const today = new Date().toDateString();

    // Count entries where Timestamp column (A) matches today's date
    const total = dataRows.filter((r) => {
      if (!r[0]) return false;
      const date = new Date(r[0]);
      return date.toDateString() === today;
    }).length;

    res.json({ total_visitors_today: total, total_rows: dataRows.length });
  } catch (error) {
    console.error("Sheets API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch visitor data" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.send("✅ Forestscape API is running fine. Use /visitors for data.");
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("🌿 Forestscape API is live! Endpoints: /health, /visitors");
});

app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
