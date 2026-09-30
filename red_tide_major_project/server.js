const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));


const db = new sqlite3.Database("./database.db");

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL,
    longitude REAL,
    severity TEXT,
    description TEXT,
    timestamp TEXT,
    status TEXT DEFAULT 'pending'
  )
`);
app.post("/api/report", (req, res) => {
  const { latitude, longitude, severity, description } = req.body;

  db.run(
    `INSERT INTO reports (latitude, longitude, severity, description, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [latitude, longitude, severity, description],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Report submitted", id: this.lastID });
    }
  );
});
app.post("/api/predict-bloom", (req, res) => {

  const { features, latitudes, longitudes } = req.body;

  const python = spawn("python", ["gcn_model.py"]);

  python.stdin.write(JSON.stringify({
    features,
    latitudes,
    longitudes
  }));

  python.stdin.end();

  let result = "";

  python.stdout.on("data", (data) => {
    result += data.toString();
  });

  python.stdout.on("end", () => {
    try {
      const parsed = JSON.parse(result);
      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: "GCN Python output error" });
    }
  });

  python.stderr.on("data", (err) => {
    console.error("GCN Python error:", err.toString());
  });

});
app.get("/api/reports/pending", (req, res) => {
  db.all(
    `SELECT * FROM reports WHERE status = 'pending'`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});
app.post("/api/reports/:id/review", (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  db.run(
    `UPDATE reports SET status = ? WHERE id = ?`,
    [status, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Updated" });
    }
  );
});
app.get("/api/reports/approved", (req, res) => {
  db.all(
    `SELECT * FROM reports WHERE status = 'approved'`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});
app.post("/api/similarity", (req, res) => {

  const { features, target_index } = req.body;

  const python = spawn("python", ["similarity.py"]);

  python.stdin.write(JSON.stringify({ features, target_index }));
  python.stdin.end();

  let result = "";

  python.stdout.on("data", (data) => {
    result += data.toString();
  });

  python.stdout.on("end", () => {
    try {
      const parsed = JSON.parse(result);
      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: "Python output error" });
    }
  });

  python.stderr.on("data", (err) => {
    console.error("Python error:", err.toString());
  });

});

app.get("/", (req, res) => {
  res.send("Backend is running.");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});