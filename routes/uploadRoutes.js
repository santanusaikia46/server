const express = require("express");
const { upload, uploadToCloudinary } = require("../middleware/upload");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

// POST /api/upload - Upload single image to Cloudinary (Admin only)
router.post("/", auth, admin, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = await uploadToCloudinary(req.file);


    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
