const crypto = require("crypto");
const User = require("../models/user_model");
const PasswordReset = require("../models/password_reset_model");
const { sendOtpEmail } = require("../services/mailer");

function hashValue(value) {
  const secret = process.env.RESET_OTP_SECRET || "default_secret_change_me";
  return crypto.createHash("sha256").update(`${value}:${secret}`).digest("hex");
}

// 1) REQUEST OTP
// POST /api/auth/forgot-password/request  { email }
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ ok: false, msg: "email required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Security: user na bhi ho to generic success return
    if (!user) return res.json({ ok: true, msg: "If account exists, OTP has been sent" });
console.log("Password reset requested for email:", email); // Debug log
    // Remove old pending resets
    await PasswordReset.deleteMany({ userId: user._id, verified: false });

    const otp = String(crypto.randomInt(100000, 999999)); // 6-digit
    const otpHash = hashValue(otp);

    const expMin = Number(process.env.RESET_OTP_EXP_MIN || 10);
    const expiresAt = new Date(Date.now() + expMin * 60 * 1000);

    await PasswordReset.create({
      userId: user._id,
      otpHash,
      expiresAt,
      attempts: 0,
      verified: false,
    });
console.log(`Generated OTP for ${email}:`, otp); // Debug log - remove in production
    await sendOtpEmail({ to: user.email, otp });

    return res.json({ ok: true, msg: "OTP sent to email" });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: "Server error", error: err.message });
  }
};

// 2) VERIFY OTP
// POST /api/auth/forgot-password/verify  { email, otp }
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ ok: false, msg: "email and otp required" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ ok: false, msg: "Invalid OTP" });

    const record = await PasswordReset.findOne({
      userId: user._id,
      verified: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) return res.status(400).json({ ok: false, msg: "OTP expired or not found" });

    const maxAttempts = Number(process.env.RESET_OTP_MAX_ATTEMPTS || 5);
    if (record.attempts >= maxAttempts) {
      return res.status(429).json({ ok: false, msg: "Too many attempts. Request new OTP." });
    }

    const otpHash = hashValue(String(otp).trim());

    if (otpHash !== record.otpHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ ok: false, msg: "Invalid OTP" });
    }

    // OTP OK -> issue resetToken for next step
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = hashValue(resetToken);

    // token expiry: 15 mins
    const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    record.verified = true;
    record.resetTokenHash = resetTokenHash;
    record.resetTokenExpiresAt = resetTokenExpiresAt;
    await record.save();

    return res.json({
      ok: true,
      msg: "OTP verified",
      resetToken, // client will send this in reset API
    });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: "Server error", error: err.message });
  }
};

// 3) RESET PASSWORD
// POST /api/auth/forgot-password/reset { resetToken, newPassword, confirmPassword }
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ ok: false, msg: "resetToken, newPassword, confirmPassword required" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ ok: false, msg: "Passwords do not match" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ ok: false, msg: "Password must be at least 6 chars" });
    }

    const tokenHash = hashValue(String(resetToken).trim());

    const record = await PasswordReset.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) return res.status(400).json({ ok: false, msg: "Invalid or expired reset token" });

    const user = await User.findById(record.userId).select("+password");
    if (!user) return res.status(400).json({ ok: false, msg: "User not found" });

    user.password = newPassword; // your pre-save hook will hash it
    await user.save();

    // cleanup
    await PasswordReset.deleteMany({ userId: user._id });

    return res.json({ ok: true, msg: "Password updated successfully" });
  } catch (err) {
    return res.status(500).json({ ok: false, msg: "Server error", error: err.message });
  }
};
