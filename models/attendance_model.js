// models/attendance_model.js
const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  date: {
    type: Date,
    required: true
  },
  checkIn: {
    type: Date
  },
  checkOut: {
    type: Date
  },
  checkInLocation: {
    latitude: Number,
    longitude: Number,
    name: String
  },
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
    name: String
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'leave', 'half_day'],
    default: 'absent'
  },
  isLate: {
    type: Boolean,
    default: false
  },
  lateMinutes: {
    type: Number,
    default: 0
  },
  totalHours: {
    type: Number,
    default: 0
  },
  officeStartTime: {
    type: String,
    default: '09:00'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
AttendanceSchema.index({ employeeId: 1, date: -1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);