const { MongoClient } = require("mongodb");
const { uri } = require("../config.js");
async function connectToDb() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log("Connected to MongoDB");
    return client;
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    throw err;
  }
}

module.exports = connectToDb;



