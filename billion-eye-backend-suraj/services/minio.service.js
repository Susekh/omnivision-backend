
// const Minio = require("minio");
// require("dotenv").config();

// // Initialize MinIO client
// const minioClient = new Minio.Client({
//   endPoint: process.env.MINIO_ENDPOINT,
//   port: parseInt(process.env.MINIO_PORT),
//   useSSL: process.env.MINIO_USE_SSL === "true",
//   accessKey: process.env.MINIO_ACCESS_KEY,
//   secretKey: process.env.MINIO_SECRET_KEY,
// });

// // Function to Upload Image to MinIO
// const uploadImageToS3 = async (fileData, bucketName, objectName) => {
//   try {
//     await minioClient.putObject(
//       bucketName,
//       objectName,
//       fileData.buffer,
//       fileData.size,
//       {
//         "Content-Type": fileData.mimetype,
//       }
//     );
//     console.log("✅ File uploaded to MinIO successfully.");
//     return { status: true, message: "File uploaded successfully." };
//   } catch (err) {
//     console.error("❌ MinIO Upload Error:", err);
//     return { status: false, message: "Failed to upload file!" };
//   }
// };

// // Function to Retrieve Object from MinIO
// const getObject = async (bucketName, key) => {
//   try {
//     const stream = await minioClient.getObject(bucketName, key);
//     //  No need to handle the stream here.  Return it to the controller.
//     return stream;
//   } catch (err) {
//     console.error("❌ GetObject error:", err);
//     return null; // Important: Return null for the controller to handle 404
//   }
// };

// // Function to Generate Presigned URL
// const getFileUrl = async (bucketName, objectName) => {
//   try {
//     const url = await minioClient.presignedUrl("GET", bucketName, objectName, 24 * 60 * 60);
//     return url;
//   } catch (error) {
//     console.error("❌ URL Generation Error:", error);
//     return null;
//   }
// };

// module.exports = { uploadImageToS3, getObject, getFileUrl };


const AWS = require('aws-sdk');
require('dotenv').config();

// Initialize AWS S3 client
// const s3 = new AWS.S3({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   endpoint: process.env.AWS_S3_ENDPOINT, // e.g., 'https://staas-bbs1.cloud.gov.in/'
//   s3ForcePathStyle: true,
//   signatureVersion: 'v4',
//   region: process.env.AWS_REGION || 'us-east-1', // if required
// });

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

// Upload File to S3
const uploadImageToS3 = async (fileData, bucketName, objectName) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: objectName,
      Body: fileData.buffer,
      ContentType: fileData.mimetype,
    };

    await s3.upload(params).promise();
    console.log("✅ File uploaded to S3 successfully.");
    return { status: true, message: "File uploaded successfully." };
  } catch (err) {
    console.error("❌ AWS S3 Upload Error:", err);
    return { status: false, message: "Failed to upload file!" };
  }
};

// Get File Object Stream
const getObject = async (bucketName, key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key,
    };
    return s3.getObject(params).createReadStream(); // return stream directly
  } catch (err) {
    console.error("❌ GetObject error:", err);
    return null;
  }
};

// Generate Presigned URL for Download
const getFileUrl = async (bucketName, objectName) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: objectName,
      Expires: 86400, // 24 hours
    };
    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error("❌ URL Generation Error:", error);
    return null;
  }
};

module.exports = { uploadImageToS3, getObject, getFileUrl };
