const jwt = require("jsonwebtoken");

const supabase = require("../config/supabase");

const auth = async (req, res, next) => {
  try {
    const authorization = req.header("Authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
    }

    const token = authorization.replace("Bearer ", "").trim();

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT secret is not configured.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, isVerified, createdAt')
      .eq('id', decoded.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "User not found or session expired.",
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    const message = error.name === "TokenExpiredError" 
      ? "Token has expired." 
      : "Invalid or expired token.";
      
    return res.status(401).json({
      success: false,
      message,
    });
  }
};

module.exports = auth;
