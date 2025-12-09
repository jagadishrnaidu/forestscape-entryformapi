import express from "express";
import { google } from "googleapis";

const app = express();
const PORT = process.env.PORT || 8080;

const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;

// Helper for Google Sheets auth
const getSheets = async () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(GOOGLE_SERVICE_KEY),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
};

// Helper to read rows
const getRows = async () => {
  const sheets = await getSheets();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Form responses'!A:M",
  });
  const rows = result.data.values || [];
  const headers = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(r.map((v, i) => [headers[i], v])));
};

// Parse dd/MM/yyyy
const parseDate = (timestamp) => {
  if (!timestamp) return null;
  const [d, m, y] = timestamp.split(/[ /]/);
  return new Date(`${y}-${m}-${d}`);
};

// ===================== DAILY VISITORS =====================
app.get("/visitors", async (req, res) => {
  try {
    const data = await getRows();
    const now = new Date();
    const day = now.getDate(), month = now.getMonth(), year = now.getFullYear();

    const todayCount = data.filter((r) => {
      const d = parseDate(r.Timestamp);
      return d && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    }).length;

    res.json({ total_visitors_today: todayCount, total_rows: data.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch today's visitors" });
  }
});

// ===================== WEEKLY VISITORS =====================
app.get("/weekly", async (req, res) => {
  try {
    const data = await getRows();
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    const count = data.filter((r) => {
      const d = parseDate(r.Timestamp);
      return d && d >= oneWeekAgo && d <= now;
    }).length;

    res.json({ total_visitors_week: count, total_rows: data.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch weekly visitors" });
  }
});

// ===================== MONTHLY VISITORS =====================
app.get("/monthly", async (req, res) => {
  try {
    const data = await getRows();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const count = data.filter((r) => {
      const d = parseDate(r.Timestamp);
      return d && d.getMonth() === month && d.getFullYear() === year;
    }).length;

    res.json({ total_visitors_month: count, total_rows: data.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch monthly visitors" });
  }
});

// ===================== SALESPERSON STATS =====================
app.get("/salesperson", async (req, res) => {
  try {
    const { name, period } = req.query;
    if (!name || !period) return res.status(400).json({ error: "name and period required" });

    const data = await getRows();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    const filtered = data.filter((r) => {
      const d = parseDate(r.Timestamp);
      if (!d || (r["attended by"] || "").toLowerCase() !== name.toLowerCase()) return false;

      if (period === "today")
        return d.getDate() === now.getDate() && d.getMonth() === month && d.getFullYear() === year;
      if (period === "this_week") return d >= oneWeekAgo && d <= now;
      if (period === "this_month") return d.getMonth() === month && d.getFullYear() === year;
      return true;
    });

    res.json({ salesperson: name, period, customers: filtered.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch salesperson data" });
  }
});

// ===================== COMPARISON STATS =====================
app.get("/compare", async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ error: "period required" });

    const data = await getRows();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    const map = {};
    data.forEach((r) => {
      const d = parseDate(r.Timestamp);
      const sp = r["attended by"] || "Unknown";
      if (!d) return;

      let include = false;
      if (period === "today")
        include = d.getDate() === now.getDate() && d.getMonth() === month && d.getFullYear() === year;
      else if (period === "this_week") include = d >= oneWeekAgo && d <= now;
      else if (period === "this_month") include = d.getMonth() === month && d.getFullYear() === year;
      else include = true;

      if (include) map[sp] = (map[sp] || 0) + 1;
    });

    const results = Object.entries(map)
      .map(([salesperson, customers]) => ({ salesperson, customers }))
      .sort((a, b) => b.customers - a.customers);

    res.json({ period, results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to compare salespeople" });
  }
});

// ===================== ANALYTICS =====================
app.get("/analysis", async (req, res) => {
  try {
    const data = await getRows();

    const limit = Math.max(
      0,
      Math.min(Number.parseInt(req.query.limit, 10) || 50, data.length)
    );

    const countBy = (key) => {
      const counts = {};
      data.forEach((r) => {
        const val = (r[key] || "Unknown").trim();
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count }));
    };

    const names = data.map((r) => r["Name"]).filter(Boolean);
    const remarks = data
      .map((r) => ({
        name: r["Name"],
        attended_by: r["attended by"],
        remark: r["Remarks"],
      }))
      .filter((r) => r.remark && r.remark.trim().length > 0);

    const limitedNames = names.slice(0, limit);
    const limitedRemarks = remarks.slice(0, limit);

    res.json({
      total_records: data.length,
      top_sources: countBy("How did you come to know about us? "),
      top_requirements: countBy("Requirements"),
      top_configurations: countBy("Configuration"),
      top_industries: countBy("I am working in"),
      income_distribution: countBy("Current annual income"),
      all_names: limitedNames,
      all_names_total: names.length,
      all_names_truncated: names.length > limitedNames.length,
      remarks: limitedRemarks,
      remarks_total: remarks.length,
      remarks_truncated: remarks.length > limitedRemarks.length,
      limit_applied: limit,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ===================== HEALTH =====================
app.get("/health", (req, res) => {
  res.send("✅ Forestscape API running fine. Endpoints: /visitors, /weekly, /monthly, /salesperson, /compare, /analysis");
});

app.get("/", (req, res) => {
  res.send("🌿 Forestscape API is live! Endpoints: /health, /visitors, /weekly, /monthly, /salesperson, /compare, /analysis");
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
