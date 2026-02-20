const AgencyModel  = require("../models/agency.model");
console.log(AgencyModel);
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key"; // Use a secure secret key
const JWT_EXPIRATION = "1h"; // Token expiration time (e.g., 1 hour)
// Create A New Agency
async function createAgency(req, res) {
  try {
    console.log("[createAgency] Function called");
    console.log("[createAgency] Request body received:", req.body);

    const { AgencyName, mobileNumber, password, lat, lng, eventResponsibleFor, jurisdiction } = req.body;

    // Validate required fields
    if (!AgencyName || !mobileNumber || !password) {
      console.warn("[createAgency] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Agency name, mobile number, and password are required.",
      });
    }

    // Validate and prepare location
    const location = {};
    if (lat !== undefined || lng !== undefined) {
      console.log("[createAgency] Validating location:", { lat, lng });
      if (typeof lat !== "number" || typeof lng !== "number") {
        console.warn("[createAgency] Invalid location values");
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude must be numeric values.",
        });
      }
      location.latitude = lat;
      location.longitude = lng;
    }

    // Validate eventResponsibleFor if provided
    if (eventResponsibleFor && !Array.isArray(eventResponsibleFor)) {
      return res.status(400).json({ success: false, message: "eventResponsibleFor must be an array" });
    }

    console.log("[createAgency] Calling createAgencyInDB with:", {
      AgencyName,
      mobileNumber,
      password,
      location,
      eventResponsibleFor,
      jurisdiction,
    });

    // Call the model function to create the agency
    const agencyId = await AgencyModel.createAgencyInDB(
      AgencyName,
      mobileNumber,
      password,
      location,
      eventResponsibleFor,
      jurisdiction
    );

    console.log("[createAgency] Agency created successfully with ID:", agencyId);

    // Send success response
    return res.status(201).json({
      success: true,
      message: "Agency created successfully.",
      agencyId,
    });

  } catch (error) {
    console.error("[createAgency Controller] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error. Please try again later.",
    });
  }
}
// Login Controller
async function loginAgency(req, res) {
  try {
    console.log("[loginAgency] Function called");
    console.log("[loginAgency] Request body received:", req.body);

    const { mobileNumber, password } = req.body;

    // Validate required fields
    if (!mobileNumber || !password) {
      console.warn("[loginAgency] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Mobile number and password are required.",
      });
    }

    // Call the model function to handle login
    const result = await AgencyModel.agencyLogin(mobileNumber, password);

    console.log("[loginAgency] Login successful for AgencyId:", result.agency.AgencyId);

    // Generate JWT token
    const token = jwt.sign(
      { AgencyId: result.agency.AgencyId, mobileNumber: result.agency.mobileNumber },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    console.log("[loginAgency] Token generated successfully.");

    // Send success response with token
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token, // Include the token in the response
      agency: result.agency,
    });
  } catch (error) {
    console.error("[loginAgency] Error:", error.message);
    return res.status(401).json({
      success: false,
      message: error.message || "Login failed.",
    });
  }
}
// Logout Controller
async function logoutAgency(req, res) {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from Authorization header

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required for logout.",
      });
    }

    // Optionally, invalidate the token (e.g., add it to a blacklist)
    console.log("[logoutAgency] Invalidating token:", token);

    // Clear token from client-side (if using cookies)
    res.clearCookie("agency_token", {
      httpOnly: true,
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("[logoutAgency] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Logout failed.",
    });
  }
}

async function addNewGroundStaff(req, res) {
  try {
    console.log("[addNewGroundStaff] Function called");
    console.log("[addNewGroundStaff] Request body received:", req.body);

    const { name, number, address, agencyId, password } = req.body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim() === "") {
      console.warn("[addNewGroundStaff] Invalid name:", name);
      return res.status(400).json({
        success: false,
        message: "Invalid name. Name must be a non-empty string.",
      });
    }

    if (!number || !/^\d{10}$/.test(number)) {
      console.warn("[addNewGroundStaff] Invalid number:", number);
      return res.status(400).json({
        success: false,
        message: "Invalid number. Must be exactly 10 digits.",
      });
    }

    if (!address || typeof address !== "string" || address.trim() === "") {
      console.warn("[addNewGroundStaff] Invalid address:", address);
      return res.status(400).json({
        success: false,
        message: "Invalid address. Address must be a non-empty string.",
      });
    }

    if (!agencyId || typeof agencyId !== "string" || agencyId.trim() === "") {
      console.warn("[addNewGroundStaff] Invalid agencyId:", agencyId);
      return res.status(400).json({
        success: false,
        message: "Invalid agencyId. AgencyId must be a non-empty string.",
      });
    }

    if (!password || typeof password !== "string" || password.trim().length < 6) {
      console.warn("[addNewGroundStaff] Invalid password:", password);
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // Call the model function to add ground staff
    const result = await AgencyModel.addGroundStaff(name, number, address, agencyId, password);

    console.log("[addNewGroundStaff] Ground staff added successfully:", result);

    // Send success response
    return res.status(201).json({
      success: true,
      message: "Ground staff added successfully.",
      groundStaffId: result.groundStaffId,
    });
  } catch (error) {
    console.error("[addNewGroundStaff] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error. Please try again later.",
    });
  }
}

