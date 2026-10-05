const { queryAll, queryOne } = require("../db/database");

const eventFields = `
  e.id, e.name, e.event_date AS date, e.event_time AS time, e.venue,
  e.description, e.capacity, e.category, e.image_url AS imageUrl,
  MAX(e.capacity - COALESCE(r.registered_count, 0), 0) AS availableSeats
`;
const eventJoins = `
  FROM events e
  LEFT JOIN (
    SELECT event_id, COUNT(*) AS registered_count
    FROM event_registrations
    WHERE status = 'Registered'
    GROUP BY event_id
  ) r ON r.event_id = e.id
`;

function getAllEvents() {
  return queryAll(`SELECT ${eventFields} ${eventJoins} GROUP BY e.id ORDER BY e.event_date, e.event_time`);
}

function getEventById(id) {
  return queryOne(`SELECT ${eventFields} ${eventJoins} WHERE e.id = ? GROUP BY e.id`, [id]);
}

function getStudentEventRegistration(eventId, studentNumber) {
  return queryOne(`
    SELECT r.registration_id AS registrationId, r.status
    FROM event_registrations r
    JOIN students s ON s.id = r.student_id
    WHERE r.event_id = ? AND s.student_number = ?
  `, [eventId, studentNumber]);
}

module.exports = { getAllEvents, getEventById, getStudentEventRegistration };