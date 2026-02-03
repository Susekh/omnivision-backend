const { getConfigCollection } = require("../Db/configdb");

// Read model from DB every time
async function getActiveModel() {
  const col = await getConfigCollection();

  const doc = await col.findOne({ key: "ACTIVE_MODEL" });

  if (!doc || !doc.value) {
    // default fallback
    return "YOLO";
  }

  return doc.value;
}

// Update model in DB
async function setActiveModel(model) {
  const col = await getConfigCollection();

  await col.updateOne(
    { key: "ACTIVE_MODEL" },
    {
      $set: {
        value: model,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log("[CONFIG] ACTIVE_MODEL updated to:", model);
}

module.exports = {
  getActiveModel,
  setActiveModel,
};
