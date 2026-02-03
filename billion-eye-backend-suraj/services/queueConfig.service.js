  const { getConfigCollection } = require("../Db/configdb");

async function getOutputQueue() {
  const col = await getConfigCollection();

  // 1️⃣ Get active model
  const activeModelDoc = await col.findOne({ key: "ACTIVE_MODEL" });
  const activeModel = activeModelDoc?.value;

  if (!activeModel) {
    throw new Error("ACTIVE_MODEL not set in config collection");
  }

  // 2️⃣ Get model → queue map
  const mapDoc = await col.findOne({ key: "MODEL_QUEUE_MAP" });

  if (!mapDoc || typeof mapDoc.value !== "object") {
    throw new Error("MODEL_QUEUE_MAP missing or invalid in config collection");
  }

  const queue = mapDoc.value[activeModel];

  if (!queue) {
    throw new Error(`No queue configured for model: ${activeModel}`);
  }

  return queue;
}

module.exports = { getOutputQueue };
