const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth_middleware');
const {
  getContract,
  employerSignContract,
  employeeSignContract,  // 👈 Changed
  getUserContracts,
  getContractByProject,
  downloadContractPDF  
} = require('../controllers/contractController');

router.use(auth);

// Get user's contracts
router.get('/my-contracts', getUserContracts);
// Get contract by project
router.get('/project/:projectId', getContractByProject);

// Get single contract
router.get('/:contractId', getContract);

// Employer sign
router.post('/:contractId/employer-sign', employerSignContract);

// Employee sign (freelancer)
router.post('/:contractId/employee-sign', employeeSignContract); // 👈 Changed

router.get('/:contractId/download', downloadContractPDF);


// Download PDF

module.exports = router;