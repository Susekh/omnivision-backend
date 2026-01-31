module.exports = {
  SERVER_HOST: process.env.SERVER_HOST || "localhost",
  SERVER_PORT: process.env.SERVER_PORT || 3010,
  MONGO_HOST: process.env.MONGO_HOST || "localhost",
  IP : process.env.IP || "127.0.0.1",
  MONGO_PORT: process.env.MONGO_PORT || 27017,
  dbName: "omnivision",
  OUTPUT_QUEUE: process.env.OUTPUT_QUEUE || 'image_queue',
  uri: `mongodb://${process.env.MONGO_HOST || "localhost"}:${process.env.MONGO_PORT || 27017}/`,
};
