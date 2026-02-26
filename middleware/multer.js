// middleware/multer.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'projects_media',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    resource_type: 'auto',
    format: async (req, file) => {
      // Get extension from original filename
      const ext = file.originalname.split('.').pop().toLowerCase();
      
      // Map extensions to Cloudinary format
      if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
      if (ext === 'png') return 'png';
      if (ext === 'pdf') return 'pdf';
      if (ext === 'doc' || ext === 'docx') return 'docx';
      
      return ext; // fallback
    },
    public_id: (req, file) => {
      const name = file.originalname.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
      return `${Date.now()}-${name}`;
    }
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = upload;