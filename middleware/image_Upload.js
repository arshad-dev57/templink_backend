// middleware/imageUpload.js
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (!file.mimetype.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }

    const originalExt = (file.originalname.split(".").pop() || "").toLowerCase();

    return {
      folder: "employee_photos", // dedicated folder
      format: originalExt,
      public_id: `photo-${Date.now()}`,
      transformation: [
        { width: 500, height: 500, crop: "limit" },
      ],
    };
  },
});

const photoUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile photo
  },
});

module.exports = photoUpload;