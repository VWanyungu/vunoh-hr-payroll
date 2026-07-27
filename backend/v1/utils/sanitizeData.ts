const SENSITIVE_FIELDS = [
  'passwordHash',
  'password_hash',
  'password',
  // 'token',
  // 'refreshToken',
  // 'refresh_token',
  // 'forgotPasswordToken',
  // 'forgot_password_token',
];

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }
  
  return sanitized;
}

export function sanitizeArray<T extends Record<string, unknown>>(arr: T[]): T[] {
  return arr.map(item => sanitizeObject(item));
}

export function deepSanitize(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => deepSanitize(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.includes(key)) {
        continue;
      }
      sanitized[key] = deepSanitize(value);
    }
    
    return sanitized;
  }

  return data;
}

export function sanitizeResponse(data: unknown): unknown {
  if (Array.isArray(data)) {
    return sanitizeArray(data as Record<string, unknown>[]);
  }
  
  if (typeof data === 'object' && data !== null) {
    return sanitizeObject(data as Record<string, unknown>);
  }
  
  return data;
}
