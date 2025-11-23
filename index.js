// ✅ Complete Forestscape Entry Form API with analytics endpoints

import express from "express";
import { google } from "googleapis";

const app = express();
const PORT = process.env.PORT || 8080;

const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;

// ===================== VISITORS ENDPOINT =====================
app.get("/visitors", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Form responses'!A:L",
    });

    const rows = result.data.values || [];
    if (rows.length <= 1) {
      return res.json({ message: "No data found in sheet." });
    }

    const dataRows = rows.slice(1);
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

// ===================== ANALYTICS ENDPOINT =====================
app.get("/analysis", async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(GOOGLE_SERVICE_KEY),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Form responses'!A:M", // Full column coverage
    });

    const rows = result.data.values || [];
    if (rows.length <= 1) {
      return res.json({ message: "No data found in sheet." });
    }

    const headers = rows[0];
    const data = rows.slice(1).map((r) => Object.fromEntries(r.map((v, i) => [headers[i], v])));

    // Helper function for frequency counts
    const countBy = (key) => {
      const counts = {};
      data.forEach((row) => {
        const val = (row[key] || "Unknown").trim();
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count }));
    };

    // Build analytics response
    const response = {
      total_records: data.length,
      top_sources: countBy("How did you come to know about us? "),
      top_requirements: countBy("Requirements"),
      top_configurations: countBy("Configuration"),
      top_industries: countBy("I am working in"),
      income_distribution: countBy("Current annual income"),
      all_names: data.map((r) => r["Name"]).filter(Boolean),
      remarks: data
        .map((r) => ({
          name: r["Name"],
          attended_by: r["attended by"],
          remark: r["Remarks"],
        }))
        .filter((r) => r.remark && r.remark.trim().length > 0),
    };

    res.json(response);
  } catch (error) {
    console.error("Sheets API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to analyze data" });
  }
});

// ===================== HEALTH ENDPOINT =====================
app.get("/health", (req, res) => {
  res.send("✅ Forestscape API is healthy. Endpoints: /visitors, /analysis");
});

// ===================== ROOT ENDPOINT =====================
app.get("/", (req, res) => {
  res.send("🌿 Forestscape API is live! Endpoints: /health, /visitors, /analysis");
});

// ===================== START SERVER =====================
app.listen(PORT, () => console.log(`✅ Server started on port ${PORT}`));
