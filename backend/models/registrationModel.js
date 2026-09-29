const { persist, queryAll, queryOne, run } = require("../db/database");

function createRegistration(student, eventId) {
  const event = queryOne("SELECT id, capacity FROM events WHERE id = ?", [eventId]);
  if (!event) return { error: "Event not found.", status: 404 };

  const existingStudent = queryOne("SELECT id FROM students WHERE student_number = ?", [student.studentId]);
  if (existingStudent) {
    const duplicate = queryOne("SELECT id FROM event_registrations WHERE student_id = ? AND event_id = ?", [existingStudent.id, eventId]);
    if (duplicate) return { error: "You are already registered for this event.", status: 409 };
  }

  const registered = queryOne("SELECT COUNT(*) AS count FROM event_registrations WHERE event_id = ? AND status = 'Registered'", [eventId]).count;
  if (registered >= event.capacity) return { error: "This event is full.", status: 409 };

  try {
    run("BEGIN TRANSACTION");
    run(`
      INSERT INTO students (student_number, name, email, phone, department, year_semester)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_number) DO UPDATE SET
        name = excluded.name, email = excluded.email, phone = excluded.phone,
        department = excluded.department, year_semester = excluded.year_semester
    `, [student.studentId, student.name, student.email, student.phone, student.department, student.yearSemester]);
    const savedStudent = queryOne("SELECT id FROM students WHERE student_number = ?", [student.studentId]);
    const registrationId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    run("INSERT INTO event_registrations (registration_id, student_id, event_id) VALUES (?, ?, ?)", [registrationId, savedStudent.id, eventId]);
    run("COMMIT");
    persist();
    return { registrationId };
  } catch (error) {
    run("ROLLBACK");
    if (error.message.includes("UNIQUE constraint failed")) {
      return { error: "You are already registered for this event.", status: 409 };
    }
    throw error;
  }
}

function getRegistrationsForStudent(studentNumber) {
  return queryAll(`
    SELECT r.registration_id AS registrationId, r.status,
      e.id AS eventId, e.name AS eventName, e.event_date AS date,
      e.event_time AS time, e.venue, e.category
    FROM event_registrations r
    JOIN students s ON s.id = r.student_id
    JOIN events e ON e.id = r.event_id
    WHERE s.student_number = ?
    ORDER BY e.event_date, e.event_time
  `, [studentNumber]);
}

function cancelRegistration(registrationId, studentNumber) {
  const registration = queryOne(`
    SELECT r.id, r.status FROM event_registrations r
    JOIN students s ON s.id = r.student_id
    WHERE r.registration_id = ? AND s.student_number = ?
  `, [registrationId, studentNumber]);
  if (!registration) return { error: "Registration not found.", status: 404 };
  if (registration.status !== "Registered") return { error: "This registration can no longer be cancelled.", status: 409 };
  run("UPDATE event_registrations SET status = 'Cancelled' WHERE id = ?", [registration.id]);
  persist();
  return { success: true };
}

module.exports = { cancelRegistration, createRegistration, getRegistrationsForStudent };