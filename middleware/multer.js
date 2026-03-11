const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    
    // ✅ File type ke hisab se resource_type set karo
    let resourceType = 'image';
    
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'zip', 'rar'].includes(ext)) {
      resourceType = 'raw';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
      resourceType = 'video';
    }

    return {
      folder: 'projects_media',
      resource_type: resourceType, // ✅ 'raw' for PDFs/docs
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
    };
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = upload;