const express = require("express");
const router = express.Router();

const { getImageFromMinio } = require('../controllers/minio.controller');
const AgencyController = require("../controllers/agency.controller");

router.post("/agency",AgencyController.createAgency);
router.post("/agencies",AgencyController.createAgency);

router.get("/agency-dashboard/:agencyId", AgencyController.getAgencyDashboard);

router.get("/event-report/:event_id", AgencyController.getEventReport);

// Route to update event status
router.put("/events/status/:event_id", AgencyController.updateEvenstStatus);

router.get("/events/:event_id", AgencyController.getEventsById);

router.post("/agency/addgroundstaff", AgencyController.addNewGroundStaff);


router.post("/agency/login", AgencyController.loginAgency);
router.post("/agencies/logout", AgencyController.logoutAgency);
router.post("/agencies/reset-password", AgencyController.resetPasswordAgency);
router.post("/agencies/requestOtpAgency",AgencyController.requestOtpAgency);
router.post("/agencyId", AgencyController.createAgency);
router.post("/agency/logout", AgencyController.logoutAgency);
router.get('/:bucket/:year/:filename', getImageFromMinio);
router.get("/:agencyId/groundstaff", AgencyController.getGroundStaffByAgency);

// new agency management routes
router.get('/agencies', AgencyController.listAgencies);
router.get('/agencies/:agencyId', AgencyController.getAgencyById);
router.put('/agencies/:agencyId', AgencyController.updateAgency);
router.delete('/agencies/:agencyId', AgencyController.deleteAgency);

router.get('/incident-images/:event_id', AgencyController.allImage);


module.exports = router;
