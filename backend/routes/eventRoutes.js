const express = require("express");
const eventController = require("../controllers/eventController");

const router = express.Router();
router.get("/", eventController.getEvents);
router.get("/:eventId/registration", eventController.checkRegistration);
router.get("/:eventId", eventController.getEvent);

module.exports = router;