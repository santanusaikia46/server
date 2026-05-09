const { z } = require("zod");

// User Schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  email: z.string().email("Invalid email address").toLowerCase(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase(),
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Order Schemas
const orderSchema = z.object({
  orderItems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
    image: z.string(),
    quantity: z.number().int().positive(),
  })).min(1, "Order must contain at least one item"),
  shippingAddress: z.object({
    address: z.string().min(5, "Address is required"),
    city: z.string().min(2, "City is required"),
    postalCode: z.string().min(5, "Postal code is required"),
    country: z.string().min(2, "Country is required"),
  }),
  paymentMethod: z.string().min(1, "Payment method is required"),
  totalPrice: z.number().positive("Total price must be positive"),
});

// Enquiry Schema
const enquirySchema = z.object({
  name: z.string().min(2, "Name is required").trim(),
  email: z.string().email("Invalid email address").toLowerCase(),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
  product: z.string().min(1, "Product ID is required"),
  price: z.number(),
  color: z.string().optional(),
  size: z.string().optional(),
  preferredContact: z.enum(["Email", "Phone", "WhatsApp"]).default("Email"),
});

// Product Schema
const productSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  price: z.number().nonnegative("Price must be non-negative").optional(),
  description: z.string().min(10, "Description must be at least 10 characters"),
  image: z.string().url("Valid image URL is required").optional(),
  images: z.array(z.string().url()).optional(),
  category: z.string().min(1, "Category is required").optional(),
  subCategory: z.string().optional(),
  vendor: z.string().optional(),
  countInStock: z.number().int().nonnegative("Stock count must be non-negative").optional(),
  material: z.string().optional(),
  careInstructions: z.string().optional(),
  fit: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  featured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  variants: z.array(z.any()).optional(),
  marketing: z.any().optional(),
});

// UUID validation helper
const idSchema = z.string().uuid("Invalid ID format");

// Middleware for validation
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    const issues = error.errors || error.issues || [];
    
    if (Array.isArray(issues) && issues.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed: " + issues.map(e => e.message).join(", "),
        errors: issues.map(err => ({
          field: err.path ? err.path.join('.') : '',
          message: err.message
        }))
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Invalid request data"
    });
  }
};

const validateId = (req, res, next) => {
  try {
    idSchema.parse(req.params.id);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format"
    });
  }
};

module.exports = {
  loginSchema,
  signupSchema,
  resetPasswordSchema,
  orderSchema,
  enquirySchema,
  productSchema,
  validate,
  validateId
};
