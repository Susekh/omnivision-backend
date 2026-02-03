const {
  setActiveModel,
  getActiveModel,
} = require("../services/modelConfigService");

// POST /backend/switch-model
async function switchModel(req, res) {
  try {
    const { model } = req.body;

    if (!model || !["YOLO", "VLM"].includes(model)) {
      return res.status(400).json({
        success: false,
        message: "Invalid model. Allowed values: YOLO, VLM",
      });
    }

    await setActiveModel(model);

    res.json({
      success: true,
      activeModel: model,
    });
  } catch (err) {
    console.error("[switchModel] Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to switch model",
    });
  }
}

// GET /backend/active-model
async function getActiveModelController(req, res) {
  try {
    const model = await getActiveModel();

    res.json({
      success: true,
      activeModel: model,
    });
  } catch (err) {
    console.error("[getActiveModel] Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active model",
    });
  }
}

module.exports = {
  switchModel,
  getActiveModelController,
};
