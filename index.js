import express from "express";
import { google } from "googleapis";

const app = express();
const PORT = process.env.PORT || 8080;

const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;

app.get("/visitors", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "VisitorData!A:B", // adjust this to match your sheet
    });

    const rows = result.data.values || [];
    const today = new Date().toDateString();

    const total = rows.filter((r) => {
      if (!r[0]) return false;
      const date = new Date(r[0]);
      return date.toDateString() === today;
    }).length;

    res.json({ total_visitors_today: total });
  } catch (error) {
    console.error("Error fetching visitors:", error);
    res.status(500).json({ error: "Failed to fetch visitor data" });
  }
});

app.get("/health", (req, res) => {
  res.send("✅ Render Sheets API is running fine.");
});

app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
