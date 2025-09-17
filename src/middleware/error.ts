import { Request, Response, NextFunction } from 'express';
import { APIResponse } from '../types/mpesa';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public data?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response<APIResponse>,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(err.data && { details: err.data })
      }
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error'
    }
  });
};