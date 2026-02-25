const express = require("express");
const router = express.Router();

const proposalController = require("../controllers/proposalController");
const authMiddleware = require("../middleware/auth_middleware");

router.post(
  "/create",
  authMiddleware,
  proposalController.createProposal
);

router.get(
  "/my-points",
  authMiddleware,
  proposalController.getMyPoints
);

router.get("/my", authMiddleware, proposalController.getMyProposals);

router.patch(
  "/accept/:proposalId",
  authMiddleware,
  proposalController.acceptProposal
);
module.exports = router;