const router = require("express").Router();
const { createOrder, captureOrder } = require("../controllers/paypal_Controller");

router.post("/create-order", createOrder);
router.post("/capture-order", captureOrder);

module.exports = router;
