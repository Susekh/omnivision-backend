const { getConfigCollection } = require("../Db/configdb");

const MODEL_QUEUE_MAP = {
  YOLO: "image_queue",
  VLM: "image_queue_vlm",
};

async function getOutputQueue() {
  const col = await getConfigCollection();

  const doc = await col.findOne({ key: "ACTIVE_MODEL" });

  const model = doc?.value || "YOLO"; // default fallback

  return MODEL_QUEUE_MAP[model] || MODEL_QUEUE_MAP.YOLO;
}

module.exports = { getOutputQueue };
