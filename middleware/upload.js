const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const sharp = require("sharp");

// Multer memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Not an image! Please upload only images."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const uploadToCloudinary = async (file) => {
  try {
    // Automatic conversion to AVIF using Sharp
    const avifBuffer = await sharp(file.buffer)
      .avif({ quality: 65 }) // Adjust quality as needed
      .toBuffer();

    const b64 = avifBuffer.toString("base64");
    let dataURI = "data:image/avif;base64," + b64;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "tatiassam",
      resource_type: "auto",
      format: "avif", // Ensure Cloudinary treats it as AVIF
    });
    
    return result;
  } catch (error) {
    console.error("Cloudinary/Sharp Upload Error:", error);
    throw error;
  }
};

module.exports = { upload, uploadToCloudinary };
