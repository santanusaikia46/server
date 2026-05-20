const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env vars first
dotenv.config();

const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const hpp = require("hpp");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const blogRoutes = require("./routes/blogRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - required for express-rate-limit to work behind proxies like Render/Vercel
app.set("trust proxy", 1);


// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://jaxvgubohtmsjzyejpwb.supabase.co"],
      connectSrc: ["'self'", "https://jaxvgubohtmsjzyejpwb.supabase.co", "https://api.cloudinary.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(morgan("combined")); // More detailed logging for security auditing

// Prevent XSS attacks
app.use(xss());

// Prevent HTTP param pollution
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

const allowedOrigins = [
  process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : undefined,
  "http://localhost:3000",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(url => url.trim().replace(/\/$/, "")) : [])
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      const originClean = origin ? origin.replace(/\/$/, "") : origin;

      // Allow if origin is in the allowed list, or if it's a Vercel deployment URL
      if (!originClean || allowedOrigins.includes(originClean) || originClean.endsWith(".vercel.app")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Welcome to the TatiAssam API. Server is live and running." });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Secure Central Error Handler
app.use((err, req, res, next) => {
  // Log the error internally for debugging
  console.error(`[ERROR] ${new Date().toISOString()}:`, err.stack || err);

  // Determine status code
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  // Safe error message for client
  const message = process.env.NODE_ENV === "production" && statusCode === 500
    ? "An internal server error occurred. Please try again later."
    : err.message || "Something went wrong on the server.";

  res.status(statusCode).json({
    success: false,
    message,
    // Only include stack trace and error details in non-production environments
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
      details: err.details || null
    }),
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);

    // Self-ping to keep the server awake (specifically for free tier hosting like Render)
    // Runs every 60 seconds
    const pingInterval = 60 * 1000;
    setInterval(async () => {
      try {
        // Use the public server URL if available, otherwise fallback to localhost
        const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
        const response = await fetch(`${serverUrl}/api/health`);
        if (response.ok) {
          console.log(`[Keep-Alive] Ping successful at ${new Date().toISOString()}`);
        } else {
          console.log(`[Keep-Alive] Ping failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error(`[Keep-Alive] Ping error:`, error.message);
      }
    }, pingInterval);
  });
}

module.exports = app;
