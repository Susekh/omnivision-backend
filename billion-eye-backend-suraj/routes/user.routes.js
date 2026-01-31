
const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const userController = require("../controllers/users.controller");
const auth = require("../middlewares/auth.users");
const multer = require("../middlewares/multer");
const { uploadImage , getAllincdents } = require("../controllers/images.controller");


// User Registration Route
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Email is not valid"),
    body("fullname.firstname")
      .isLength({ min: 3 })
      .withMessage("First name must be at least 3 characters long"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  userController.registerUser
);

// User Login Route
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Email is not valid"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  userController.loginUser
);

// Image Upload Route
router.post("/upload-image", multer.single("image"), uploadImage);

// Save Image Route
router.post(
  "/uploaed-image",
  auth, // Authentication Middleware
  multer.single("image"), // File Upload Middleware
  [
    body("latitude").isNumeric().withMessage("Latitude must be a number"),
    body("longitude").isNumeric().withMessage("Longitude must be a number"),
    body("timestamp").isISO8601().withMessage("Invalid timestamp format"),
  ],
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }
    req.body.imageUrl = `data:image/png;base64,${req.file.buffer.toString("base64")}`;
    next();
  },
  userController.uploadImage
);

// Protected Route
router.get("/protected", auth, (req, res) => {
  res.status(200).json({ message: "Welcome to the protected route!", user: req.user });
});

// router.get('/imgaes/:incidentId', getImageData);




// Get All Incidents Route
router.get('/incidents', getAllincdents);
module.exports = router;
