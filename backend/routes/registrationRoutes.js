const express = require("express");
const registrationController = require("../controllers/registrationController");

const router = express.Router();
router.post("/events/:eventId", registrationController.registerForEvent);
router.get("/students/:studentId/events", registrationController.getStudentEvents);
router.post("/:registrationId/cancel", registrationController.cancelRegistration);

module.exports = router;