const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    userType: { type: String, enum: ["Employee", "Employer"], required: true },
    // Employee fields
    email: { type: String, unique: true, sparse: true },
    phoneNumber: String,
    jobPosition: String,
    // Employer fields
    companyName: { type: String, unique: true, sparse: true },
    officialEmail: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Usermodel", userSchema); 
 