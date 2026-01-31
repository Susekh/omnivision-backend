const { MongoClient } = require("mongodb");
const { uri } = require("../config.js");
async function connectToDb() {
  // const host = process.env.MONGO_HOST || '0.0.0.0';
  // const port = process.env.MONGO_PORT || '27017'; // Default MongoDB port
  const dbName = "BillionEyes_V1";

  const uri1 = `${uri}/${dbName}`;
  console.log(uri1, "cbdfhfjsbfjs");

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



