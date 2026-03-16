const express = require("express");
const router = express.Router();

const { getImageFromMinio } = require('../controllers/minio.controller');
const AgencyController = require("../controllers/agency.controller");
const authAgency = require("../middlewares/auth.agency");
const authGroundstaff = require("../middlewares/auth.groundstaff");
const authAdmin = require("../middlewares/auth.admin");
const authAdminOrAgency = require("../middlewares/auth.adminOrAgency");

router.post("/agency", authAdmin, AgencyController.createAgency);
router.post("/agencies", authAdmin, AgencyController.createAgency);

router.get("/agency-dashboard/:agencyId", authAgency, AgencyController.getAgencyDashboard);

router.get("/event-report/:event_id", authAgency, AgencyController.getEventReport);

// Route to update event status
router.put("/events/status/:event_id", authAgency, AgencyController.updateEvenstStatus);

router.get("/events/:event_id", authAgency, AgencyController.getEventsById);

router.post("/agency/addgroundstaff", authAgency, AgencyController.addNewGroundStaff);

// Groundstaff login route
router.post("/groundstaff/login", AgencyController.loginGroundStaff);

// Check Authentication Route for Groundstaff
router.get("/groundstaff/check-auth", authGroundstaff, (req, res) => {
  res.status(200).json({
    message: 'Authenticated',
    groundstaff: {
      id: req.groundstaff.groundStaffId,
      mobileNumber: req.groundstaff.mobileNumber,
      agencyId: req.groundstaff.agencyId,
      agencyName: req.groundstaff.agencyName
    }
  });
});

// Groundstaff Logout Route
router.post("/groundstaff/logout", authGroundstaff, AgencyController.logoutGroundstaff);

router.patch("/groundstaff/task/:taskId/complete", authGroundstaff, AgencyController.completeGroundStaffTask);

// Get tasks for groundstaff
router.get("/groundstaff/tasks/:agencyId", authGroundstaff, AgencyController.getGroundStaffTasks);

router.post("/agency/login", AgencyController.loginAgency);
router.post("/agencies/logout", authAgency, AgencyController.logoutAgency);

// Check Authentication Route for Agency
router.get("/check-auth", authAgency, (req, res) => {
  res.status(200).json({
    message: 'Authenticated',
    agency: {
      id: req.agency.AgencyId,
      mobileNumber: req.agency.mobileNumber,
      agencyName: req.agency.agencyName || 'Agency'
    }
  });
});

router.post("/agencies/reset-password", authAdminOrAgency, AgencyController.resetPasswordAgency);
router.post("/agencies/requestOtpAgency", authAdminOrAgency, AgencyController.requestOtpAgency);
router.post("/agencyId", authAdminOrAgency, AgencyController.createAgency);
router.post("/agency/logout", authAgency, AgencyController.logoutAgency);
router.get('/:bucket/:year/:filename', authAgency, getImageFromMinio);
router.get("/:agencyId/groundstaff", authAgency, AgencyController.getGroundStaffByAgency);

// new agency management routes
router.get('/agencies', authAdmin, AgencyController.listAgencies);
router.get('/agencies/:agencyId', authAgency, AgencyController.getAgencyById);
router.put('/agencies/:agencyId', authAdminOrAgency, AgencyController.updateAgency);
router.delete('/agencies/:agencyId', authAdmin, AgencyController.deleteAgency);
router.get('/incident-images/:event_id', authAgency, AgencyController.allImage);


module.exports = router;
