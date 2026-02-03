const connectToDb = require("./db");

async function getConfigCollection() {
  const client = await connectToDb();
  const db = client.db("BillionEyes_V1");
  return db.collection("app_config");
}

module.exports = { getConfigCollection };
