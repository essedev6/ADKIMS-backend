import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

// Extend Express Request type to include user information
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
  };
  userId?: string;
  role?: string;
}

// Enhanced authentication middleware
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    if (!decoded.userId) {
      return res.status(403).json({
        success: false,
        message: 'Invalid token structure'
      });
    }

    // Fetch user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found or account deleted'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact administrator.'
      });
    }

    // Attach user information to request object
    req.userId = decoded.userId;
    req.role = decoded.role;
    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status
    };

    next();
  } catch (error: any) {
    console.error('Authentication error:', error);

    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token has expired'
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required roles: ' + allowedRoles.join(', ')
      });
    }

    next();
  };
};

// Specific role middlewares for convenience
export const requireSuperAdmin = requireRole(['Super Admin']);
export const requireAdmin = requireRole(['Super Admin', 'Admin']);
export const requireSupportStaff = requireRole(['Super Admin', 'Admin', 'Support Staff']);

// Optional authentication middleware (doesn't block request)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // Continue without user data
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    if (decoded.userId) {
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.status === 'active') {
        req.userId = decoded.userId;
        req.role = decoded.role;
        req.user = {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't block the request on token errors
    console.error('Optional auth error:', error);
    next();
  }
};

// Rate limiting helper (you can integrate with a proper rate limiter later)
export const checkRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // This is a basic implementation. Consider using express-rate-limit for production
  const rateLimitWindow = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // Maximum requests per window
  
  // You would typically store this in Redis or similar for production
  console.log(`Rate limit check for IP: ${req.ip}`);
  
  // For now, just log and continue
  // In production, implement proper rate limiting
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

// Error handling middleware (should be used last)
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Unhandled error:', error);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    // Only include stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};