const express = require("express");
const { optimizeProductContent } = require("../utils/aiCopilot");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

// @desc    Optimize product content using AI
// @route   POST /api/ai/product-optimize
// @access  Private/Admin
router.post("/product-optimize", auth, admin, async (req, res, next) => {
  try {
    const { name, category, subCategory, material, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Product name is required for AI optimization"
      });
    }

    const optimizedData = await optimizeProductContent({
      name,
      category,
      subCategory,
      material,
      description
    });

    res.json({
      success: true,
      data: optimizedData
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
