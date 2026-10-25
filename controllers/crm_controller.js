const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const User = require("../models/user_model");
const CrmLead = require("../models/crm_lead_model");
const CrmContact = require("../models/crm_contact_model");
const CrmCompany = require("../models/crm_company_model");
const CrmDeal = require("../models/crm_deal_model");
const CrmActivity = require("../models/crm_activity_model");
const CrmNote = require("../models/crm_note_model");
const CrmEmail = require("../models/crm_email_model");
const CrmCase = require("../models/crm_case_model");
const CrmProduct = require("../models/crm_product_model");
const CrmQuotation = require("../models/crm_quotation_model");
const CrmSetting = require("../models/crm_setting_model");
const CrmAudit = require("../models/crm_audit_model");

// Configure nodemailer transporter using existing environment variables
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Helper: Ensure default settings exist for employer
async function getOrCreateSettings(employerId) {
  let setting = await CrmSetting.findOne({ employerId });
  if (!setting) {
    setting = await CrmSetting.create({ employerId });
  }
  return setting;
}

// ==================== 1. DASHBOARD ANALYTICS ====================
exports.getDashboardAnalytics = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const isEmployee = req.crmRole === "employee";
    const employeeId = req.user.id;
    const now = new Date();

    // Base filters
    const leadFilter = { employerId, isArchived: false };
    const dealFilter = { employerId, isArchived: false };
    const activityFilter = { employerId, isArchived: false };

    if (isEmployee && !req.crmPermissions.canViewAllLeads) {
      leadFilter.assignedTo = employeeId;
    }
    if (isEmployee && !req.crmPermissions.canViewDeals) {
      dealFilter.assignedTo = employeeId;
    }
    if (isEmployee) {
      activityFilter.assignedTo = employeeId;
    }

    // 1. Leads counts
    const totalLeads = await CrmLead.countDocuments(leadFilter);
    const newLeads = await CrmLead.countDocuments({ ...leadFilter, status: "new" });
    const qualifiedLeads = await CrmLead.countDocuments({ ...leadFilter, status: "qualified" });
    const convertedLeads = await CrmLead.countDocuments({ ...leadFilter, status: "converted" });

    // 2. Contacts and Companies
    const totalContacts = await CrmContact.countDocuments({ employerId, isArchived: false });
    const totalCompanies = await CrmCompany.countDocuments({ employerId, isArchived: false });

    // 3. Deals analytics
    const deals = await CrmDeal.find(dealFilter);
    const totalDeals = deals.length;
    const openDeals = deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage));
    const wonDeals = deals.filter((d) => d.stage === "closed_won");
    const lostDeals = deals.filter((d) => d.stage === "closed_lost");

    const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const wonRevenue = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const weightedPipelineValue = openDeals.reduce(
      (sum, d) => sum + ((d.amount || 0) * (d.probability || 0)) / 100,
      0
    );

    const winRate = totalDeals > 0 ? Math.round((wonDeals.length / totalDeals) * 100) : 0;
    const leadConversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    // 4. Activities analytics
    const overdueActivities = await CrmActivity.countDocuments({
      ...activityFilter,
      status: { $in: ["pending", "in_progress", "scheduled"] },
      dueDate: { $lt: now },
    });

    const upcomingActivitiesCount = await CrmActivity.countDocuments({
      ...activityFilter,
      status: { $in: ["pending", "in_progress", "scheduled"] },
      dueDate: { $gte: now },
    });

    const completedActivitiesCount = await CrmActivity.countDocuments({
      ...activityFilter,
      status: "completed",
    });

    // 5. Recent items
    const recentLeads = await CrmLead.find(leadFilter)
      .populate("assignedTo", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(5);

    const upcomingActivities = await CrmActivity.find({
      ...activityFilter,
      status: { $in: ["pending", "in_progress", "scheduled"] },
      dueDate: { $gte: now },
    })
      .populate("assignedTo", "firstName lastName")
      .sort({ dueDate: 1 })
      .limit(5);

    // 6. Deals grouped by stage
    const settings = await getOrCreateSettings(employerId);
    const stageMap = {};
    settings.pipelineStages.forEach((s) => {
      stageMap[s.id] = { id: s.id, name: s.name, color: s.color, count: 0, totalValue: 0 };
    });

    deals.forEach((d) => {
      if (stageMap[d.stage]) {
        stageMap[d.stage].count += 1;
        stageMap[d.stage].totalValue += d.amount || 0;
      }
    });
    const dealsByStage = Object.values(stageMap);

    // 7. Team performance leaderboard (for employer or authorized employee)
    let teamPerformance = [];
    if (!isEmployee || req.crmPermissions.canViewReports) {
      teamPerformance = await CrmDeal.aggregate([
        { $match: { employerId: new mongoose.Types.ObjectId(employerId), isArchived: false } },
        {
          $group: {
            _id: "$assignedTo",
            totalDeals: { $sum: 1 },
            wonDeals: { $sum: { $cond: [{ $eq: ["$stage", "closed_won"] }, 1, 0] } },
            wonRevenue: { $sum: { $cond: [{ $eq: ["$stage", "closed_won"] }, "$amount", 0] } },
            pipelineValue: {
              $sum: {
                $cond: [{ $not: [{ $in: ["$stage", ["closed_won", "closed_lost"]] }] }, "$amount", 0],
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            employeeId: "$_id",
            name: {
              $concat: [
                { $ifNull: ["$user.firstName", "Unassigned"] },
                " ",
                { $ifNull: ["$user.lastName", ""] },
              ],
            },
            email: "$user.email",
            totalDeals: 1,
            wonDeals: 1,
            wonRevenue: 1,
            pipelineValue: 1,
          },
        },
        { $sort: { wonRevenue: -1 } },
      ]);
    }

    return res.json({
      success: true,
      data: {
        role: req.crmRole,
        totalLeads,
        newLeads,
        qualifiedLeads,
        convertedLeads,
        totalContacts,
        totalCompanies,
        totalDeals,
        openDealsCount: openDeals.length,
        wonDealsCount: wonDeals.length,
        lostDealsCount: lostDeals.length,
        pipelineValue,
        wonRevenue,
        weightedPipelineValue,
        winRate,
        leadConversionRate,
        overdueActivities,
        upcomingActivitiesCount,
        completedActivitiesCount,
        recentLeads,
        upcomingActivities,
        dealsByStage,
        teamPerformance,
      },
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ==================== 2. LEADS MANAGEMENT ====================
exports.getLeads = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const {
      search,
      status,
      priority,
      leadSource,
      assignedTo,
      page = 1,
      limit = 15,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { employerId, isArchived: false };

    // Employee permission scoping
    if (req.crmRole === "employee" && !req.crmPermissions.canViewAllLeads) {
      query.assignedTo = req.user.id;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (leadSource) query.leadSource = leadSource;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { company: searchRegex },
        { leadId: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [leads, total] = await Promise.all([
      CrmLead.find(query)
        .populate("assignedTo", "firstName lastName email employeeProfile")
        .populate("createdBy", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      CrmLead.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: leads,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get leads error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch leads", error: error.message });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = await CrmLead.findOne({ _id: req.params.id, employerId: req.crmEmployerId })
      .populate("assignedTo", "firstName lastName email employeeProfile")
      .populate("createdBy", "firstName lastName email")
      .populate("convertedContactId")
      .populate("convertedCompanyId")
      .populate("convertedDealId");

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    // Check employee access
    if (
      req.crmRole === "employee" &&
      !req.crmPermissions.canViewAllLeads &&
      lead.assignedTo?._id?.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Access denied to this lead" });
    }

    // Fetch related activities and notes
    const [activities, notes] = await Promise.all([
      CrmActivity.find({ employerId: req.crmEmployerId, relatedToType: "lead", relatedToId: lead._id })
        .populate("assignedTo", "firstName lastName")
        .sort({ createdAt: -1 }),
      CrmNote.find({ employerId: req.crmEmployerId, relatedToType: "lead", relatedToId: lead._id })
        .populate("createdBy", "firstName lastName")
        .sort({ isPinned: -1, createdAt: -1 }),
    ]);

    return res.json({ success: true, data: { lead, activities, notes } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    if (req.crmRole === "employee" && !req.crmPermissions.canCreateLeads) {
      return res.status(403).json({ success: false, message: "Permission denied to create leads" });
    }

    const {
      name,
      email,
      phone,
      company,
      jobTitle,
      leadSource,
      status,
      priority,
      industry,
      estimatedDealValue,
      currency,
      expectedClosingDate,
      address,
      description,
      assignedTo,
      tags,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Lead name is required" });
    }

    // Generate unique ID
    const count = await CrmLead.countDocuments({ employerId: req.crmEmployerId });
    const leadId = `LEAD-${1000 + count + 1}`;

    // Auto-assignment for employee if not specified
    let finalAssignedTo = assignedTo || null;
    if (req.crmRole === "employee" && !finalAssignedTo) {
      finalAssignedTo = req.user.id;
    }

    const lead = await CrmLead.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      assignedTo: finalAssignedTo,
      leadId,
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : "",
      phone: phone || "",
      company: company || "",
      jobTitle: jobTitle || "",
      leadSource: leadSource || "website",
      status: status || "new",
      priority: priority || "medium",
      industry: industry || "",
      estimatedDealValue: Number(estimatedDealValue) || 0,
      currency: currency || "USD",
      expectedClosingDate: expectedClosingDate ? new Date(expectedClosingDate) : null,
      address: address || {},
      description: description || "",
      tags: Array.isArray(tags) ? tags : [],
    });

    // Log audit
    await CrmAudit.create({
      employerId: req.crmEmployerId,
      performedBy: req.user.id,
      action: "lead_created",
      entityType: "lead",
      entityId: lead._id,
      entityName: lead.name,
      notes: `Created lead ${lead.leadId} - ${lead.name}`,
    });

    const populated = await CrmLead.findById(lead._id)
      .populate("assignedTo", "firstName lastName email")
      .populate("createdBy", "firstName lastName email");

    return res.status(201).json({ success: true, message: "Lead created successfully", data: populated });
  } catch (error) {
    console.error("Create lead error:", error);
    return res.status(500).json({ success: false, message: "Failed to create lead", error: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const lead = await CrmLead.findOne({ _id: req.params.id, employerId: req.crmEmployerId });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    // Check permissions
    if (req.crmRole === "employee") {
      if (!req.crmPermissions.canEditLeads) {
        return res.status(403).json({ success: false, message: "Permission denied to edit leads" });
      }
      if (
        !req.crmPermissions.canViewAllLeads &&
        lead.assignedTo?.toString() !== req.user.id.toString()
      ) {
        return res.status(403).json({ success: false, message: "Cannot edit leads not assigned to you" });
      }
    }

    const updatableFields = [
      "name",
      "email",
      "phone",
      "company",
      "jobTitle",
      "leadSource",
      "status",
      "priority",
      "industry",
      "estimatedDealValue",
      "currency",
      "expectedClosingDate",
      "address",
      "description",
      "tags",
    ];

    // Only employers or managers can reassign
    if (req.crmRole === "employer" || req.crmPermissions.canViewAllLeads) {
      if (req.body.assignedTo !== undefined) {
        lead.assignedTo = req.body.assignedTo || null;
      }
    }

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        lead[field] = req.body[field];
      }
    });

    await lead.save();

    await CrmAudit.create({
      employerId: req.crmEmployerId,
      performedBy: req.user.id,
      action: "lead_updated",
      entityType: "lead",
      entityId: lead._id,
      entityName: lead.name,
      notes: `Updated lead ${lead.leadId}`,
    });

    const populated = await CrmLead.findById(lead._id)
      .populate("assignedTo", "firstName lastName email")
      .populate("createdBy", "firstName lastName email");

    return res.json({ success: true, message: "Lead updated successfully", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update lead", error: error.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    if (req.crmRole === "employee" && !req.crmPermissions.canDeleteLeads) {
      return res.status(403).json({ success: false, message: "Permission denied to delete leads" });
    }

    const lead = await CrmLead.findOne({ _id: req.params.id, employerId: req.crmEmployerId });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    lead.isArchived = true;
    await lead.save();

    return res.json({ success: true, message: "Lead deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete lead", error: error.message });
  }
};

// ==================== CONVERT LEAD TRANSACTION ====================
exports.convertLead = async (req, res) => {
  try {
    const lead = await CrmLead.findOne({ _id: req.params.id, employerId: req.crmEmployerId });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    if (lead.isConverted) {
      return res.status(400).json({ success: false, message: "Lead is already converted" });
    }

    const {
      createContact = true,
      createCompany = true,
      createDeal = true,
      dealTitle,
      dealAmount,
      dealStage = "lead_in",
    } = req.body;

    let company = null;
    let contact = null;
    let deal = null;

    const assignedTo = lead.assignedTo || req.user.id;

    // 1. Create or link Company
    if (createCompany && lead.company) {
      const companyCount = await CrmCompany.countDocuments({ employerId: req.crmEmployerId });
      company = await CrmCompany.create({
        employerId: req.crmEmployerId,
        createdBy: req.user.id,
        assignedTo,
        companyId: `COMP-${1000 + companyCount + 1}`,
        name: lead.company,
        phone: lead.phone || "",
        email: lead.email || "",
        industry: lead.industry || "",
        annualRevenue: lead.estimatedDealValue || 0,
        address: lead.address || {},
      });
    }

    // 2. Create Contact
    if (createContact) {
      const nameParts = lead.name.split(" ");
      const firstName = nameParts[0] || lead.name;
      const lastName = nameParts.slice(1).join(" ") || "";
      const contactCount = await CrmContact.countDocuments({ employerId: req.crmEmployerId });

      contact = await CrmContact.create({
        employerId: req.crmEmployerId,
        createdBy: req.user.id,
        assignedTo,
        companyId: company ? company._id : null,
        leadId: lead._id,
        contactId: `CONT-${1000 + contactCount + 1}`,
        firstName,
        lastName,
        email: lead.email || "",
        phone: lead.phone || "",
        jobTitle: lead.jobTitle || "",
        lifecycleStage: "opportunity",
        address: lead.address || {},
      });
    }

    // 3. Create Deal
    if (createDeal) {
      const dealCount = await CrmDeal.countDocuments({ employerId: req.crmEmployerId });
      deal = await CrmDeal.create({
        employerId: req.crmEmployerId,
        createdBy: req.user.id,
        assignedTo,
        dealId: `DEAL-${1000 + dealCount + 1}`,
        title: dealTitle || `${lead.company || lead.name} - Deal`,
        companyId: company ? company._id : null,
        contactId: contact ? contact._id : null,
        leadId: lead._id,
        amount: Number(dealAmount !== undefined ? dealAmount : lead.estimatedDealValue) || 0,
        stage: dealStage,
        expectedCloseDate: lead.expectedClosingDate || null,
        leadSource: lead.leadSource,
        probability: 30,
      });
    }

    // 4. Mark Lead Converted
    lead.isConverted = true;
    lead.status = "converted";
    lead.convertedAt = new Date();
    lead.convertedCompanyId = company ? company._id : null;
    lead.convertedContactId = contact ? contact._id : null;
    lead.convertedDealId = deal ? deal._id : null;
    await lead.save();

    await CrmAudit.create({
      employerId: req.crmEmployerId,
      performedBy: req.user.id,
      action: "lead_converted",
      entityType: "lead",
      entityId: lead._id,
      entityName: lead.name,
      notes: `Converted lead ${lead.leadId} into Contact: ${contact?.contactId || "N/A"}, Company: ${company?.companyId || "N/A"}, Deal: ${deal?.dealId || "N/A"}`,
    });

    return res.json({
      success: true,
      message: "Lead successfully converted",
      data: { lead, contact, company, deal },
    });
  } catch (error) {
    console.error("Convert lead error:", error);
    return res.status(500).json({ success: false, message: "Lead conversion failed", error: error.message });
  }
};

// ==================== 3. CONTACTS MANAGEMENT ====================
exports.getContacts = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { search, lifecycleStage, status, companyId, page = 1, limit = 15 } = req.query;

    const query = { employerId, isArchived: false };
    if (lifecycleStage) query.lifecycleStage = lifecycleStage;
    if (status) query.status = status;
    if (companyId) query.companyId = companyId;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { jobTitle: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [contacts, total] = await Promise.all([
      CrmContact.find(query)
        .populate("companyId", "name website industry")
        .populate("assignedTo", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmContact.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: contacts,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, mobilePhone, jobTitle, department, companyId, lifecycleStage, address, linkedin, notes } = req.body;

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ success: false, message: "First name is required" });
    }

    // Duplicate check within organization
    if (email && email.trim()) {
      const existing = await CrmContact.findOne({
        employerId: req.crmEmployerId,
        email: email.trim().toLowerCase(),
        isArchived: false,
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `A contact with email "${email}" already exists (${existing.firstName} ${existing.lastName})`,
        });
      }
    }

    const count = await CrmContact.countDocuments({ employerId: req.crmEmployerId });
    const contactId = `CONT-${1000 + count + 1}`;

    const contact = await CrmContact.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      assignedTo: req.body.assignedTo || req.user.id,
      companyId: companyId || null,
      contactId,
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : "",
      email: email ? email.trim().toLowerCase() : "",
      phone: phone || "",
      mobilePhone: mobilePhone || "",
      jobTitle: jobTitle || "",
      department: department || "",
      lifecycleStage: lifecycleStage || "lead",
      address: address || {},
      linkedin: linkedin || "",
      notes: notes || "",
    });

    const populated = await CrmContact.findById(contact._id).populate("companyId", "name website");
    return res.status(201).json({ success: true, message: "Contact created successfully", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create contact", error: error.message });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const contact = await CrmContact.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      req.body,
      { new: true }
    ).populate("companyId", "name website");

    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    return res.json({ success: true, message: "Contact updated successfully", data: contact });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update contact", error: error.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    await CrmContact.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      { isArchived: true }
    );
    return res.json({ success: true, message: "Contact deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete contact", error: error.message });
  }
};

// ==================== 4. COMPANIES / ACCOUNTS MANAGEMENT ====================
exports.getCompanies = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { search, industry, type, status, page = 1, limit = 15 } = req.query;

    const query = { employerId, isArchived: false };
    if (industry) query.industry = industry;
    if (type) query.type = type;
    if (status) query.status = status;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ name: searchRegex }, { website: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [companies, total] = await Promise.all([
      CrmCompany.find(query)
        .populate("assignedTo", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmCompany.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: companies,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const { name, website, industry, phone, email, annualRevenue, currency, employeeCount, type, address, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Company name is required" });
    }

    const count = await CrmCompany.countDocuments({ employerId: req.crmEmployerId });
    const companyId = `COMP-${1000 + count + 1}`;

    const company = await CrmCompany.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      assignedTo: req.body.assignedTo || req.user.id,
      companyId,
      name: name.trim(),
      website: website || "",
      industry: industry || "",
      phone: phone || "",
      email: email ? email.trim().toLowerCase() : "",
      annualRevenue: Number(annualRevenue) || 0,
      currency: currency || "USD",
      employeeCount: employeeCount || "1-10",
      type: type || "prospect",
      address: address || {},
      description: description || "",
    });

    return res.status(201).json({ success: true, message: "Company created successfully", data: company });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create company", error: error.message });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const company = await CrmCompany.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      req.body,
      { new: true }
    );
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    return res.json({ success: true, message: "Company updated successfully", data: company });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update company", error: error.message });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    await CrmCompany.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      { isArchived: true }
    );
    return res.json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete company", error: error.message });
  }
};

// ==================== 5. DEALS & OPPORTUNITIES ====================
exports.getDeals = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { search, stage, assignedTo, companyId, page = 1, limit = 15 } = req.query;

    const query = { employerId, isArchived: false };
    if (stage) query.stage = stage;
    if (companyId) query.companyId = companyId;

    if (req.crmRole === "employee" && !req.crmPermissions.canViewDeals) {
      query.assignedTo = req.user.id;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { dealId: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [deals, total] = await Promise.all([
      CrmDeal.find(query)
        .populate("companyId", "name industry")
        .populate("contactId", "firstName lastName email phone")
        .populate("assignedTo", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmDeal.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: deals,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createDeal = async (req, res) => {
  try {
    const { title, companyId, contactId, amount, stage, probability, expectedCloseDate, leadSource, priority, description, products } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Deal title is required" });
    }

    const count = await CrmDeal.countDocuments({ employerId: req.crmEmployerId });
    const dealId = `DEAL-${1000 + count + 1}`;

    const deal = await CrmDeal.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      assignedTo: req.body.assignedTo || req.user.id,
      dealId,
      title: title.trim(),
      companyId: companyId || null,
      contactId: contactId || null,
      amount: Number(amount) || 0,
      stage: stage || "lead_in",
      probability: Number(probability) || 20,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      leadSource: leadSource || "",
      priority: priority || "medium",
      description: description || "",
      products: Array.isArray(products) ? products : [],
    });

    const populated = await CrmDeal.findById(deal._id)
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName email")
      .populate("assignedTo", "firstName lastName email");

    return res.status(201).json({ success: true, message: "Deal created successfully", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create deal", error: error.message });
  }
};

exports.updateDealStage = async (req, res) => {
  try {
    const { stage, wonReason, lostReason } = req.body;
    if (!stage) {
      return res.status(400).json({ success: false, message: "Stage is required" });
    }

    const deal = await CrmDeal.findOne({ _id: req.params.id, employerId: req.crmEmployerId });
    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    const oldStage = deal.stage;
    deal.stage = stage;

    // Automatic probability adjustment based on settings
    const settings = await getOrCreateSettings(req.crmEmployerId);
    const stageConfig = settings.pipelineStages.find((s) => s.id === stage);
    if (stageConfig && stageConfig.probability !== undefined) {
      deal.probability = stageConfig.probability;
    }

    if (stage === "closed_won") {
      deal.actualCloseDate = new Date();
      deal.probability = 100;
      if (wonReason) deal.wonReason = wonReason;
    } else if (stage === "closed_lost") {
      deal.actualCloseDate = new Date();
      deal.probability = 0;
      if (lostReason) deal.lostReason = lostReason;
    }

    await deal.save();

    await CrmAudit.create({
      employerId: req.crmEmployerId,
      performedBy: req.user.id,
      action: "deal_stage_changed",
      entityType: "deal",
      entityId: deal._id,
      entityName: deal.title,
      changes: { from: oldStage, to: stage },
      notes: `Stage moved from ${oldStage} to ${stage}`,
    });

    const populated = await CrmDeal.findById(deal._id)
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName email")
      .populate("assignedTo", "firstName lastName email");

    return res.json({ success: true, message: "Deal stage updated", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update stage", error: error.message });
  }
};

exports.updateDeal = async (req, res) => {
  try {
    const deal = await CrmDeal.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      req.body,
      { new: true }
    )
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName email")
      .populate("assignedTo", "firstName lastName email");

    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }
    return res.json({ success: true, message: "Deal updated successfully", data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update deal", error: error.message });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    await CrmDeal.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      { isArchived: true }
    );
    return res.json({ success: true, message: "Deal deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete deal", error: error.message });
  }
};

// ==================== 6. SALES PIPELINE BOARD ====================
exports.getSalesPipeline = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const settings = await getOrCreateSettings(employerId);
    const stages = settings.pipelineStages;

    const query = { employerId, isArchived: false };
    if (req.crmRole === "employee" && !req.crmPermissions.canViewDeals) {
      query.assignedTo = req.user.id;
    }

    const deals = await CrmDeal.find(query)
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName")
      .populate("assignedTo", "firstName lastName email")
      .sort({ createdAt: -1 });

    const pipeline = stages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage.id);
      const totalAmount = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
      const weightedAmount = (totalAmount * stage.probability) / 100;

      return {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        probability: stage.probability,
        dealsCount: stageDeals.length,
        totalAmount,
        weightedAmount,
        deals: stageDeals,
      };
    });

    return res.json({ success: true, data: pipeline });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ==================== 7. TASKS & ACTIVITIES ====================
exports.getActivities = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { activityType, status, priority, assignedTo, overdue, upcoming, page = 1, limit = 20 } = req.query;

    const query = { employerId, isArchived: false };
    if (activityType) query.activityType = activityType;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    if (req.crmRole === "employee") {
      query.assignedTo = req.user.id;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    const now = new Date();
    if (overdue === "true") {
      query.dueDate = { $lt: now };
      query.status = { $in: ["pending", "in_progress", "scheduled"] };
    } else if (upcoming === "true") {
      query.dueDate = { $gte: now };
      query.status = { $in: ["pending", "in_progress", "scheduled"] };
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [activities, total] = await Promise.all([
      CrmActivity.find(query)
        .populate("assignedTo", "firstName lastName email")
        .populate("createdBy", "firstName lastName")
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmActivity.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: activities,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createActivity = async (req, res) => {
  try {
    const {
      activityType = "task",
      title,
      description,
      priority,
      dueDate,
      startTime,
      endTime,
      durationMinutes,
      relatedToType,
      relatedToId,
      relatedToName,
      callDirection,
      callOutcome,
      meetingType,
      meetingLink,
      location,
      assignedTo,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Activity title is required" });
    }

    const activity = await CrmActivity.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      assignedTo: assignedTo || req.user.id,
      activityType,
      title: title.trim(),
      description: description || "",
      priority: priority || "medium",
      status: ["meeting", "call"].includes(activityType) ? "scheduled" : "pending",
      dueDate: dueDate ? new Date(dueDate) : startTime ? new Date(startTime) : new Date(),
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      durationMinutes: Number(durationMinutes) || 30,
      relatedToType: relatedToType || "general",
      relatedToId: relatedToId || null,
      relatedToName: relatedToName || "",
      callDirection: callDirection || "none",
      callOutcome: callOutcome || "none",
      meetingType: meetingType || "none",
      meetingLink: meetingLink || "",
      location: location || "",
    });

    const populated = await CrmActivity.findById(activity._id)
      .populate("assignedTo", "firstName lastName email")
      .populate("createdBy", "firstName lastName");

    return res.status(201).json({ success: true, message: "Activity created successfully", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create activity", error: error.message });
  }
};

exports.updateActivityStatus = async (req, res) => {
  try {
    const { status, outcomeNotes } = req.body;
    const activity = await CrmActivity.findOne({ _id: req.params.id, employerId: req.crmEmployerId });
    if (!activity) {
      return res.status(404).json({ success: false, message: "Activity not found" });
    }

    activity.status = status;
    if (status === "completed") {
      activity.completedAt = new Date();
    }
    if (outcomeNotes) {
      activity.outcomeNotes = outcomeNotes;
    }
    await activity.save();

    return res.json({ success: true, message: "Activity status updated", data: activity });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    await CrmActivity.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      { isArchived: true }
    );
    return res.json({ success: true, message: "Activity deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete activity", error: error.message });
  }
};

// ==================== 8. CALENDAR & FOLLOW-UPS ====================
exports.getCalendarEvents = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { startDate, endDate } = req.query;

    const query = { employerId, isArchived: false };
    if (req.crmRole === "employee") {
      query.assignedTo = req.user.id;
    }

    if (startDate && endDate) {
      query.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const events = await CrmActivity.find(query)
      .populate("assignedTo", "firstName lastName email")
      .sort({ dueDate: 1 });

    return res.json({ success: true, data: events });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ==================== 9. MEETINGS & CALLS ====================
exports.getMeetingsAndCalls = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { type, page = 1, limit = 20 } = req.query;

    const query = {
      employerId,
      isArchived: false,
      activityType: type ? type : { $in: ["meeting", "call"] },
    };

    if (req.crmRole === "employee") {
      query.assignedTo = req.user.id;
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      CrmActivity.find(query)
        .populate("assignedTo", "firstName lastName email")
        .sort({ dueDate: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmActivity.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ==================== 10. NOTES MANAGEMENT ====================
exports.getNotes = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { relatedToType, relatedToId, search } = req.query;

    const query = { employerId };
    if (relatedToType) query.relatedToType = relatedToType;
    if (relatedToId) query.relatedToId = relatedToId;
    if (search) {
      query.$or = [{ title: new RegExp(search, "i") }, { content: new RegExp(search, "i") }];
    }

    const notes = await CrmNote.find(query)
      .populate("createdBy", "firstName lastName email")
      .sort({ isPinned: -1, createdAt: -1 });

    return res.json({ success: true, data: notes });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createNote = async (req, res) => {
  try {
    const { title, content, relatedToType, relatedToId, relatedToName, isPinned } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Note content is required" });
    }

    const note = await CrmNote.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      title: title ? title.trim() : "",
      content: content.trim(),
      relatedToType: relatedToType || "general",
      relatedToId: relatedToId || null,
      relatedToName: relatedToName || "",
      isPinned: Boolean(isPinned),
    });

    const populated = await CrmNote.findById(note._id).populate("createdBy", "firstName lastName email");
    return res.status(201).json({ success: true, message: "Note added successfully", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to add note", error: error.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    await CrmNote.findOneAndDelete({ _id: req.params.id, employerId: req.crmEmployerId });
    return res.json({ success: true, message: "Note deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete note", error: error.message });
  }
};

// ==================== 11. EMAIL COMMUNICATION ====================
exports.getEmails = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { relatedToType, relatedToId, page = 1, limit = 20 } = req.query;

    const query = { employerId };
    if (relatedToType) query.relatedToType = relatedToType;
    if (relatedToId) query.relatedToId = relatedToId;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [emails, total] = await Promise.all([
      CrmEmail.find(query)
        .populate("senderId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmEmail.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: emails,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.sendEmail = async (req, res) => {
  try {
    const { toEmail, toName, subject, bodyHtml, bodyText, relatedToType, relatedToId, cc, bcc } = req.body;

    if (!toEmail || !subject) {
      return res.status(400).json({ success: false, message: "Recipient email and subject are required" });
    }

    const fromAddress = process.env.SMTP_FROM || `Templink <${process.env.SMTP_USER}>`;

    let emailStatus = "sent";
    let errorMessage = "";

    // Real send via nodemailer
    if (transporter) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: toEmail,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject,
          text: bodyText || bodyHtml || "",
          html: bodyHtml || bodyText || "",
        });
      } catch (sendErr) {
        console.error("Nodemailer send error:", sendErr);
        emailStatus = "failed";
        errorMessage = sendErr.message;
      }
    } else {
      emailStatus = "failed";
      errorMessage = "SMTP server not configured in environment variables";
    }

    const record = await CrmEmail.create({
      employerId: req.crmEmployerId,
      senderId: req.user.id,
      fromEmail: fromAddress,
      toEmail,
      toName: toName || "",
      cc: Array.isArray(cc) ? cc : [],
      bcc: Array.isArray(bcc) ? bcc : [],
      subject,
      bodyHtml: bodyHtml || "",
      bodyText: bodyText || "",
      status: emailStatus,
      relatedToType: relatedToType || "general",
      relatedToId: relatedToId || null,
      errorMessage,
      sentAt: new Date(),
    });

    if (emailStatus === "failed") {
      return res.status(502).json({
        success: false,
        message: `Email sending failed: ${errorMessage}`,
        data: record,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Email sent successfully",
      data: record,
    });
  } catch (error) {
    console.error("Send email error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ==================== 12. CUSTOMER SUPPORT / CASES ====================
exports.getCases = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { search, status, priority, type, page = 1, limit = 15 } = req.query;

    const query = { employerId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { caseId: searchRegex }, { description: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [cases, total] = await Promise.all([
      CrmCase.find(query)
        .populate("contactId", "firstName lastName email phone")
        .populate("companyId", "name")
        .populate("assignedTo", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmCase.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: cases,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createCase = async (req, res) => {
  try {
    const { title, description, contactId, companyId, priority, type, assignedTo } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Case title is required" });
    }

    const count = await CrmCase.countDocuments({ employerId: req.crmEmployerId });
    const caseId = `CASE-${1000 + count + 1}`;

    const newCase = await CrmCase.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      assignedTo: assignedTo || req.user.id,
      caseId,
      title: title.trim(),
      description: description || "",
      contactId: contactId || null,
      companyId: companyId || null,
      priority: priority || "medium",
      type: type || "problem",
      status: "open",
    });

    const populated = await CrmCase.findById(newCase._id)
      .populate("contactId", "firstName lastName email")
      .populate("assignedTo", "firstName lastName email");

    return res.status(201).json({ success: true, message: "Case created successfully", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create case", error: error.message });
  }
};

exports.updateCase = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.status === "resolved" && !update.resolvedAt) {
      update.resolvedAt = new Date();
    }

    const updatedCase = await CrmCase.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      update,
      { new: true }
    )
      .populate("contactId", "firstName lastName email")
      .populate("assignedTo", "firstName lastName email");

    if (!updatedCase) {
      return res.status(404).json({ success: false, message: "Case not found" });
    }

    return res.json({ success: true, message: "Case updated successfully", data: updatedCase });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update case", error: error.message });
  }
};

// ==================== 13. PRODUCTS & SERVICES ====================
exports.getProducts = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { search, category, type, isActive, page = 1, limit = 20 } = req.query;

    const query = { employerId };
    if (category) query.category = category;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === "true";

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ name: searchRegex }, { sku: searchRegex }, { description: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      CrmProduct.find(query).sort({ name: 1 }).skip(skip).limit(limitNum),
      CrmProduct.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: products,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { sku, name, description, category, unitPrice, currency, taxRate, stockQuantity, type, isActive } = req.body;

    if (!name || !unitPrice) {
      return res.status(400).json({ success: false, message: "Product name and unit price are required" });
    }

    let finalSku = sku;
    if (!finalSku) {
      const count = await CrmProduct.countDocuments({ employerId: req.crmEmployerId });
      finalSku = `SKU-${1000 + count + 1}`;
    }

    const product = await CrmProduct.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      sku: finalSku.toUpperCase(),
      name: name.trim(),
      description: description || "",
      category: category || "General",
      unitPrice: Number(unitPrice),
      currency: currency || "USD",
      taxRate: Number(taxRate) || 0,
      stockQuantity: Number(stockQuantity) || 0,
      type: type || "service",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({ success: true, message: "Product created successfully", data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create product", error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await CrmProduct.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      req.body,
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    return res.json({ success: true, message: "Product updated successfully", data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update product", error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await CrmProduct.findOneAndDelete({ _id: req.params.id, employerId: req.crmEmployerId });
    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete product", error: error.message });
  }
};

// ==================== 14. QUOTATIONS / PROPOSALS ====================
exports.getQuotations = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const { search, status, page = 1, limit = 15 } = req.query;

    const query = { employerId };
    if (status) query.status = status;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ title: searchRegex }, { quoteNumber: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [quotations, total] = await Promise.all([
      CrmQuotation.find(query)
        .populate("dealId", "title amount stage")
        .populate("contactId", "firstName lastName email phone")
        .populate("companyId", "name")
        .populate("assignedTo", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CrmQuotation.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: quotations,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        totalItems: total,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.createQuotation = async (req, res) => {
  try {
    const { title, dealId, contactId, companyId, validUntil, items = [], termsAndConditions, notes, assignedTo } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Quotation title is required" });
    }

    const count = await CrmQuotation.countDocuments({ employerId: req.crmEmployerId });
    const quoteNumber = `QUOTE-${1000 + count + 1}`;

    // Calculate totals from line items
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const calculatedItems = items.map((item) => {
      const qty = Number(item.quantity) || 1;
      const unit = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      const taxR = Number(item.taxRate) || 0;

      const lineBase = qty * unit;
      const lineDisc = (lineBase * disc) / 100;
      const lineTax = ((lineBase - lineDisc) * taxR) / 100;
      const lineTotal = lineBase - lineDisc + lineTax;

      subtotal += lineBase;
      totalDiscount += lineDisc;
      totalTax += lineTax;

      return {
        productId: item.productId || null,
        name: item.name || "Item",
        description: item.description || "",
        quantity: qty,
        unitPrice: unit,
        discount: disc,
        taxRate: taxR,
        lineTotal,
      };
    });

    const grandTotal = subtotal - totalDiscount + totalTax;

    const quote = await CrmQuotation.create({
      employerId: req.crmEmployerId,
      createdBy: req.user.id,
      assignedTo: assignedTo || req.user.id,
      quoteNumber,
      title: title.trim(),
      dealId: dealId || null,
      contactId: contactId || null,
      companyId: companyId || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      items: calculatedItems,
      subtotal,
      totalDiscount,
      totalTax,
      grandTotal,
      termsAndConditions: termsAndConditions || "",
      notes: notes || "",
    });

    const populated = await CrmQuotation.findById(quote._id)
      .populate("contactId", "firstName lastName email")
      .populate("companyId", "name")
      .populate("dealId", "title");

    return res.status(201).json({ success: true, message: "Quotation created successfully", data: populated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create quotation", error: error.message });
  }
};

exports.updateQuotationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const quotation = await CrmQuotation.findOneAndUpdate(
      { _id: req.params.id, employerId: req.crmEmployerId },
      { status },
      { new: true }
    );
    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }
    return res.json({ success: true, message: "Quotation status updated", data: quotation });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update quotation", error: error.message });
  }
};

// ==================== 15. REPORTS & ANALYTICS ====================
exports.getReportsAndAnalytics = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const isEmployee = req.crmRole === "employee";

    if (isEmployee && !req.crmPermissions.canViewReports) {
      return res.status(403).json({ success: false, message: "Access denied to CRM reports" });
    }

    // 1. Monthly revenue trend for the past 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenue = await CrmDeal.aggregate([
      {
        $match: {
          employerId: new mongoose.Types.ObjectId(employerId),
          stage: "closed_won",
          actualCloseDate: { $gte: sixMonthsAgo },
          isArchived: false,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$actualCloseDate" },
            month: { $month: "$actualCloseDate" },
          },
          revenue: { $sum: "$amount" },
          dealsCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // 2. Lead Source breakdown and conversion rate
    const sourceBreakdown = await CrmLead.aggregate([
      { $match: { employerId: new mongoose.Types.ObjectId(employerId), isArchived: false } },
      {
        $group: {
          _id: "$leadSource",
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
          totalValue: { $sum: "$estimatedDealValue" },
        },
      },
      {
        $project: {
          source: "$_id",
          total: 1,
          converted: 1,
          conversionRate: {
            $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$converted", "$total"] }, 100] }, 0],
          },
          totalValue: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);

    // 3. Stage conversion funnel
    const settings = await getOrCreateSettings(employerId);
    const stages = settings.pipelineStages;
    const stageFunnel = await Promise.all(
      stages.map(async (st) => {
        const count = await CrmDeal.countDocuments({
          employerId,
          stage: st.id,
          isArchived: false,
        });
        const sum = await CrmDeal.aggregate([
          { $match: { employerId: new mongoose.Types.ObjectId(employerId), stage: st.id, isArchived: false } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        return {
          stageId: st.id,
          stageName: st.name,
          color: st.color,
          dealsCount: count,
          totalAmount: sum[0]?.total || 0,
        };
      })
    );

    // 4. Sales Rep Leaderboard
    const repPerformance = await CrmDeal.aggregate([
      { $match: { employerId: new mongoose.Types.ObjectId(employerId), isArchived: false } },
      {
        $group: {
          _id: "$assignedTo",
          dealsCount: { $sum: 1 },
          wonCount: { $sum: { $cond: [{ $eq: ["$stage", "closed_won"] }, 1, 0] } },
          wonRevenue: { $sum: { $cond: [{ $eq: ["$stage", "closed_won"] }, "$amount", 0] } },
          lostCount: { $sum: { $cond: [{ $eq: ["$stage", "closed_lost"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          employeeId: "$_id",
          name: {
            $concat: [
              { $ifNull: ["$user.firstName", "Unassigned"] },
              " ",
              { $ifNull: ["$user.lastName", ""] },
            ],
          },
          dealsCount: 1,
          wonCount: 1,
          wonRevenue: 1,
          lostCount: 1,
          winRate: {
            $cond: [{ $gt: ["$dealsCount", 0] }, { $multiply: [{ $divide: ["$wonCount", "$dealsCount"] }, 100] }, 0],
          },
        },
      },
      { $sort: { wonRevenue: -1 } },
    ]);

    return res.json({
      success: true,
      data: {
        monthlyRevenue,
        sourceBreakdown,
        stageFunnel,
        repPerformance,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ==================== 16. CRM SETTINGS & PERMISSIONS ====================
exports.getSettings = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const settings = await getOrCreateSettings(employerId);
    return res.json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    if (req.crmRole === "employee" && !req.crmPermissions.canManageSettings) {
      return res.status(403).json({ success: false, message: "Permission denied to manage settings" });
    }

    const { pipelineStages, defaultCurrency, leadSources, industries, employeePermissions } = req.body;
    const setting = await getOrCreateSettings(req.crmEmployerId);

    if (pipelineStages) setting.pipelineStages = pipelineStages;
    if (defaultCurrency) setting.defaultCurrency = defaultCurrency;
    if (leadSources) setting.leadSources = leadSources;
    if (industries) setting.industries = industries;
    if (employeePermissions) setting.employeePermissions = employeePermissions;

    await setting.save();
    return res.json({ success: true, message: "Settings saved successfully", data: setting });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to save settings", error: error.message });
  }
};

// ==================== 17. TEAM MEMBERS FOR CRM ASSIGNMENTS ====================
exports.getTeamMembers = async (req, res) => {
  try {
    const employerId = req.crmEmployerId;
    const employer = await User.findById(employerId).populate(
      "employerProfile.teamMembers.employeeId",
      "firstName lastName email role employeeProfile"
    );

    const members = [];

    // Add employer themselves
    members.push({
      _id: employer._id,
      firstName: employer.firstName,
      lastName: employer.lastName,
      email: employer.email,
      role: "employer",
      title: "Employer / Owner",
    });

    if (employer.employerProfile?.teamMembers) {
      employer.employerProfile.teamMembers.forEach((tm) => {
        if (tm.employeeId && tm.status === "active") {
          members.push({
            _id: tm.employeeId._id,
            firstName: tm.employeeId.firstName,
            lastName: tm.employeeId.lastName,
            email: tm.employeeId.email,
            role: "employee",
            title: tm.jobTitle || tm.employeeId.employeeProfile?.title || "Team Member",
          });
        }
      });
    }

    return res.json({ success: true, data: members });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
