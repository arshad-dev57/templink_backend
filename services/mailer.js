const nodemailer = require("nodemailer");

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendOtpEmail({ to, otp }) {
  const transporter = getTransporter();

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const subject = "Your Templink OTP Code";
  const text = `Your OTP code is: ${otp}\nIt will expire in ${process.env.RESET_OTP_EXP_MIN || 10} minutes.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5">
      <h2>Templink Password Reset</h2>
      <p>Your OTP code is:</p>
      <div style="font-size:28px; font-weight:700; letter-spacing:3px">${otp}</div>
      <p>This code will expire in ${process.env.RESET_OTP_EXP_MIN || 10} minutes.</p>
      <p>If you didn't request this, ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({ from, to, subject, text, html });
}

module.exports = { sendOtpEmail };
