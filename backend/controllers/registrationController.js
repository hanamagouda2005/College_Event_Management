const registrationModel = require("../models/registrationModel");
const eventModel = require("../models/eventModel");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[\d\s().-]{7,20}$/;

function validateStudent(body) {
  const fields = ["name", "studentId", "email", "phone", "department", "yearSemester"];
  const missing = fields.filter((field) => typeof body[field] !== "string" || !body[field].trim());
  if (missing.length) return "Please complete all required fields.";
  if (!emailPattern.test(body.email.trim())) return "Enter a valid email address.";
  if (!phonePattern.test(body.phone.trim()) || body.phone.replace(/\D/g, "").length < 7) {
    return "Enter a valid phone number.";
  }
  if (body.name.trim().length > 100 || body.studentId.trim().length > 40) {
    return "Name or student ID is too long.";
  }
  return null;
}

function registerForEvent(request, response, next) {
  const eventId = Number(request.params.eventId);
  if (!Number.isInteger(eventId) || eventId < 1) return response.status(400).json({ error: "Invalid event." });
  const validationError = validateStudent(request.body);
  if (validationError) return response.status(400).json({ error: validationError });

  try {
    const result = registrationModel.createRegistration({
      name: request.body.name.trim(),
      studentId: request.body.studentId.trim(),
      email: request.body.email.trim().toLowerCase(),
      phone: request.body.phone.trim(),
      department: request.body.department.trim(),
      yearSemester: request.body.yearSemester.trim()
    }, eventId);
    if (result.error) return response.status(result.status).json({ error: result.error });
    response.status(201).json({
      message: "Registration successful!",
      registrationId: result.registrationId,
      eventName: eventModel.getEventById(eventId).name
    });
  } catch (error) {
    next(error);
  }
}

function getStudentEvents(request, response) {
  const studentId = request.params.studentId.trim();
  if (!studentId) return response.status(400).json({ error: "Student ID is required." });
  response.json(registrationModel.getRegistrationsForStudent(studentId));
}

function cancelRegistration(request, response) {
  const studentId = request.body.studentId;
  if (typeof studentId !== "string" || !studentId.trim()) {
    return response.status(400).json({ error: "Student ID is required." });
  }
  const result = registrationModel.cancelRegistration(request.params.registrationId, studentId.trim());
  if (result.error) return response.status(result.status).json({ error: result.error });
  response.json({ message: "Registration cancelled." });
}

module.exports = { cancelRegistration, getStudentEvents, registerForEvent };