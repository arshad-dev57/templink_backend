const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth_middleware");
const crmAuth = require("../middleware/crm_auth_middleware");
const crmController = require("../controllers/crm_controller");

// All CRM routes require standard token authentication and organization context resolution
router.use(auth);
router.use(crmAuth);

// 1. Dashboard & Analytics
router.get("/dashboard", crmController.getDashboardAnalytics);

// 2. Leads Management
router.get("/leads", crmController.getLeads);
router.post("/leads", crmController.createLead);
router.get("/leads/:id", crmController.getLeadById);
router.put("/leads/:id", crmController.updateLead);
router.delete("/leads/:id", crmController.deleteLead);
router.post("/leads/:id/convert", crmController.convertLead);

// 3. Contacts Management
router.get("/contacts", crmController.getContacts);
router.post("/contacts", crmController.createContact);
router.put("/contacts/:id", crmController.updateContact);
router.delete("/contacts/:id", crmController.deleteContact);

// 4. Companies / Accounts Management
router.get("/companies", crmController.getCompanies);
router.post("/companies", crmController.createCompany);
router.put("/companies/:id", crmController.updateCompany);
router.delete("/companies/:id", crmController.deleteCompany);

// 5. Deals & Opportunities
router.get("/deals", crmController.getDeals);
router.post("/deals", crmController.createDeal);
router.put("/deals/:id", crmController.updateDeal);
router.patch("/deals/:id/stage", crmController.updateDealStage);
router.delete("/deals/:id", crmController.deleteDeal);

// 6. Sales Pipeline
router.get("/pipeline", crmController.getSalesPipeline);

// 7. Tasks & Activities
router.get("/activities", crmController.getActivities);
router.post("/activities", crmController.createActivity);
router.patch("/activities/:id/status", crmController.updateActivityStatus);
router.delete("/activities/:id", crmController.deleteActivity);

// 8. Calendar & Follow-ups
router.get("/calendar", crmController.getCalendarEvents);

// 9. Meetings & Calls
router.get("/meetings-calls", crmController.getMeetingsAndCalls);

// 10. Notes
router.get("/notes", crmController.getNotes);
router.post("/notes", crmController.createNote);
router.delete("/notes/:id", crmController.deleteNote);

// 11. Email Communication
router.get("/emails", crmController.getEmails);
router.post("/emails/send", crmController.sendEmail);

// 12. Customer Support / Cases
router.get("/cases", crmController.getCases);
router.post("/cases", crmController.createCase);
router.put("/cases/:id", crmController.updateCase);

// 13. Products & Services
router.get("/products", crmController.getProducts);
router.post("/products", crmController.createProduct);
router.put("/products/:id", crmController.updateProduct);
router.delete("/products/:id", crmController.deleteProduct);

// 14. Quotations / Proposals
router.get("/quotations", crmController.getQuotations);
router.post("/quotations", crmController.createQuotation);
router.patch("/quotations/:id/status", crmController.updateQuotationStatus);

// 15. Reports & Analytics
router.get("/reports", crmController.getReportsAndAnalytics);

// 16. CRM Settings & Permissions
router.get("/settings", crmController.getSettings);
router.put("/settings", crmController.updateSettings);

// Team Members for assignment
router.get("/team-members", crmController.getTeamMembers);

module.exports = router;
