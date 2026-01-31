const { uploadImageToS3, getFileUrl } = require("../services/minio.service");
// const os = require("os");
// const piexif = require("piexifjs");
const Camera = require("../models/camera.model");
const amqp = require("amqplib");
const { OUTPUT_QUEUE, IP } = require("../config");
 
// function getLocalIPAddress() {
//   const interfaces = os.networkInterfaces();
//   for (const name of Object.keys(interfaces)) {
//     for (const iface of interfaces[name]) {
//       if (iface.family === "IPv4" && !iface.internal) {
//         return iface.address;
//       }
//     }
//   }
//   return "localhost"; // fallback
// }



    //  const queueName = 'image_queue';
    //  const queueName = "image-queue";
//     const rabbitmqHost = "192.168.192.177";
//   // const rabbitmqHost = getLocalIPAddress(); // Use local IP address
//   //  const rabbitmqPort = "5672";
// //Function to Push the data to RabbitMq

const rabbitmqHosts = [
  IP, // Primary
  'localhost',        // Fallback 1
  'rabbitmq'          // Fallback 2 (Docker service name)
];

const connectToRabbitMQ = async () => {
  for (const host of rabbitmqHosts) {
    const url = `amqp://${host}:5672`;
    try {
      console.log(`🔌 Trying to connect to RabbitMQ at ${url}`);
      const connection = await amqp.connect(url);
      console.log(`✅ Connected to RabbitMQ at ${host}`);
      return connection;
    } catch (err) {
      console.warn(`⚠️ Failed to connect to ${host}:`, err.message);
    }
  }
  throw new Error("❌ Could not connect to any RabbitMQ host.");
};
const PushToQueue = async (data) => {
  // console.log("📡 Connecting to RabbitMQ at:", rabbitmqHosts);
  // console.log(data);

  try {
      //  const connection = await amqp.connect(`amqp://rabbitmq`);
        // const connection = await amqp.connect(`amqp://localhost`);
        //  const connection = await amqp.connect(`amqp://${rabbitmqHost}:5672`);
        const connection = await connectToRabbitMQ();
        //  const connection = await amqp.connect(`amqp://${rabbitmqHost}:${rabbitmqPort}`);
      const channel = await connection.createChannel();
      await channel.assertQueue(OUTPUT_QUEUE, { durable: false });

      
      // ✅ Attach EXIF data to the message payload
      const messagePayload = {
          ...data,
            // ✅ Now properly included
      };

      let response = channel.sendToQueue(
          OUTPUT_QUEUE,
          Buffer.from(JSON.stringify(messagePayload)),
          { persistent: true }
      );

      console.log("📤 Message pushed to queue with EXIF data:", response);

      await channel.close();
      await connection.close();

      return true;
  } catch (error) {
      console.error("❌ Error pushing data to Queue:", error);
  }
};


const uploadImage = async (req, res) => {
  try {
    const { base64String, userId, location, timestamp } = req.body;

    if (!base64String) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // console.log("🟢 Request Body:", req.body);

    // ✅ Ensure location exists and is properly formatted
    if (!location || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      console.error("❌ Error: Invalid location format received:", location);
      return res.status(400).json({ error: "Invalid location format" });
    }

    const [longitude, latitude] = location.coordinates;

    if (typeof latitude !== "number" || typeof longitude !== "number" || isNaN(latitude) || isNaN(longitude)) {
      console.error("❌ Error: Invalid latitude or longitude received:", latitude, longitude);
      return res.status(400).json({ error: "Invalid latitude or longitude" });
    }

    // console.log("📍 Processed Location Data:", { type: "Point", coordinates: [longitude, latitude] });

    //✅ Push image data to RabbitMQ
    const queuePushed = await PushToQueue({
      userId,
      location: { type: "Point", coordinates: [longitude, latitude] },
      timestamp,
      base64String,
    });
    

    
    if (!queuePushed) {
      return res.status(500).json({ error: "Failed to push image data to queue" });
    }

    // const queuePushed = await PushToQueue(
    //   JSON.stringify({
    //     userId: userId,  // Directly passing values
    //     location: { type: "Point", coordinates: [longitude, latitude] }, // Proper object format
    //     timestamp: timestamp,
    //     base64String: base64String
    //   })
    // );
    
    
    // if (!queuePushed) {
    //   return res.status(500).json({ error: "Failed to push image data to queue" });
    // }

    // ✅ Save image data in MongoDB
    const { imageId, incidentId } = await Camera.saveImageData({
      userId,
      location: { type: "Point", coordinates: [longitude, latitude] },
      timestamp,
      base64String,
    });

    res.status(200).json({ imageId, incidentId });
  } catch (error) {
    console.error("❌ Error uploading image:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
};





const getAllincdents = async (req, res) => {
  try {
    // Fetch all incident data from the database
    const incidents = await Camera.getAllImages();

    if (!incidents || incidents.length === 0) {
      return res.status(404).json({ error: "No incidents found" });
    }

    res.status(200).json(incidents);
  } catch (error) {
    console.error("❌ Error fetching incidents:", error);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
};

module.exports = { uploadImage, getAllincdents }; 

