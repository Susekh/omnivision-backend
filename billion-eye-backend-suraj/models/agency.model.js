const { uri } = require("../config.js");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const { getLocalIpAddress } = require("../utlils/network");
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key"; // Use a secure secret key
const JWT_EXPIRATION = "1h"; // Token expiration time (e.g., 1 hour)
const sharp = require('sharp');
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
  httpOptions:{
    timeout:200
  }
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

  async createAgencyInDB(AgencyName, mobileNumber, password, location = {}, eventResponsibleFor = [], jurisdiction = null) {
    console.log("[createAgencyInDB] Function called with parameters:", {
      AgencyName,
      mobileNumber,
      location,
      eventResponsibleFor,
      jurisdiction,
    });
  
    // Validate mobile number
    if (!/^\d{10}$/.test(mobileNumber)) {
      console.error("[createAgencyInDB] Invalid mobile number:", mobileNumber);
      throw new Error("Invalid mobile number. Must be exactly 10 digits.");
    }
  
    // Hash the password
    console.log("[createAgencyInDB] Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("[createAgencyInDB] Password hashed successfully.");
  
    // Generate AgencyId
    const AgencyId = `agency-${Math.floor(1000 + Math.random() * 9000)}`;
    console.log("[createAgencyInDB] Generated AgencyId:", AgencyId);
  
    // Validate location
    if (location && (location.latitude !== undefined || location.longitude !== undefined)) {
      console.log("[createAgencyInDB] Validating location:", location);
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number"
      ) {
        console.error("[createAgencyInDB] Invalid location:", location);
        throw new Error("Invalid location. Latitude and Longitude must be numbers.");
      }
    }

    // Validate eventResponsibleFor
    if (!Array.isArray(eventResponsibleFor)) {
      throw new Error("eventResponsibleFor must be an array of strings");
    }

    // Prepare GeoJSON for location (if provided)
    let locationGeo = null;
    if (location && location.latitude !== undefined && location.longitude !== undefined) {
      locationGeo = {
        type: "Point",
        coordinates: [Number(location.longitude), Number(location.latitude)], // GeoJSON expects [lng, lat]
      };
    }

    // Validate and normalize jurisdiction GeoJSON (if provided)
    let jurisdictionGeo = null;
    if (jurisdiction) {
      if (!jurisdiction.type || !jurisdiction.coordinates) {
        throw new Error("Invalid jurisdiction GeoJSON");
      }

      // Normalize coordinates to [lng, lat] pairs if they're provided as [lat, lng]
      try {
        const coords = jurisdiction.coordinates;
        // Expecting a Polygon - coordinates[0] is ring
        jurisdictionGeo = {
          type: jurisdiction.type,
          coordinates: coords.map((ring) =>
            ring.map((pair) => {
              if (pair.length !== 2) throw new Error("Invalid coordinate pair in jurisdiction");
              const [a, b] = pair;
              // Heuristic: if lat looks like  -90..90 and lon looks like -180..180
              if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
                // assume [lat, lng] -> convert
                return [Number(b), Number(a)];
              }
              return [Number(a), Number(b)];
            })
          ),
        };
      } catch (err) {
        console.error("[createAgencyInDB] Jurisdiction normalization failed:", err.message);
        throw new Error("Invalid jurisdiction coordinates");
      }
    }

    // Determine agency type
    const type = jurisdictionGeo ? "jurisdiction" : "location";

    // Prepare agency object
    const agency = {
      AgencyId,
      AgencyName,
      mobileNumber,
      password: hashedPassword,
      location: {
        latitude: location.latitude || null,
        longitude: location.longitude || null,
      },
      locationGeo,
      eventResponsibleFor: eventResponsibleFor || [],
      jurisdiction: jurisdictionGeo,
      type,
      createdAt: new Date(),
    };
    console.log("[createAgencyInDB] Agency object prepared:", agency);
  
    try {
      // Insert agency into the database
      console.log("[createAgencyInDB] Connecting to agency collection...");
      const agencyCollection = await getAgencyCollection();

      // Ensure indexes for geo queries
      await agencyCollection.createIndex({ locationGeo: "2dsphere" });
      await agencyCollection.createIndex({ jurisdiction: "2dsphere" });

      console.log("[createAgencyInDB] Inserting agency into the database...");
      const insertResult = await agencyCollection.insertOne(agency);
  
      console.log("[createAgencyInDB] New agency inserted successfully:", {
        AgencyId,
        insertedId: insertResult.insertedId,
      });
  
      return AgencyId;
    } catch (err) {
      console.error("[createAgencyInDB] Database Insert Error:", err);
      throw new Error("Failed to insert agency into the database.");
    }
  },


  async agencyLogin(mobileNumber, password) {
    console.log("[agencyLogin] Function called with parameters:", {
      mobileNumber,
    });

    try {
      // Validate mobile number
      if (!/^\d{10}$/.test(mobileNumber)) {
        console.error("[agencyLogin] Invalid mobile number:", mobileNumber);
        throw new Error("Invalid mobile number. Must be exactly 10 digits.");
      }

      // Connect to the agency collection
      console.log("[agencyLogin] Connecting to agency collection...");
      const agencyCollection = await getAgencyCollection();

      // Find the agency by mobile number
      console.log("[agencyLogin] Searching for agency with mobile number:", mobileNumber);
      const agency = await agencyCollection.findOne({ mobileNumber });

      if (!agency) {
        console.error("[agencyLogin] No agency found with mobile number:", mobileNumber);
        throw new Error("Invalid mobile number or password.");
      }

      // Compare the provided password with the hashed password
      console.log("[agencyLogin] Comparing passwords...");
      const isPasswordValid = await bcrypt.compare(password, agency.password);

      if (!isPasswordValid) {
        console.error("[agencyLogin] Invalid password for mobile number:", mobileNumber);
        throw new Error("Invalid mobile number or password.");
      }

      console.log("[agencyLogin] Login successful for AgencyId:", agency.AgencyId);

      // Generate JWT token
      const token = jwt.sign(
        { AgencyId: agency.AgencyId, mobileNumber: agency.mobileNumber },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      console.log("[agencyLogin] Token generated successfully.");

      // Return agency details and token
      return {
        success: true,
        message: "Login successful.",
        token, // Include the token in the response
        agency: {
          AgencyId: agency.AgencyId,
          AgencyName: agency.AgencyName,
          mobileNumber: agency.mobileNumber,
          location: agency.location,
          createdAt: agency.createdAt,
        },
      };
    } catch (err) {
      console.error("[agencyLogin] Error:", err.message);
      throw new Error(err.message || "Failed to login.");
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
  
      console.log("[addGroundStaff] Inserting ground staff into the database...");
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
      console.log("[getGroundStaffByAgencyId] Fetching ground staff for agencyId:", agencyId);
        
      // Validate agencyId
      if (!agencyId || typeof agencyId !== "string" || agencyId.trim() === "") {
        throw new Error("Invalid agencyId. AgencyId must be a non-empty string.");
      }
  
      // Connect to the ground_staff collection
      const groundStaffCollection = await getGroundStaffCollection();
  
      // Query the collection for ground staff with the given agencyId
      const groundStaff = await groundStaffCollection.find({ agencyId }).toArray();
  
      console.log("[getGroundStaffByAgencyId] Found ground staff:", groundStaff);
  
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
          { projection: { AgencyName: 1, AgencyId: 1, _id: 0 } }
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

          let originalImageUrl = firstIncident?.image_url || event.image_url || null;
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
                    console.error(`[ERROR] S3 Bucket does not exist: ${params.Bucket}`);
                  } else {
                    console.error(`[ERROR] S3 getObject failed: ${err.message}`);
                  }
                }
              }
            } catch (err) {
              console.warn(`[WARN] Invalid originalImageUrl format: ${originalImageUrl}`, err.message);
            }
          }

          let boundingBoxes = firstIncident?.bounding_boxes || event.bounding_boxes || [];
          if (!Array.isArray(boundingBoxes)) boundingBoxes = [];
          const [x1, y1, x2, y2] = boundingBoxes[0] || [];

          const allIncidents = await Promise.all(
            (event.incidents || []).map(async (incident) => {
              const incidentBoundingBoxes = incident.bounding_boxes || [];
              const [ix1, iy1, ix2, iy2] = incidentBoundingBoxes[0] || [];
              let incidentProxyImageUrl = incident.image_url || null;

              if (incidentProxyImageUrl && incidentProxyImageUrl.startsWith("http")) {
                try {
                  const urlParts = new URL(incidentProxyImageUrl);
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
            })
          );

          return {
            event_id: event.event_id,
            description: event.description,
            status: event.status,
            assignment_time: firstIncident?.timestamp?.$date || event.assignment_time || null,
            latitude: firstIncident?.location?.coordinates?.[1] || event.location?.coordinates?.[1] || null,
            longitude: firstIncident?.location?.coordinates?.[0] || event.location?.coordinates?.[0] || null,
            image_url: proxyImageUrl,
            ground_staff: event.ground_staff || [],
            incidentID: event.incidentID || null,
            userId: event.userId || null,
            exif: event.exif || null,
            timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
            assigned_agency: event.assigned_agency || event.assigned_agencies || null,
            boundingBoxes,
            x1,
            y1,
            x2,
            y2,
            allIncidents,
          };
        })
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

  async updateEventStatus(event_id, newStatus, groundStaffName = null, assignmentTime = null) {
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
      { $set: updateFields }
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
        { projection: { status: 1, _id: 0, incidents: 1 , description: 1 , timestamp:1 ,image_url : 1 , location : 1} }
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

          const boxes = Array.isArray(incident.bounding_boxes) ? incident.bounding_boxes : [];
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
        })
      );
    } catch (error) {
      console.error("Unexpected error in getIncidentImages:", error.message);
      throw new Error("Error processing incident images");
    }
  },

  async getEventReportId(event_id, fields = [], includeImageUrl = true, currentAgencyId = null) {
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
            latitude: { $arrayElemAt: ["$firstIncident.location.coordinates", 1] },
            longitude: { $arrayElemAt: ["$firstIncident.location.coordinates", 0] },
            incidents: {
                $map: {
                    input: "$incidents",
                    as: "incident",
                    in: {
                        latitude: { $arrayElemAt: ["$$incident.location.coordinates", 1] },
                        longitude: { $arrayElemAt: ["$$incident.location.coordinates", 0] },
                        timestamp: "$$incident.timestamp",
                        image_url: "$$incident.image_url",
                        boundingBoxes: "$$incident.bounding_boxes",
                    },
                },
            },
            assignedAgency: {
                $ifNull: [{ $arrayElemAt: ["$assignedAgencyDetails.AgencyName", 0] }, null],
            },
            AgencyId: {
                $ifNull: [{ $arrayElemAt: ["$assignedAgencyDetails.AgencyId", 0] }, null],
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
        if (currentAgencyId && !event.assigned_agency.agencies.includes(currentAgencyId)) {
            throw new Error("Agency mismatch: The current agency is not assigned to this event.");
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
}
,

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
    const res = await col.updateOne({ AgencyId }, { $set: { password: hashedPassword } });
    return res.modifiedCount > 0;
  },

  async updateAgency(AgencyId, updates = {}) {
    if (!AgencyId) throw new Error("AgencyId required");
    const col = await getAgencyCollection();

    // Normalize jurisdiction if present
    if (updates.jurisdiction) {
      const j = updates.jurisdiction;
      updates.jurisdiction = {
        type: j.type,
        coordinates: j.coordinates.map((ring) => ring.map((pair) => {
          const [a, b] = pair;
          if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [Number(b), Number(a)];
          return [Number(a), Number(b)];
        }))
      };
      updates.type = "jurisdiction";
    }

    // Update location and GeoJSON
    if (updates.location && updates.location.latitude !== undefined && updates.location.longitude !== undefined) {
      updates.locationGeo = { type: "Point", coordinates: [Number(updates.location.longitude), Number(updates.location.latitude)] };
      updates.type = updates.type || "location";
    }

    const res = await col.updateOne({ AgencyId }, { $set: updates });
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

  async searchAgenciesByPoint(lat, lng, radiusMeters = 1000, mode = "location") {
    const col = await getAgencyCollection();
    const point = { type: "Point", coordinates: [Number(lng), Number(lat)] };

    if (mode === "location") {
      return await col.find({ locationGeo: { $nearSphere: { $geometry: point, $maxDistance: Number(radiusMeters) } } }).project({ password: 0 }).toArray();
    }

    // jurisdiction - find polygons containing the point
    return await col.find({ jurisdiction: { $geoIntersects: { $geometry: point } } }).project({ password: 0 }).toArray();
  }
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