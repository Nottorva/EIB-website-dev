// Deletes the local sandbox database. It is re-seeded automatically on the next request.
import fs from "node:fs";
import path from "node:path";
const p = path.join(process.cwd(), "data", "db.json");
if (fs.existsSync(p)) { fs.unlinkSync(p); console.log("Removed data/db.json. It will be re-seeded on next request."); }
else console.log("No data/db.json to remove.");
