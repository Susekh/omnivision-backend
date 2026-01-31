module.exports = {
  IP : process.env.IP || "127.0.0.1",
  OUTPUT_QUEUE: process.env.OUTPUT_QUEUE || 'image_queue',
  uri: process.env.MONGO_URI || "mongodb://localhost:27017",
};