const getAgencyDashboard = async (req, res) => {
  try {
    console.log("`[DEBUG] Request Params:", req.params); // Log the request parameters
    
      const { agencyId } = req.params;

      if (!agencyId) {
          return res.status(400).json({ error: "Agency ID is required." });
      }

      console.log(`Fetching dashboard data for agencyId: ${agencyId}`);

      const agencyData = await AgencyModel.getAgencyDashboardCheck(agencyId);

      if (!agencyData) {
          return res.status(404).json({ message: "Agency not found or no events assigned." });
      }

      return res.status(200).json(agencyData);
  } catch (error) {
      console.error("[getAgencyDashboard] Error:", error.message);
      return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// Controller to update event status
const updateEvenstStatus = async (req, res) => {
  try {
    const { event_id } = req.params;
    const { status, groundStaffName, groundStaffId, agencyId } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required." });
    }

    // If status is "Accepted", update assigned_agency.agencies to only the accepting agency
    let updateFields = { status };
    if (status === "Accepted" && agencyId) {
      updateFields["assigned_agency.agencies"] = [agencyId];
    }
    if (status === "Assigned" && groundStaffName) {
      updateFields.ground_staff = groundStaffName;
      if (groundStaffId) {
        updateFields.ground_staff_id = groundStaffId; // Store the groundStaffId for filtering
      }
      updateFields.assignment_time = new Date(); // <-- Add this line
    }

    const eventCollection = await AgencyModel.getEventsCollection();
    const result = await eventCollection.updateOne(
      { event_id },
      { $set: updateFields }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Event not found or status unchanged." });
    }

    return res.status(200).json({ message: "Event status updated successfully." });
  } catch (error) {
    console.error("[updateEventStatus] Error:", error);
    return res.status(500).json({ message: "Server error." });
  }
};

const  getEventsById= async (req, res)  =>{
  try {
    const { event_id } = req.params;

    // Parse optional query params
    const fields = req.query.fields ? req.query.fields.split(",") : [];
    const includeImageUrl = req.query.includeImageUrl !== "false"; // Defaults to true

    const event = await AgencyModel.getEventById(event_id, fields, includeImageUrl);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.status(200).json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}


async function requestOtpAgency(req, res) {
  try {
    const { agencyId, mobileNumber } = req.body;

    if (!agencyId || !mobileNumber) {
      return res.status(400).json({ message: "Agency ID and mobile number are required" });
    }

    if (!/^\d{10}$/.test(mobileNumber.trim())) {
      return res.status(400).json({ message: "Invalid mobile number format" });
    }

    const agency = await AgencyModel.findOne({ AgencyId: agencyId.trim() });

    if (!agency || agency.mobileNumber !== mobileNumber.trim()) {
      return res.status(400).json({ message: "Invalid agency ID or mobile number" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await AgencyModel.updateOTP(mobileNumber.trim(), otp);

    console.log(`[requestOtpAgency] OTP sent: ${otp}`);
    res.status(200).json({ message: "OTP sent successfully", otp }); // Remove 'otp' in production
  } catch (error) {
    console.error("[requestOtpAgency] Fatal error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

async function resetPasswordAgency(req, res) {
  try {
    const { agencyId, newPassword } = req.body;
    console.log("[resetPasswordAgency] Received body:", req.body);

    // Validate required fields
    if (!agencyId || !newPassword) {
      console.warn("[resetPasswordAgency] Missing required fields");
      return res.status(400).json({ success: false, message: "Agency ID and new password are required" });
    }

    // Find agency
    const agency = await AgencyModel.findOne({ AgencyId: agencyId.trim() });
    console.log("[resetPasswordAgency] Fetched Agency:", agency);
    if (!agency) {
      console.warn("[resetPasswordAgency] Agency not found for ID:", agencyId);
      return res.status(404).json({ success: false, message: "Agency not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the agency using our new method (instead of calling agency.save())
    const success = await AgencyModel.updatePassword(agencyId.trim(), hashedPassword);

    if (success) {
      console.log("[resetPasswordAgency] Password reset successful for:", agencyId);
      return res.status(200).json({ success: true, message: "Password reset successful" });
    } else {
      console.warn("[resetPasswordAgency] Password update failed");
      return res.status(500).json({ success: false, message: "Password update failed" });
    }
  } catch (error) {
    console.error("[resetPasswordAgency] Error:", error.stack || error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


async function logoutAgency (req, res) {
  res.clearCookie("agency_token","refreshToken", {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
  });
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};


//login




async function allImage(req, res) {
  try {
    const { event_id } = req.params;
    console.log(req.params);

    // Fetch the event and incidents data
    const event = await AgencyModel.getEventById(event_id);
    console.log(event, "event data");

    if (!event || !Array.isArray(event.incidents)) {
      console.error("Event not found or incidents is not an array.");
      return res.status(404).json({ message: "Event not found or has no incidents." });
    }

    // Ensure incidents is an array before processing
    const incidents = Array.isArray(event.incidents) ? event.incidents : [];
    console.log(incidents, "incident data");

    // Use the model function to get the incident images and bounding boxes
    const incidentImages = await AgencyModel.getIncidentImages(incidents);

    return res.status(200).json({
      event_id: event.event_id,
      incidents: incidentImages,
    });

  } catch (error) {
    console.error('[allImage] Error:', error.message);
    return res.status(500).json({ message: 'Server error.' });
  }
}


async function getEventReport(req, res) {
  try {
    const { event_id } = req.params;

    // Fetch the event report from the model
    const eventReport = await AgencyModel.getEventReportId(event_id);

    if (!eventReport) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    // Prepare the response with the required fields
    const response = {
      success: true,
      assignments_time: eventReport.assignments_time || null,
      AgencyName: eventReport.AgencyName , // Default value if not provided
      AgencyId: eventReport.AgencyId, // Default value if not provided
      event_id: eventReport.event_id,
      description: eventReport.description,
      ground_staff: eventReport.ground_staff || null,
      latitude: eventReport.latitude || null,
      longitude: eventReport.longitude || null,
      image_url: eventReport.image_url || null,
      assignedAgency: eventReport.assignedAgency || null, // Include assignedAgency
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("[getEventReport] Error:", error.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

async function loginGroundStaff(req, res) {
  try {
    console.log("[loginGroundStaff] Function called");
    console.log("[loginGroundStaff] Request body received:", req.body);

    const { mobileNumber, password } = req.body;

    // Validate required fields
    if (!mobileNumber || !password) {
      console.warn("[loginGroundStaff] Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Mobile number and password are required.",
      });
    }

    // Call the model function to handle groundstaff login
    const result = await AgencyModel.groundStaffLogin(mobileNumber, password);

    console.log("[loginGroundStaff] Login successful for groundStaff:", result.groundStaff.number);

    // Generate JWT token
    const token = jwt.sign(
      { groundStaffId: result.groundStaff._id, mobileNumber: result.groundStaff.number, agencyId: result.groundStaff.agencyId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    console.log("[loginGroundStaff] Token generated successfully.");

    // Send success response with token
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      groundStaff: {
        id: result.groundStaff._id,
        name: result.groundStaff.name,
        number: result.groundStaff.number,
        agencyId: result.groundStaff.agencyId,
      },
    });
  } catch (error) {
    console.error("[loginGroundStaff] Error:", error.message);
    return res.status(401).json({
      success: false,
      message: error.message || "Login failed.",
    });
  }
}

async function getGroundStaffTasks(req, res) {
  try {
    console.log("[getGroundStaffTasks] Function called");
    const { agencyId } = req.params;
    const groundStaffId = req.headers["x-groundstaff-id"]; // Get from header

    if (!agencyId) {
      console.warn("[getGroundStaffTasks] Missing agencyId");
      return res.status(400).json({
        success: false,
        message: "Agency ID is required.",
      });
    }

    if (!groundStaffId) {
      console.warn("[getGroundStaffTasks] Missing groundStaffId");
      return res.status(400).json({
        success: false,
        message: "Ground Staff ID is required.",
      });
    }

    console.log("[getGroundStaffTasks] Fetching tasks for agencyId:", agencyId, "groundStaffId:", groundStaffId);

    // Call the model function to fetch tasks assigned to this specific groundstaff
    const tasks = await AgencyModel.getTasksForAgency(agencyId, groundStaffId);

    console.log("[getGroundStaffTasks] Tasks fetched successfully:", tasks.length);

    // Send success response
    return res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error("[getGroundStaffTasks] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch tasks.",
    });
  }
}

async function getGroundStaffByAgency(req, res) {
  try {
    const { agencyId } = req.params;

    // Log the incoming request parameters
    console.log("[getGroundStaffByAgency] Request params:", req.params);

    // Validate agencyId
    if (!agencyId || typeof agencyId !== "string" || agencyId.trim() === "") {
      console.warn("[getGroundStaffByAgency] Invalid agencyId:", agencyId);
      return res.status(400).json({
        success: false,
        message: "Invalid agencyId. AgencyId must be a non-empty string.",
      });
    }

    console.log("[getGroundStaffByAgency] Fetching ground staff for agencyId:", agencyId);

    // Call the model function to fetch ground staff
    const groundStaff = await AgencyModel.getGroundStaffByAgencyId(agencyId);

    // Check if ground staff data is empty or not found
    if (!groundStaff || groundStaff.length === 0) {
      console.warn("[getGroundStaffByAgency] No ground staff found for agencyId:", agencyId);
      return res.status(404).json({
        success: false,
        message: "No ground staff found for the given agency ID.",
      });
    }

    // Log the fetched ground staff data
    console.log("[getGroundStaffByAgency] Ground staff fetched successfully:", groundStaff);

    // Send success response
    return res.status(200).json({
      success: true,
      data: groundStaff,
    });
  } catch (error) {
    // Log the error details
    console.error("[getGroundStaffByAgency] Error occurred:", error);

    // Send internal server error response
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ground staff. Please try again later.",
    });
  }
}

// New agency endpoints
async function listAgencies(req, res) {
  try {
    const { eventResponsibleFor, type } = req.query;
    const agencies = await AgencyModel.listAgencies({ eventResponsibleFor, type });
    return res.status(200).json({ success: true, data: agencies });
  } catch (err) {
    console.error('[listAgencies] Error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function getAgencyById(req, res) {
  try {
    const { agencyId } = req.params;
    if (!agencyId) return res.status(400).json({ success: false, message: 'agencyId required' });
    const agency = await AgencyModel.findAgencyByAgencyId(agencyId);
    if (!agency) return res.status(404).json({ success: false, message: 'Agency not found' });
    delete agency.password;
    return res.status(200).json({ success: true, data: agency });
  } catch (err) {
    console.error('[getAgencyById] Error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function updateAgency(req, res) {
  try {
    const { agencyId } = req.params;
    const updates = req.body;
    if (!agencyId) return res.status(400).json({ success: false, message: 'agencyId required' });
    const ok = await AgencyModel.updateAgency(agencyId, updates);
    if (!ok) return res.status(404).json({ success: false, message: 'Agency not found or nothing updated' });
    return res.status(200).json({ success: true, message: 'Agency updated' });
  } catch (err) {
    console.error('[updateAgency] Error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function deleteAgency(req, res) {
  try {
    const { agencyId } = req.params;
    if (!agencyId) return res.status(400).json({ success: false, message: 'agencyId required' });
    const ok = await AgencyModel.deleteAgency(agencyId);
    if (!ok) return res.status(404).json({ success: false, message: 'Agency not found' });
    return res.status(200).json({ success: true, message: 'Agency deleted' });
  } catch (err) {
    console.error('[deleteAgency] Error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function searchAgencies(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = req.query.radius ? Number(req.query.radius) : 1000;
    const mode = req.query.mode || 'location';

    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ success: false, message: 'lat and lng query params required' });

    const agencies = await AgencyModel.searchAgenciesByPoint(lat, lng, radius, mode);
    return res.status(200).json({ success: true, data: agencies });
  } catch (err) {
    console.error('[searchAgencies] Error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  createAgency,
  
  getAgencyDashboard,
  // getEventStatus,
  updateEvenstStatus,
  getEventsById,
  loginAgency,
  loginGroundStaff,
  allImage,
  getEventReport,
  getGroundStaffByAgency,
  getGroundStaffTasks,
  logoutAgency, 
  // addGroundStaff,
  // deleteIncident,
  resetPasswordAgency,
  requestOtpAgency,
  addNewGroundStaff,
  // new
  listAgencies,
  getAgencyById,
  updateAgency,
  deleteAgency,
  searchAgencies

//   getGroundStaff,
};