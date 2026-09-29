const fs = require("node:fs");
const path = require("node:path");
const initSqlJs = require("sql.js");

const databasePath = path.join(__dirname, "../../data/college-events.sqlite");
let database;

function queryAll(sql, parameters = []) {
  const statement = database.prepare(sql);
  try {
    statement.bind(parameters);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

function queryOne(sql, parameters = []) {
  return queryAll(sql, parameters)[0] ?? null;
}

function run(sql, parameters = []) {
  database.run(sql, parameters);
  return database.getRowsModified();
}

function persist() {
  fs.writeFileSync(databasePath, Buffer.from(database.export()));
}

function seedEvents() {
  const count = queryOne("SELECT COUNT(*) AS count FROM events").count;
  if (count > 0) return;

  const events = [
    ["Founders Forum", "2026-10-17", "10:00 AM", "Innovation Hall", "A day of bold ideas, student ventures, and conversations with alumni founders. Bring a question and leave with a new possibility.", 180, "Talks & Ideas", "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1400&q=85"],
    ["Campus Arts Night", "2026-10-24", "6:30 PM", "Riverside Amphitheatre", "An open-air celebration of music, dance, poetry, and the creative work happening across campus.", 320, "Arts & Culture", "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=85"],
    ["Build for Good Hackathon", "2026-11-07", "9:00 AM", "Engineering Block, Lab 2", "Team up across disciplines to prototype a practical solution for a challenge in your local community. Mentors and meals provided.", 96, "Workshops", "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=85"],
    ["Inter-College Debate", "2026-11-14", "2:00 PM", "Senate Chamber", "Join the audience for an afternoon of sharp arguments and spirited exchange as student teams take on this year's motion.", 140, "Talks & Ideas", "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1400&q=85"],
    ["Green Campus Workshop", "2026-11-21", "11:00 AM", "Botanical Courtyard", "Learn practical ways to make campus life more sustainable, then help plant the next season of the student garden.", 60, "Workshops", "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=85"],
    ["Winter Social", "2026-12-05", "7:00 PM", "Student Union, East Wing", "Close out the semester with an evening of good food, live student performances, and a little room to dance.", 240, "Community", "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1400&q=85"]
  ];

  for (const event of events) {
    run("INSERT INTO events (name, event_date, event_time, venue, description, capacity, category, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", event);
  }
}

async function initializeDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(path.dirname(require.resolve("sql.js")), file)
  });
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  database = fs.existsSync(databasePath)
    ? new SQL.Database(fs.readFileSync(databasePath))
    : new SQL.Database();

  database.run("PRAGMA foreign_keys = ON");
  database.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      department TEXT NOT NULL,
      year_semester TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      venue TEXT NOT NULL,
      description TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity >= 0),
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id TEXT NOT NULL UNIQUE,
      student_id INTEGER NOT NULL REFERENCES students(id),
      event_id INTEGER NOT NULL REFERENCES events(id),
      status TEXT NOT NULL DEFAULT 'Registered' CHECK (status IN ('Registered', 'Cancelled', 'Completed')),
      registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (student_id, event_id)
    );
  `);
  seedEvents();
  persist();
}

module.exports = { initializeDatabase, persist, queryAll, queryOne, run };