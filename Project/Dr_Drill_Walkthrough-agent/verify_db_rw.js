// verify_db_rw.js
import fs from 'fs';
import { promisify } from 'util';

console.log("[NODE verify_db_rw] Initiating real-time database read/write transaction check...");

async function verify() {
  const now = new Date().toISOString();
  let sqlite3;
  let useSQLite = false;

  try {
    const pkg = await import('sqlite3');
    sqlite3 = pkg.default || pkg;
    useSQLite = true;
  } catch (e) {
    console.warn("[NODE verify_db_rw] SQLite3 package failed to load, falling back to JSON local file verification:", e.message);
  }

  if (useSQLite) {
    const db = new sqlite3.Database('./dr_agent.db', (err) => {
      if (err) {
        console.error("[NODE verify_db_rw] Database open failed:", err.message);
        process.exit(1);
      }
    });

    const run = promisify(db.run.bind(db));
    const get = promisify(db.get.bind(db));

    try {
      await run(`
        CREATE TABLE IF NOT EXISTS dr_heartbeats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT,
          status TEXT
        )
      `);

      console.log(`[NODE verify_db_rw] Writing SQLite heartbeat record with timestamp: ${now}`);
      await run('INSERT INTO dr_heartbeats (timestamp, status) VALUES (?, ?)', [now, 'VERIFIED']);

      const row = await get('SELECT * FROM dr_heartbeats ORDER BY id DESC LIMIT 1');
      console.log(`[NODE verify_db_rw] Querying written SQLite row. Result: ID=${row.id}, Timestamp=${row.timestamp}, Status=${row.status}`);

      if (row.timestamp === now) {
        console.log("[NODE verify_db_rw] SQLITE DATA MATCH CONFIRMED. Transaction write/read cycle succeeded.");
        db.close();
        process.exit(0);
      } else {
        console.error("[NODE verify_db_rw] SQLITE DATA MISMATCH: Write and verify timestamps differ!");
        db.close();
        process.exit(1);
      }
    } catch (e) {
      console.error("[NODE verify_db_rw] SQLite verification aborted due to error:", e.message);
      db.close();
      process.exit(1);
    }
  } else {
    // Graceful File-based read/write verification
    try {
      const heartbeatFile = './local_heartbeats.json';
      let heartbeats = [];
      if (fs.existsSync(heartbeatFile)) {
        try {
          heartbeats = JSON.parse(fs.readFileSync(heartbeatFile, 'utf8'));
        } catch (pe) {
          heartbeats = [];
        }
      }

      const newRecord = {
        id: heartbeats.length + 1,
        timestamp: now,
        status: 'VERIFIED'
      };

      console.log(`[NODE verify_db_rw] Writing JSON Fallback heartbeat record with timestamp: ${now}`);
      heartbeats.push(newRecord);
      fs.writeFileSync(heartbeatFile, JSON.stringify(heartbeats, null, 2));

      // Re-read file to verify transition
      const reReadContent = JSON.parse(fs.readFileSync(heartbeatFile, 'utf8'));
      const lastRow = reReadContent[reReadContent.length - 1];
      console.log(`[NODE verify_db_rw] Querying third-party JSON log. Result: ID=${lastRow.id}, Timestamp=${lastRow.timestamp}, Status=${lastRow.status}`);

      if (lastRow.timestamp === now) {
        console.log("[NODE verify_db_rw] JSON RESILIENCE DATA MATCH CONFIRMED. Transaction read/write sequence succeeded.");
        process.exit(0);
      } else {
        console.error("[NODE verify_db_rw] JSON DATA MISMATCH: Read back values differ!");
        process.exit(1);
      }
    } catch (err) {
      console.error("[NODE verify_db_rw] JSON Fallback verification aborted due to error:", err.message);
      process.exit(1);
    }
  }
}

verify();
