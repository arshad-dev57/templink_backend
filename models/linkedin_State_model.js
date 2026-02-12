const mongoose = require("mongoose");

const LinkedinStateSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, unique: true, index: true },
    createdAt: { type: Date, default: Date.now, expires: 4000 }, // auto delete after 10 minutes
  },
  { timestamps: false }
);

module.exports = mongoose.model("LinkedinAuthState", LinkedinStateSchema);