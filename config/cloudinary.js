const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'duzawmkrm',
  api_key: '726579868821175',
  api_secret: 'rD3RmMwrB0f2OjcEp1v6cXR7syk',
});

module.exports = cloudinary;