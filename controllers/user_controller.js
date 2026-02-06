const User = require("../models/user_model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const { userType, password, confirmPassword } = req.body;
    if (!userType || !password || !confirmPassword)
      return res.status(400).json({ message: "All required fields" });

    if (password !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });

    let userData = { userType };

    if (userType === "Employee") {
      const { email, phoneNumber, jobPosition } = req.body;
      if (!email || !phoneNumber || !jobPosition)
        return res.status(400).json({ message: "Missing employee fields" });
      userData = { ...userData, email, phoneNumber, jobPosition };
    } else if (userType === "Employer") {
      const { companyName, officialEmail, phoneNumber } = req.body;
      if (!companyName || !officialEmail || !phoneNumber)
        return res.status(400).json({ message: "Missing employer fields" });
      userData = { ...userData, companyName, officialEmail, phoneNumber };
    }

    let exists = null;
    if (userType === "Employee") exists = await User.findOne({ email: userData.email });
    else exists = await User.findOne({ officialEmail: userData.officialEmail });

    if (exists)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    userData.password = hashedPassword;

    const user = await User.create(userData);

    const token = jwt.sign({ id: user._id, userType: user.userType }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ message: "User registered", token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
