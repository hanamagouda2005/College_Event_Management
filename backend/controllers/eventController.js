const eventModel = require("../models/eventModel");

function getEvents(_request, response) {
  response.json(eventModel.getAllEvents());
}

function getEvent(request, response) {
  const event = eventModel.getEventById(Number(request.params.eventId));
  if (!event) return response.status(404).json({ error: "Event not found." });
  const studentNumber = request.query.studentId;
  const registration = studentNumber
    ? eventModel.getStudentEventRegistration(event.id, studentNumber)
    : null;
  response.json({ ...event, registration });
}

function checkRegistration(request, response) {
  const registration = eventModel.getStudentEventRegistration(Number(request.params.eventId), request.query.studentId);
  response.json({ registered: Boolean(registration), registration });
}

module.exports = { checkRegistration, getEvent, getEvents };
