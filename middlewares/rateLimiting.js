import rateLimit from 'express-rate-limit';

// Apply to all requests
export const globalLimiter = rateLimit({
  windowMs: 1000,
  // windowMs: 5 * 60 * 1000,
  max: 300,
  handler: (req, res, next, options) => {
    return res.status(429).json({
      error: "Rate limit exceeded. Please try again later.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiting on sensitive routes
export const authLimiter = rateLimit({
  windowMs: 1000,
  // windowMs: 15 * 60 * 1000,
  max: 5,
  handler: (req, res, next, options) => {
    return res.status(429).json({
      error: "Rate limit exceeded. Please try again later.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

