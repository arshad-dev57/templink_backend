const User = require("../models/user_model");
const CrmSetting = require("../models/crm_setting_model");

module.exports = async function crmAuth(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: No user found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    req.currentUser = user;

    if (user.role === "employer") {
      req.crmRole = "employer";
      req.crmEmployerId = user._id;
      req.crmPermissions = {
        canViewAllLeads: true,
        canCreateLeads: true,
        canEditLeads: true,
        canDeleteLeads: true,
        canViewDeals: true,
        canManageDeals: true,
        canViewReports: true,
        canManageSettings: true,
        canManageProducts: true,
        canManageQuotations: true,
      };
      return next();
    }

    // Role is employee
    req.crmRole = "employee";
    const requestedEmployerId = req.headers["x-employer-id"] || req.query.employerId;

    let targetEmployerId = null;

    if (requestedEmployerId) {
      // Verify relation
      const employer = await User.findOne({
        _id: requestedEmployerId,
        role: "employer",
        "employerProfile.teamMembers": {
          $elemMatch: { employeeId: user._id, status: "active" },
        },
      });

      if (employer) {
        targetEmployerId = employer._id;
      }
    }

    if (!targetEmployerId) {
      // Find from employer's team members
      const employer = await User.findOne({
        role: "employer",
        "employerProfile.teamMembers": {
          $elemMatch: { employeeId: user._id, status: "active" },
        },
      });

      if (employer) {
        targetEmployerId = employer._id;
      }
    }

    if (!targetEmployerId) {
      // Check employee's myEmployers
      const activeEntry = user.myEmployers?.find((e) => e.status === "active");
      if (activeEntry && activeEntry.employerId) {
        targetEmployerId = activeEntry.employerId;
      }
    }

    // If still no employer, allow fallback to own user id so employee can test/use their own workspace
    if (!targetEmployerId) {
      targetEmployerId = user._id;
    }

    req.crmEmployerId = targetEmployerId;

    // Load permissions from CrmSetting
    const setting = await CrmSetting.findOne({ employerId: targetEmployerId });
    const empPerm = setting?.employeePermissions?.find(
      (p) => p.employeeId?.toString() === user._id.toString()
    );

    req.crmPermissions = empPerm
      ? {
          canViewAllLeads: empPerm.canViewAllLeads,
          canCreateLeads: empPerm.canCreateLeads,
          canEditLeads: empPerm.canEditLeads,
          canDeleteLeads: empPerm.canDeleteLeads,
          canViewDeals: empPerm.canViewDeals,
          canManageDeals: empPerm.canManageDeals,
          canViewReports: empPerm.canViewReports,
          canManageSettings: empPerm.canManageSettings,
          canManageProducts: empPerm.canManageProducts,
          canManageQuotations: empPerm.canManageQuotations,
        }
      : {
          canViewAllLeads: false, // by default employee only sees assigned leads
          canCreateLeads: true,
          canEditLeads: true,
          canDeleteLeads: false,
          canViewDeals: true,
          canManageDeals: true,
          canViewReports: false,
          canManageSettings: false,
          canManageProducts: false,
          canManageQuotations: true,
        };

    return next();
  } catch (err) {
    console.error("CRM Auth Middleware error:", err);
    return res.status(500).json({ success: false, message: "CRM Authorization failed", error: err.message });
  }
};
