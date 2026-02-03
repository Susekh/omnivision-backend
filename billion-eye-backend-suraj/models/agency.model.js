const { uri } = require("../config.js");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const { getLocalIpAddress } = require("../utlils/network");
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key"; // Use a secure secret key
const JWT_EXPIRATION = "1h"; // Token expiration time (e.g., 1 hour)
const sharp = require("sharp");
// MongoDB client setup
const client = new MongoClient(uri);

// AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  endpoint: process.env.AWS_S3_ENDPOINT,
  region: process.env.AWS_REGION, // Add this line
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  httpOptions: {
    timeout: 200,
  },
});

// Helper functions to get MongoDB collections
async function getAgencyCollection() {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  const db = client.db("BillionEyes_V1");
  return db.collection("agencies");
}

async function getCriticalCollection() {
  const db = client.db("BillionEyes_V1");
  return db.collection("critical_agencies");
}

async function getNonCriticalCollection() {
  const db = client.db("BillionEyes_V1");
  return db.collection("non_critical_agencies");
}

async function getGroundStaffCollection() {
  const db = client.db("BillionEyes_V1");
  return db.collection("ground_staff");
}

// Agency Model
const AgencyModel = {
  async createAgencyInDB(
    AgencyName,
    mobileNumber,
    password,
    location,
    eventResponsibleFor = [],
    jurisdiction = null,
  ) {
    console.log("[createAgencyInDB] Function called with parameters:", {
      AgencyName,
      mobileNumber,
      location,
      eventResponsibleFor,
      jurisdiction,
    });

    // -------------------------
    // Validate mobile number
    // -------------------------
    if (!/^\d{10}$/.test(mobileNumber)) {
      throw new Error("Invalid mobile number. Must be exactly 10 digits.");
    }

    // -------------------------
    // Validate location (MANDATORY)
    // -------------------------
    if (
      !location ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      throw new Error(
        "Location is required and must contain numeric latitude and longitude",
      );
    }

    // -------------------------
    // Validate eventResponsibleFor
    // -------------------------
    if (!Array.isArray(eventResponsibleFor)) {
      throw new Error("eventResponsibleFor must be an array");
    }

    // -------------------------
    // Hash password
    // -------------------------
    const hashedPassword = await bcrypt.hash(password, 10);

    // -------------------------
    // Generate AgencyId
    // -------------------------
    const AgencyId = `agency-${Math.floor(1000 + Math.random() * 9000)}`;

    // -------------------------
    // Optional jurisdiction (stored AS-IS)
    // -------------------------
    let jurisdictionGeo = null;

    if (jurisdiction) {
      if (
        jurisdiction.type !== "Polygon" ||
        !Array.isArray(jurisdiction.coordinates)
      ) {
        throw new Error("Invalid jurisdiction format");
      }

      jurisdiction.coordinates.forEach((pair) => {
        if (
          !Array.isArray(pair) ||
          pair.length !== 2 ||
          typeof pair[0] !== "number" ||
          typeof pair[1] !== "number"
        ) {
          throw new Error("Invalid coordinate pair in jurisdiction");
        }
      });

      jurisdictionGeo = {
        type: "Polygon",
        coordinates: jurisdiction.coordinates, // [lat, lng] flat array
      };
    }

    // -------------------------
    // Prepare agency object
    // -------------------------
    const agency = {
      AgencyId,
      AgencyName,
      mobileNumber,
      password: hashedPassword,

      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      jurisdiction: jurisdictionGeo, // optional

      eventResponsibleFor,
      createdAt: new Date(),
    };

    console.log("[createAgencyInDB] Agency object prepared:", agency);

    // -------------------------
    // Insert into DB
    // -------------------------
    try {
      const agencyCollection = await getAgencyCollection();

      const result = await agencyCollection.insertOne(agency);

      return AgencyId;
    } catch (err) {
      console.error("[createAgencyInDB] Database Insert Error:", err);
      throw new Error("Failed to insert agency into the database.");
    }
  },

  async agencyLogin(mobileNumber, password) {
    console.log("[agencyLogin] Login attempt:", { mobileNumber });

    // -------------------------
    // Basic validation
    // -------------------------
    if (!/^\d{10}$/.test(mobileNumber)) {
      throw new Error("Invalid mobile number or password.");
    }

    if (!password || typeof password !== "string") {
      throw new Error("Invalid mobile number or password.");
    }

    try {
      const agencyCollection = await getAgencyCollection();

      const agency = await agencyCollection.findOne({ mobileNumber });

      // Do NOT reveal whether user exists
      if (!agency || !agency.password) {
        throw new Error("Invalid mobile number or password.");
      }

      // -------------------------
      // Password verification
      // -------------------------
      let isPasswordValid = false;

      // Normal case: bcrypt hash
      if (agency.password.startsWith("$2")) {
        isPasswordValid = await bcrypt.compare(password, agency.password);
      } else {
        // SAFETY NET (for old bad data)
        isPasswordValid = agency.password === password;

        // OPTIONAL: auto-fix bad stored password
        if (isPasswordValid) {
          const hashed = await bcrypt.hash(password, 10);
          await agencyCollection.updateOne(
            { AgencyId: agency.AgencyId },
            { $set: { password: hashed } },
          );
        }
      }

      if (!isPasswordValid) {
        throw new Error("Invalid mobile number or password.");
      }

      // -------------------------
      // Generate JWT
      // -------------------------
      const token = jwt.sign(
        {
          AgencyId: agency.AgencyId,
          mobileNumber: agency.mobileNumber,
          role: "agency",
          v: 1, // token version
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION },
      );

      // -------------------------
      // Success response
      // -------------------------
      return {
        success: true,
        message: "Login successful",
        token,
        agency: {
          AgencyId: agency.AgencyId,
          AgencyName: agency.AgencyName,
          mobileNumber: agency.mobileNumber,
          location: agency.location,
          jurisdiction: agency.jurisdiction || null,
          createdAt: agency.createdAt,
        },
      };
    } catch (err) {
      console.error("[agencyLogin] Error:", err.message);

      // Always return generic auth error
      throw new Error("Invalid mobile number or password.");
    }
  },
  async logout(token) {
    try {
      // Invalidate the token (optional: store invalidated tokens in a blacklist)
      console.log("[logout] Invalidating token:", token);

      // If using a blacklist, add the token to it
      // Example: await addToBlacklist(token);

      return {
        success: true,
        message: "Logout successful. Token invalidated.",
      };
    } catch (err) {
      console.error("[logout] Error:", err.message);
      throw new Error(err.message || "Failed to logout.");
    }
  },

  async addGroundStaff(name, number, address, agencyId) {
    console.log("[addGroundStaff] Function called with parameters:", {
      name,
      number,
      address,
      agencyId, // Include agencyId in the log
    });

    // Validate input
    if (!name || typeof name !== "string") {
      console.error("[addGroundStaff] Invalid name:", name);
      throw new Error("Invalid name. Name must be a non-empty string.");
    }

    if (!/^\d{10}$/.test(number)) {
      console.error("[addGroundStaff] Invalid number:", number);
      throw new Error("Invalid number. Must be exactly 10 digits.");
    }

    if (!address || typeof address !== "string") {
      console.error("[addGroundStaff] Invalid address:", address);
      throw new Error("Invalid address. Address must be a non-empty string.");
    }

    if (!agencyId || typeof agencyId !== "string") {
      console.error("[addGroundStaff] Invalid agencyId:", agencyId);
      throw new Error("Invalid agencyId. AgencyId must be a non-empty string.");
    }

    const groundStaff = {
      name,
      number,
      address,
      agencyId, // Include agencyId in the groundStaff object
      createdAt: new Date(),
    };

    try {
      console.log("[addGroundStaff] Connecting to ground staff collection...");
      const groundStaffCollection = await getGroundStaffCollection();

      console.log(
        "[addGroundStaff] Inserting ground staff into the database...",
      );
      const insertResult = await groundStaffCollection.insertOne(groundStaff);

      console.log("[addGroundStaff] Ground staff added successfully:", {
        insertedId: insertResult.insertedId,
      });

      return {
        success: true,
        message: "Ground staff added successfully.",
        groundStaffId: insertResult.insertedId,
      };
    } catch (err) {
      console.error("[addGroundStaff] Database Insert Error:", err);
      throw new Error("Failed to add ground staff to the database.");
    }
  },

  async getGroundStaffByAgencyId(agencyId) {
    try {
      console.log(
        "[getGroundStaffByAgencyId] Fetching ground staff for agencyId:",
        agencyId,
      );

      // Validate agencyId
      if (!agencyId || typeof agencyId !== "string" || agencyId.trim() === "") {
        throw new Error(
          "Invalid agencyId. AgencyId must be a non-empty string.",
        );
      }

      // Connect to the ground_staff collection
      const groundStaffCollection = await getGroundStaffCollection();

      // Query the collection for ground staff with the given agencyId
      const groundStaff = await groundStaffCollection
        .find({ agencyId })
        .toArray();

      console.log(
        "[getGroundStaffByAgencyId] Found ground staff:",
        groundStaff,
      );

      return groundStaff;
    } catch (error) {
      console.error("[getGroundStaffByAgencyId] Error:", error.message);
      throw new Error("Failed to fetch ground staff by agency ID.");
    }
  },

  async getAgencyDashboardCheck(agencyId) {
    try {
      if (!agencyId) throw new Error("Agency ID is required.");
      agencyId = String(agencyId);

      const db = client.db("BillionEyes_V1");

      const agency = await db
        .collection("agencies")
        .findOne(
          { AgencyId: agencyId },
          { projection: { AgencyName: 1, AgencyId: 1, _id: 0 } },
        );

      if (!agency) throw new Error("Agency not found.");
      console.log("[DEBUG] Found agency:", agency);

      const assignedEvents = await db
        .collection("events")
        .find({
          $or: [
            { "assigned_agency.agencies": agency.AgencyId },
            { "assigned_agencies.agencies": agency.AgencyId },
          ],
        })
        .project({
          _id: 0,
          event_id: 1,
          description: 1,
          assigned_agency: 1,
          assigned_agencies: 1,
          assignment_time: 1,
          ground_staff: 1,
          incidentID: 1,
          userId: 1,
          location: 1,
          timestamp: 1,
          image_url: 1,
          exif: 1,
          status: 1,
          incidents: 1,
          bounding_boxes: 1,
        })
        .toArray();

      const formattedEvents = await Promise.all(
        assignedEvents.map(async (event) => {
          const firstIncident = event.incidents?.[0] || null;

          let originalImageUrl =
            firstIncident?.image_url || event.image_url || null;
          let proxyImageUrl = originalImageUrl;

          if (originalImageUrl) {
            try {
              const urlParts = new URL(originalImageUrl);
              const pathSegments = urlParts.pathname.split("/").filter(Boolean);

              if (pathSegments.length >= 3) {
                const year = pathSegments[1];
                const filename = pathSegments.slice(2).join("/");
                const params = {
                  Bucket: "billion-eyes-images",
                  Key: `${year}/${filename}`,
                };

                try {
                  const data = await s3.getObject(params).promise();
                  if (data && data.Body) {
                    proxyImageUrl = `data:image/jpeg;base64,${data.Body.toString("base64")}`;
                  }
                } catch (err) {
                  if (err.code === "NoSuchBucket") {
                    console.error(
                      `[ERROR] S3 Bucket does not exist: ${params.Bucket}`,
                    );
                  } else {
                    console.error(
                      `[ERROR] S3 getObject failed: ${err.message}`,
                    );
                  }
                }
              }
            } catch (err) {
              console.warn(
                `[WARN] Invalid originalImageUrl format: ${originalImageUrl}`,
                err.message,
              );
            }
          }

          let boundingBoxes =
            firstIncident?.bounding_boxes || event.bounding_boxes || [];
          if (!Array.isArray(boundingBoxes)) boundingBoxes = [];
          const [x1, y1, x2, y2] = boundingBoxes[0] || [];

          const allIncidents = await Promise.all(
            (event.incidents || []).map(async (incident) => {
              const incidentBoundingBoxes = incident.bounding_boxes || [];
              const [ix1, iy1, ix2, iy2] = incidentBoundingBoxes[0] || [];
              let incidentProxyImageUrl = incident.image_url || null;

              if (
                incidentProxyImageUrl &&
                incidentProxyImageUrl.startsWith("http")
              ) {
                try {
                  const urlParts = new URL(incidentProxyImageUrl);
                  const pathSegments = urlParts.pathname
                    .split("/")
                    .filter(Boolean);

                  if (pathSegments.length >= 3) {
                    const year = pathSegments[1];
                    const filename = pathSegments.slice(2).join("/");

                    const params = {
                      Bucket: "billion-eyes-images",
                      Key: `${year}/${filename}`,
                    };

                    const data = await s3.getObject(params).promise();
                    if (data && data.Body) {
                      incidentProxyImageUrl = `data:image/jpeg;base64,${data.Body.toString("base64")}`;
                    }
                  }
                } catch (error) {
                  console.warn("Image fetch failed:", error.message);
                }
              }

              return {
                image_url: incidentProxyImageUrl,
                boundingBoxes: incidentBoundingBoxes,
                x1: ix1,
                y1: iy1,
                x2: ix2,
                y2: iy2,
              };
            }),
          );

          return {
            event_id: event.event_id,
            description: event.description,
            status: event.status,
            assignment_time:
              firstIncident?.timestamp?.$date || event.assignment_time || null,
            latitude:
              firstIncident?.location?.coordinates?.[1] ||
              event.location?.coordinates?.[1] ||
              null,
            longitude:
              firstIncident?.location?.coordinates?.[0] ||
              event.location?.coordinates?.[0] ||
              null,
            image_url: proxyImageUrl,
            ground_staff: event.ground_staff || [],
            incidentID: event.incidentID || null,
            userId: event.userId || null,
            exif: event.exif || null,
            timestamp:
              event.timestamp instanceof Date
                ? event.timestamp.toISOString()
                : event.timestamp,
            assigned_agency:
              event.assigned_agency || event.assigned_agencies || null,
            boundingBoxes,
            x1,
            y1,
            x2,
            y2,
            allIncidents,
          };
        }),
      );

      return {
        AgencyName: agency.AgencyName,
        AgencyId: agency.AgencyId,
        assignedEvents: formattedEvents,
      };
    } catch (error) {
      console.error("[ERROR] getAgencyDashboardCheck:", error.message);
      throw new Error(error.message);
    }
  },

  // Assuming 's3' is already initialized (e.g., const AWS = require('aws-sdk'); const s3 = new AWS.S3();)
  // And 'client' for MongoDB is also initialized.

  // async updateEventStatus(event_id, newStatus, groundStaffName = null) {
  //   try {
  //     const eventCollection = await this.getEventsCollection();

  //     // Prepare the update object
  //     const updateFields = { status: newStatus };
  //     if (newStatus === "Assigned" && groundStaffName) {
  //       updateFields.ground_staff = groundStaffName; // Add ground_staff name if status is "Assigned"
  //     }

  //     const result = await eventCollection.updateOne(
  //       { event_id: event_id },
  //       { $set: updateFields }
  //     );

  //     return result;
  //   } catch (error) {
  //     console.error("[updateEventStatus] Database Error:", error);
  //     throw new Error("Database Error");
  //   }
  // },

  async updateEventStatus(
    event_id,
    newStatus,
    groundStaffName = null,
    assignmentTime = null,
  ) {
    try {
      const eventCollection = await this.getEventsCollection();

      // Prepare the update object
      const updateFields = { status: newStatus };
      if (newStatus === "Assigned" && groundStaffName) {
        updateFields.ground_staff = groundStaffName; // Add ground_staff name if status is "Assigned"
        updateFields.assignment_time = assignmentTime || new Date(); // Add assignment_time
      }

      const result = await eventCollection.updateOne(
        { event_id: event_id },
        { $set: updateFields },
      );

      return result;
    } catch (error) {
      console.error("[updateEventStatus] Database Error:", error);
      throw new Error("Database Error");
    }
  },

  async getEventById(event_id) {
    try {
      const eventCollection = await this.getEventsCollection();
      return await eventCollection.findOne(
        { event_id: event_id },
        {
          projection: {
            status: 1,
            _id: 0,
            incidents: 1,
            description: 1,
            timestamp: 1,
            image_url: 1,
            location: 1,
          },
        },
      );
    } catch (error) {
      console.error("[getEventById] Database Error:", error);
      throw new Error("Database Error");
    }
  },

  async getEventsCollection() {
    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
    }
    const db = client.db("BillionEyes_V1");
    return db.collection("events");
  },

  async getIncidentImages(incidents = []) {
    try {
      return await Promise.all(
        incidents.map(async (incident) => {
          let base64Image = null;
          const originalUrl = incident.image_url || "";

          if (originalUrl.startsWith("http")) {
            try {
              const url = new URL(originalUrl);
              const parts = url.pathname.split("/").filter(Boolean);
              const year = parts[1];
              const filename = parts.slice(2).join("/");

              const s3Params = {
                Bucket: "billion-eyes-images",
                Key: `${year}/${filename}`,
              };

              const data = await s3.getObject(s3Params).promise();
              base64Image = `data:image/jpeg;base64,${data.Body.toString("base64")}`;
            } catch (err) {
              console.error("Image fetch error:", err.message);
            }
          }

          const boxes = Array.isArray(incident.bounding_boxes)
            ? incident.bounding_boxes
            : [];
          const [x1, y1, x2, y2] = boxes[0] || [null, null, null, null];

          return {
            latitude: incident.latitude || null,
            longitude: incident.longitude || null,
            timestamp: incident.timestamp || null,
            base64_image: base64Image,
            bounding_boxes: boxes,
            x1,
            y1,
            x2,
            y2,
          };
        }),
      );
    } catch (error) {
      console.error("Unexpected error in getIncidentImages:", error.message);
      throw new Error("Error processing incident images");
    }
  },

  async getEventReportId(
    event_id,
    fields = [],
    includeImageUrl = true,
    currentAgencyId = null,
  ) {
    try {
      const eventCollection = await this.getEventsCollection();

      const projection = {
        event_id: 1,
        assignment_time: 1,
        description: 1,
        ground_staff: 1,
        location: 1,
        assigned_agency: 1,
        bounding_boxes: 1,
        ...fields.reduce((acc, field) => ({ ...acc, [field]: 1 }), {}),
      };

      const pipeline = [
        { $match: { event_id } },
        {
          $addFields: {
            firstIncident: { $arrayElemAt: ["$incidents", 0] },
          },
        },
        {
          $lookup: {
            from: "agencies",
            localField: "assigned_agency.agencies",
            foreignField: "AgencyId",
            as: "assignedAgencyDetails",
          },
        },
        {
          $project: {
            ...projection,
            latitude: {
              $arrayElemAt: ["$firstIncident.location.coordinates", 1],
            },
            longitude: {
              $arrayElemAt: ["$firstIncident.location.coordinates", 0],
            },
            incidents: {
              $map: {
                input: "$incidents",
                as: "incident",
                in: {
                  latitude: {
                    $arrayElemAt: ["$$incident.location.coordinates", 1],
                  },
                  longitude: {
                    $arrayElemAt: ["$$incident.location.coordinates", 0],
                  },
                  timestamp: "$$incident.timestamp",
                  image_url: "$$incident.image_url",
                  boundingBoxes: "$$incident.bounding_boxes",
                },
              },
            },
            assignedAgency: {
              $ifNull: [
                { $arrayElemAt: ["$assignedAgencyDetails.AgencyName", 0] },
                null,
              ],
            },
            AgencyId: {
              $ifNull: [
                { $arrayElemAt: ["$assignedAgencyDetails.AgencyId", 0] },
                null,
              ],
            },
          },
        },
      ];

      const eventData = await eventCollection.aggregate(pipeline).toArray();
      if (eventData.length === 0) {
        console.warn("No event found for event_id:", event_id);
        return null;
      }

      const event = eventData[0];

      // Validate currentAgencyId
      if (
        currentAgencyId &&
        !event.assigned_agency.agencies.includes(currentAgencyId)
      ) {
        throw new Error(
          "Agency mismatch: The current agency is not assigned to this event.",
        );
      }

      const firstIncident = event.incidents?.[0] || null;

      let imageUrl = firstIncident?.image_url || event.image_url;

      if (includeImageUrl && imageUrl) {
        try {
          const urlParts = new URL(imageUrl);
          const pathSegments = urlParts.pathname.split("/").filter(Boolean);

          if (pathSegments.length >= 3) {
            const year = pathSegments[1];
            const filename = pathSegments.slice(2).join("/");

            const params = {
              Bucket: "billion-eyes-images",
              Key: `${year}/${filename}`,
            };

            const data = await s3.getObject(params).promise();
            if (data && data.Body) {
              imageUrl = `data:image/jpeg;base64,${data.Body.toString("base64")}`;
            }
          }
        } catch (error) {
          console.warn("Image fetch failed:", error.message);
          imageUrl = firstIncident?.image_url || event.image_url;
        }
      } else {
        imageUrl = null;
      }

      event.image_url = imageUrl;

      const boundingBoxes = firstIncident?.boundingBoxes || [];
      event.boundingBoxes = boundingBoxes;

      if (boundingBoxes.length > 0 && Array.isArray(boundingBoxes[0])) {
        const [x1, y1, x2, y2] = boundingBoxes[0];
        event.x1 = x1;
        event.y1 = y1;
        event.x2 = x2;
        event.y2 = y2;
      } else {
        event.x1 = event.y1 = event.x2 = event.y2 = null;
      }

      if (currentAgencyId) {
        event.AgencyId = currentAgencyId;
      }

      return {
        success: true,
        assignments_time: firstIncident?.timestamp || null,
        event_id: event.event_id,
        description: event.description,
        ground_staff: event.ground_staff || null,
        latitude: firstIncident?.latitude || null,
        longitude: firstIncident?.longitude || null,
        image_url: event.image_url,
        assignedAgency: event.assignedAgency || null,

        AgencyId: event.AgencyId || null,
      };
    } catch (err) {
      console.error("[getEventReportId] Database Error:", err);
      throw new Error("Database Error");
    }
  },
  // Additional helpers for agencies

  async findAgencyByAgencyId(AgencyId) {
    if (!AgencyId) throw new Error("AgencyId required");
    const col = await getAgencyCollection();
    return await col.findOne({ AgencyId });
  },

  async findOne(query) {
    const col = await getAgencyCollection();
    return await col.findOne(query);
  },

  async updatePassword(AgencyId, hashedPassword) {
    const col = await getAgencyCollection();
    const res = await col.updateOne(
      { AgencyId },
      { $set: { password: hashedPassword } },
    );
    return res.modifiedCount > 0;
  },

  async updateAgency(AgencyId, updates = {}) {
    if (!AgencyId) throw new Error("AgencyId required");

    const col = await getAgencyCollection();

    const $set = {};
    const $unset = {};

    // -------------------------
    // Agency name
    // -------------------------
    if (typeof updates.AgencyName === "string") {
      $set.AgencyName = updates.AgencyName;
    }

    // -------------------------
    // Mobile number
    // -------------------------
    if (updates.mobileNumber) {
      if (!/^\d{10}$/.test(updates.mobileNumber)) {
        throw new Error("Invalid mobile number");
      }
      $set.mobileNumber = updates.mobileNumber;
    }

    // -------------------------
    // Events
    // -------------------------
    if (Array.isArray(updates.eventResponsibleFor)) {
      $set.eventResponsibleFor = updates.eventResponsibleFor;
    }

    // -------------------------
    // Password (HASHED)
    // -------------------------
    if (updates.password) {
      $set.password = await bcrypt.hash(updates.password, 10);
    }

    // -------------------------
    // Location (lat/lng → location)
    // -------------------------
    if (typeof updates.lat === "number" && typeof updates.lng === "number") {
      $set.location = {
        latitude: Number(updates.lat),
        longitude: Number(updates.lng),
      };
    }

    // -------------------------
    // Jurisdiction (OPTIONAL)
    // -------------------------
    if (updates.jurisdiction) {
      if (
        updates.jurisdiction.type !== "Polygon" ||
        !Array.isArray(updates.jurisdiction.coordinates)
      ) {
        throw new Error("Invalid jurisdiction format");
      }

      updates.jurisdiction.coordinates.forEach(([lat, lng]) => {
        if (typeof lat !== "number" || typeof lng !== "number") {
          throw new Error("Invalid jurisdiction coordinates");
        }
      });

      $set.jurisdiction = {
        type: "Polygon",
        coordinates: updates.jurisdiction.coordinates, // flat [lat, lng]
      };
    }

    // Explicit removal
    if (updates.jurisdiction === null) {
      $unset.jurisdiction = "";
    }

    // -------------------------
    // Execute update
    // -------------------------
    const res = await col.updateOne(
      { AgencyId },
      {
        ...(Object.keys($set).length ? { $set } : {}),
        ...(Object.keys($unset).length ? { $unset } : {}),
      },
    );

    return res.modifiedCount > 0;
  },
  async deleteAgency(AgencyId) {
    if (!AgencyId) throw new Error("AgencyId required");
    const col = await getAgencyCollection();
    const res = await col.deleteOne({ AgencyId });
    return res.deletedCount > 0;
  },

  async listAgencies(filter = {}) {
    const col = await getAgencyCollection();
    const query = {};

    if (filter.eventResponsibleFor) {
      query.eventResponsibleFor = { $in: [filter.eventResponsibleFor] };
    }

    if (filter.type) {
      query.type = filter.type;
    }

    return await col.find(query).project({ password: 0 }).toArray();
  },
};

module.exports = AgencyModel;

// async updateOTP(mobileNumber, otp) {
//   const agencyCollection = await getAgencyCollection();
//   const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
//   const result = await agencyCollection.updateOne(
//     { mobileNumber },
//     { $set: { otp, otpExpires } }
//   );
//   console.log("[updateOTP] Updated agency OTP:", result.modifiedCount);
//   return result.modifiedCount > 0;
// }
