const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Testing Cloudinary with:");
console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API Key:", process.env.CLOUDINARY_API_KEY);

cloudinary.api.ping()
  .then(result => {
    console.log("Cloudinary Ping Result:", result);
    process.exit(0);
  })
  .catch(error => {
    console.error("Cloudinary Ping Error:", error);
    process.exit(1);
  });
