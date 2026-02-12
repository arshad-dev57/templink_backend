// middleware/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary'); // <- Yeh v2 export kar raha hai

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,  // <- Ab yeh sahi kaam karega
  params: async (req, file) => {
    // File type check
    const allowedFormats = ['jpg', 'jpeg', 'png', 'pdf', 'docx'];
    const fileExtension = file.mimetype.split('/')[1];
    
    if (!allowedFormats.includes(fileExtension)) {
      throw new Error('Invalid file format');
    }

    return {
      folder: 'projects_media',
      format: fileExtension, // Important: Format specify karo
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
      transformation: [{ width: 800, height: 800, crop: 'limit' }],
    };
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = upload;