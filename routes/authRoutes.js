const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const supabase = require("../config/supabase");
const auth = require("../middleware/auth");
const sendEmail = require("../utils/sendEmail");

const { signupSchema, loginSchema, resetPasswordSchema, validate } = require("../utils/validation");

const router = express.Router();

// General auth limiter (signup, resend-otp, etc.)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many requests, please try again after 15 minutes" },
});

// Stricter login limiter to prevent brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many login attempts, please try again after 15 minutes" },
});

// Very strict forgot-password limiter
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, message: "Too many password reset requests, please try again after an hour" },
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const sanitizeUser = (user) => ({
  _id: user.id,
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateEmailTemplate = (title, content) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="color: #394B3F; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">TatiAssam</h2>
    </div>
    <div style="color: #333333; font-size: 16px; line-height: 1.6;">
      <h1 style="color: #111111; font-size: 22px; margin-bottom: 20px; font-weight: 600;">${title}</h1>
      ${content}
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #999999; font-size: 13px;">
      <p>TatiAssam &copy; ${new Date().getFullYear()}. All rights reserved.</p>
    </div>
  </div>
`;

router.post("/signup", authLimiter, validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const trimmedName = name?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPassword = password?.trim();

    if (!trimmedName || !normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    if (normalizedPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
    }

    const { data: existingUser } = await supabase.from("users").select("id").eq("email", normalizedEmail).maybeSingle();

    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 12);
    
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    const { data: user, error: createError } = await supabase.from("users").insert([{
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      otp: hashedOtp,
      otpExpiresAt: otpExpiresAt
    }]).select().single();

    if (createError) {
      console.error(createError);
      return res.status(500).json({ success: false, message: "Failed to create account." });
    }

    try {
      await sendEmail({
        email: user.email,
        subject: "Verify Your TatiAssam Account",
        html: generateEmailTemplate("Welcome to TatiAssam!", `
          <p>Hello${trimmedName ? ` ${trimmedName}` : ''},</p>
          <p>To complete your registration, please use the verification code below:</p>
          <div style="text-align: center; margin: 35px 0;">
            <span style="display: inline-block; padding: 15px 30px; background-color: #f4f7f6; color: #394B3F; font-size: 28px; font-weight: bold; letter-spacing: 6px; border-radius: 8px; border: 1px solid #dce4e0;">${otp}</span>
          </div>
          <p style="color: #666666; font-size: 14px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        `)
      });
    } catch (error) {
      console.error("Failed to send verification email during signup:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Account created, but we couldn't send the verification email. Please try to login to resend the code." 
      });
    }

    return res.status(201).json({
      success: true,
      message: "Signup successful. Please verify your email.",
      requiresVerification: true,
      email: user.email
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (user.role === "admin") {
      return res.status(403).json({ success: false, message: "Admin accounts must log in through the admin portal." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (!user.isVerified) {
      const otp = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const hashedOtp = await bcrypt.hash(otp, 10);
      
      await supabase.from("users").update({ otp: hashedOtp, otpExpiresAt }).eq("id", user.id);

      try {
        await sendEmail({
          email: user.email,
          subject: "Verify Your TatiAssam Account",
          html: generateEmailTemplate("Account Verification", `
            <p>Welcome back! Please verify your login with the code below:</p>
            <div style="text-align: center; margin: 35px 0;">
              <span style="display: inline-block; padding: 15px 30px; background-color: #f4f7f6; color: #394B3F; font-size: 28px; font-weight: bold; letter-spacing: 6px; border-radius: 8px; border: 1px solid #dce4e0;">${otp}</span>
            </div>
            <p style="color: #666666; font-size: 14px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
          `)
        });
      } catch (error) {
        console.error("Failed to send verification email during login:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to send verification email. Please try again later." 
        });
      }

      return res.status(403).json({
        success: false,
        message: "Please verify your email address.",
        requiresVerification: true,
        email: user.email
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token: createToken(user.id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/verify-otp", authLimiter, async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified." });
    }

    if (!user.otp || !user.otpExpiresAt || new Date(user.otpExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    await supabase.from("users").update({ 
      isVerified: true, 
      otp: null, 
      otpExpiresAt: null 
    }).eq("id", user.id);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      token: createToken(user.id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/resend-otp", authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified." });
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    
    await supabase.from("users").update({ otp: hashedOtp, otpExpiresAt }).eq("id", user.id);

    try {
      await sendEmail({
        email: user.email,
        subject: "Verify Your TatiAssam Account",
        html: generateEmailTemplate("Account Verification", `
          <p>You requested a new verification code. Please use the code below:</p>
          <div style="text-align: center; margin: 35px 0;">
            <span style="display: inline-block; padding: 15px 30px; background-color: #f4f7f6; color: #394B3F; font-size: 28px; font-weight: bold; letter-spacing: 6px; border-radius: 8px; border: 1px solid #dce4e0;">${otp}</span>
          </div>
          <p style="color: #666666; font-size: 14px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        `)
      });
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      return res.status(500).json({ success: false, message: "Failed to send email. Please try again later." });
    }

    return res.status(200).json({ success: true, message: "A new OTP has been sent to your email." });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", forgotPasswordLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user) {
      return res.status(200).json({ success: true, message: "If your email is registered, a reset link will be sent to it." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from("users").update({ 
      resetPasswordToken: hashedToken, 
      resetPasswordExpiresAt: resetExpiresAt 
    }).eq("id", user.id);

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}&email=${user.email}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Reset Your TatiAssam Password",
        html: generateEmailTemplate("Password Reset Request", `
          <p>We received a request to reset your password for your TatiAssam account.</p>
          <p>Click the secure link below to set a new password:</p>
          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #394B3F; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">Reset Password</a>
          </div>
          <p style="color: #666666; font-size: 14px; margin-top: 20px;">If you did not request a password reset, you can safely ignore this email. This secure link will expire in 1 hour.</p>
        `)
      });
    } catch (error) {
      console.error("Failed to send reset email:", error);
      await supabase.from("users").update({ 
        resetPasswordToken: null, 
        resetPasswordExpiresAt: null 
      }).eq("id", user.id);
      return res.status(500).json({ success: false, message: "Failed to send reset email. Please try again later." });
    }

    return res.status(200).json({ success: true, message: "If your email is registered, a reset link will be sent to it." });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { email, token, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !token || !password) {
      return res.status(400).json({ success: false, message: "Invalid request data." });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpiresAt || new Date(user.resetPasswordExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token." });
    }

    const isMatch = await bcrypt.compare(token, user.resetPasswordToken);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const updateData = {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null
    };
    
    if (!user.isVerified) {
      updateData.isVerified = true;
      updateData.otp = null;
      updateData.otpExpiresAt = null;
    }
    
    await supabase.from("users").update(updateData).eq("id", user.id);

    return res.status(200).json({ success: true, message: "Password has been reset successfully." });
  } catch (error) {
    next(error);
  }
});

router.post("/admin-login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user || user.role !== "admin") {
      return res.status(401).json({ success: false, message: "Invalid admin credentials or unauthorized access." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid admin credentials or unauthorized access." });
    }

    // Generate 2FA OTP for Admin
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
    const hashedOtp = await bcrypt.hash(otp, 10);

    await supabase.from("users").update({ otp: hashedOtp, otpExpiresAt }).eq("id", user.id);

    try {
      await sendEmail({
        email: user.email,
        subject: "Secure Admin Verification - TatiAssam",
        html: generateEmailTemplate("Admin Access Verification", `
          <p>A login attempt was made for the <strong>TatiAssam Admin Command Center</strong>.</p>
          <p>Please enter the following verification code to complete your secure login:</p>
          <div style="text-align: center; margin: 35px 0;">
            <span style="display: inline-block; padding: 15px 30px; background-color: #f0f7ff; color: #0066cc; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; border: 1px solid #cce3ff;">${otp}</span>
          </div>
          <p style="color: #666666; font-size: 14px;">This code is valid for 10 minutes. If you did not initiate this login, please secure your account immediately.</p>
        `)
      });
    } catch (error) {
      console.error("Failed to send admin 2FA email:", error);
      return res.status(500).json({ success: false, message: "Failed to send verification email." });
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your admin email.",
      requiresOTP: true,
      email: user.email
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin-verify-otp", authLimiter, async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ success: false, message: "Email and verification code are required." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user || user.role !== "admin") {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    if (!user.otp || !user.otpExpiresAt || new Date(user.otpExpiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: "Verification code has expired." });
    }

    const isMatch = await bcrypt.compare(otp, user.otp);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid verification code." });
    }

    // Clear OTP after successful login
    await supabase.from("users").update({ otp: null, otpExpiresAt: null }).eq("id", user.id);

    return res.status(200).json({
      success: true,
      message: "Admin verification successful.",
      token: createToken(user.id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin-resend-otp", authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();

    if (!user || user.role !== "admin") {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    
    await supabase.from("users").update({ otp: hashedOtp, otpExpiresAt }).eq("id", user.id);

    try {
      await sendEmail({
        email: user.email,
        subject: "Secure Admin Verification - Codex",
        html: generateEmailTemplate("New Verification Code", `
          <p>You requested a new verification code for the Codex Admin Command Center.</p>
          <div style="text-align: center; margin: 35px 0;">
            <span style="display: inline-block; padding: 15px 30px; background-color: #f0f7ff; color: #0066cc; font-size: 32px; font-weight: bold; letter-spacing: 8px; border-radius: 8px; border: 1px solid #cce3ff;">${otp}</span>
          </div>
          <p style="color: #666666; font-size: 14px;">This code is valid for 10 minutes.</p>
        `)
      });
    } catch (error) {
      console.error("Failed to resend admin 2FA email:", error);
      return res.status(500).json({ success: false, message: "Failed to send verification email." });
    }

    return res.status(200).json({ success: true, message: "A new verification code has been sent." });
  } catch (error) {
    next(error);
  }
});

router.get("/me", auth, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

module.exports = router;
