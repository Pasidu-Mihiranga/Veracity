import { NextResponse } from 'next/server';
import { z } from 'zod';

export type ApiErrorDetail = {
  field?: string;
  message: string;
};

export type ApiResponseEnvelope<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  timestamp: string;
};

export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit): NextResponse<ApiResponseEnvelope<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status, headers },
  );
}

export function apiError(
  message: string,
  status = 400,
  code = 'BAD_REQUEST',
  details?: ApiErrorDetail[],
  headers?: HeadersInit,
): NextResponse<ApiResponseEnvelope<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && details.length > 0 ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
    },
    { status, headers },
  );
}

export async function parseAndValidateJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ success: true; data: z.infer<T> } | { success: false; response: NextResponse<ApiResponseEnvelope<never>> }> {
  try {
    const raw = await req.json();
    const result = schema.safeParse(raw);
    if (!result.success) {
      const details: ApiErrorDetail[] = result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return {
        success: false,
        response: apiError('Validation failed', 400, 'INVALID_PAYLOAD', details),
      };
    }
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: apiError('Invalid JSON body', 400, 'MALFORMED_JSON'),
    };
  }
}
