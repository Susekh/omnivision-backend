const { uri } = require("../config.js");
const { MongoClient, ObjectId } = require("mongodb");
// const ExifParser = require("exif-parser");

// const uri = process.env.DB_CONNECT;
const client = new MongoClient(uri);


async function getImageCollection() {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
  const db = client.db("billoneyedata");
  return db.collection("events");
}

async function saveImageData(imageData) {
  const collection = await getImageCollection();
  // console.log("[saveImageData] Accessed image collection.", imageData);

  const incidentId = new ObjectId().toString();

  // ✅ Ensure correct GeoJSON format
  const longitude = parseFloat(imageData.location?.coordinates?.[0]);
  const latitude = parseFloat(imageData.location?.coordinates?.[1]);

  if (isNaN(longitude) || isNaN(latitude)) {
    console.error("❌ Error: Invalid longitude/latitude in saveImageData:", longitude, latitude);
    throw new Error("Invalid location data: longitude/latitude are not valid numbers");
  }

  const newImage = {
    incidentID: incidentId,
    userId: imageData.userId || null,
    location: {
      type: "Point",
      coordinates: [longitude, latitude], // ✅ Ensure correct format
    },
    timestamp: new Date(imageData.timestamp) || new Date(),
    imageUrl: imageData.imageUrl || null,
    exif: imageData.exif || {},
    status: imageData.status || "pending",
  };

  const result = await collection.insertOne(newImage);
  return { imageId: result.insertedId, incidentId };
}


async function getLatestImage() {
  const collection = await getImageCollection();
  return await collection.find({}).sort({ timestamp: -1 }).limit(3).toArray();
}

// async function getImagesByStatus(status) {
//   const collection = await getImageCollection();
//   return await collection.find({ status }).sort({ timestamp: -1 }).toArray();
// }


module.exports = {
  saveImageData,
  // extractExifMetadata,
  getLatestImage,
  // getImagesByStatus,
  getImageCollection,
};


// async function extractExifMetadata(imageBuffer) {
//   try {
//     const parser = ExifParser.create(imageBuffer);
//     const result = parser.parse();
//     return {
//       latitude: result.tags.GPSLatitude || null,
//       longitude: result.tags.GPSLongitude || null,
//       timestamp: result.tags.DateTimeOriginal || null,
//       cameraModel: result.tags.Model || null,
//       make: result.tags.Make || null,
//     };
//   } catch (error) {
//     console.error("[extractExifMetadata] Error extracting EXIF data:", error);
//     return {};
//   }
// }


// async function saveImageData(imageData) {
//   const collection = await getImageCollection();
//   console.log("[saveImageData] Accessed image collection.",imageData);

//   // ✅ Generate Unique Incident ID

//   const incidentId = new ObjectId().toString(); // Generate a unique incidentId


//   // // ✅ Extract EXIF data
//   // const exifData = await getExifData(location,timestamp,);
//   // console.log("[saveImageData] EXIF Data:", exifData);
//   const newImage = {
//     incidentID: incidentId,
     
//     latitude: imageData.latitude,
//     longitude: imageData.longitude,
//     timestamp: new Date(imageData.timestamp),
//     imageUrl: imageData.imageUrl,
//      exif: exifData,
//   };
//   console.log("[saveImageData] Image data:", newImage);

//   const result = await collection.insertOne(newImage);
//   console.log("[saveImageData] Image data inserted:", {
//     imageId: result.insertedId,
//     imageUrl: imageData.imageUrl,
//     incidentID: incidentId,
//   });

//   return result.insertedId;
// }





// async function getAllImages() {
//   try {
//       const collection = await getImageCollection();
//       const latestImage = await collection
//           .find()
//           .sort({ "timestamp.$date": -1 }) // Sort by timestamp in descending order
//           .limit(1) // Get only the latest record
//           .toArray();

//       return latestImage[0] || null; // Return first result or null if empty
//   } catch (error) {
//       console.error("[getLatestImage] Error:", error.message);
//       throw error;
//   }
// }


// async function getAllImages() {
//   const collection = await getImageCollection();
//   return await collection.find({}).toArray();
// }
