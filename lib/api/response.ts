/**
 * Standardized API response types and utilities.
 * Ensures consistent response shapes across all endpoints.
 */

import { NextResponse } from 'next/server';

/**
 * Success response wrapper type.
 */
export type ApiSuccess<T> = {
  success: true;
  data: T;
};

/**
 * Error response type with optional field-level errors.
 */
export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

/**
 * Union type for all API responses.
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Standard error codes used across the API.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  DUPLICATE_GUESS: 'DUPLICATE_GUESS',
  GAME_COMPLETED: 'GAME_COMPLETED',
  NO_ELIGIBLE_PLAYERS: 'NO_ELIGIBLE_PLAYERS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Create a success response.
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data } as ApiSuccess<T>, { status });
}

/**
 * Create an error response.
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  fieldErrors?: Record<string, string[]>
): NextResponse<ApiError> {
  const error: ApiError = {
    success: false,
    error: {
      code,
      message,
      ...(fieldErrors && { fieldErrors }),
    },
  };
  return NextResponse.json(error, { status });
}

/**
 * Create a validation error response (400).
 */
export function validationErrorResponse(
  message: string,
  fieldErrors?: Record<string, string[]>
): NextResponse<ApiError> {
  return errorResponse(ErrorCodes.VALIDATION_ERROR, message, 400, fieldErrors);
}

/**
 * Create a not found error response (404).
 */
export function notFoundResponse(code: ErrorCode, message: string): NextResponse<ApiError> {
  return errorResponse(code, message, 404);
}

/**
 * Create a conflict error response (409).
 */
export function conflictResponse(code: ErrorCode, message: string): NextResponse<ApiError> {
  return errorResponse(code, message, 409);
}

/**
 * Create an internal server error response (500).
 */
export function internalErrorResponse(message: string = 'An unexpected error occurred'): NextResponse<ApiError> {
  return errorResponse(ErrorCodes.INTERNAL_ERROR, message, 500);
}
