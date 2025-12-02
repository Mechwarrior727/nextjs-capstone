export function sanitizeText(input: string): string {
    if (!input) return '';

    return input
        .trim()
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove script tags and their content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove event handlers (onclick, onerror, etc.)
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        // Remove javascript: protocol
        .replace(/javascript:/gi, '')
        // Remove data: protocol (can be used for XSS)
        .replace(/data:text\/html/gi, '')
        // Limit to reasonable length to prevent DoS
        .slice(0, 10000);
}

/**
 * Sanitizes and validates a group name
 */
export function sanitizeGroupName(name: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = sanitizeText(name);

    if (!sanitized || sanitized.length === 0) {
        return { valid: false, sanitized: '', error: 'Group name cannot be empty' };
    }

    if (sanitized.length > 100) {
        return { valid: false, sanitized: sanitized.slice(0, 100), error: 'Group name must be 100 characters or less' };
    }

    // Check for only whitespace
    if (!/\S/.test(sanitized)) {
        return { valid: false, sanitized: '', error: 'Group name cannot be only whitespace' };
    }

    return { valid: true, sanitized };
}

/**
 * Sanitizes and validates a description
 */
export function sanitizeDescription(description: string, maxLength: number = 200): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = sanitizeText(description);

    if (sanitized.length > maxLength) {
        return { valid: false, sanitized: sanitized.slice(0, maxLength), error: `Description must be ${maxLength} characters or less` };
    }

    return { valid: true, sanitized };
}

/**
 * Sanitizes and validates a goal title
 */
export function sanitizeGoalTitle(title: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = sanitizeText(title);

    if (!sanitized || sanitized.length === 0) {
        return { valid: false, sanitized: '', error: 'Goal title cannot be empty' };
    }

    if (sanitized.length > 100) {
        return { valid: false, sanitized: sanitized.slice(0, 100), error: 'Goal title must be 100 characters or less' };
    }

    if (!/\S/.test(sanitized)) {
        return { valid: false, sanitized: '', error: 'Goal title cannot be only whitespace' };
    }

    return { valid: true, sanitized };
}

/**
 * Sanitizes chat messages
 */
export function sanitizeChatMessage(message: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = sanitizeText(message);

    if (!sanitized || sanitized.length === 0) {
        return { valid: false, sanitized: '', error: 'Message cannot be empty' };
    }

    if (sanitized.length > 1000) {
        return { valid: false, sanitized: sanitized.slice(0, 1000), error: 'Message must be 1000 characters or less' };
    }

    if (!/\S/.test(sanitized)) {
        return { valid: false, sanitized: '', error: 'Message cannot be only whitespace' };
    }

    return { valid: true, sanitized };
}

/**
 * Validates numeric input (for targets, amounts, etc.)
 */
export function validateNumericInput(value: string, options: {
    min?: number;
    max?: number;
    allowDecimals?: boolean;
    fieldName?: string;
}): { valid: boolean; value: number; error?: string } {
    const { min, max, allowDecimals = false, fieldName = 'Value' } = options;

    // Remove any non-numeric characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, '');

    if (!cleaned) {
        return { valid: false, value: 0, error: `${fieldName} is required` };
    }

    const numValue = allowDecimals ? parseFloat(cleaned) : parseInt(cleaned, 10);

    if (isNaN(numValue)) {
        return { valid: false, value: 0, error: `${fieldName} must be a valid number` };
    }

    if (min !== undefined && numValue < min) {
        return { valid: false, value: numValue, error: `${fieldName} must be at least ${min}` };
    }

    if (max !== undefined && numValue > max) {
        return { valid: false, value: numValue, error: `${fieldName} must be at most ${max}` };
    }

    return { valid: true, value: numValue };
}

/**
 * Sanitizes display name
 */
export function sanitizeDisplayName(name: string): { valid: boolean; sanitized: string; error?: string } {
    const sanitized = sanitizeText(name);

    if (sanitized.length > 100) {
        return { valid: false, sanitized: sanitized.slice(0, 100), error: 'Display name must be 100 characters or less' };
    }

    return { valid: true, sanitized };
}

/**
 * Validates email format (basic validation)
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
}

/**
 * Sanitizes user input for SQL/database operations
 * Note: You should still use parameterized queries, but this adds an extra layer
 */
export function sanitizeForDatabase(input: string): string {
    return sanitizeText(input)
        // Remove SQL keywords that could be dangerous
        .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi, '')
        // Remove SQL comment indicators
        .replace(/(--|\/\*|\*\/)/g, '');
}

/**
 * Rate limiting helper - stores attempt timestamps in memory
 * For production, use Redis or similar
 */
const rateLimitStore = new Map<string, number[]>();

export function checkRateLimit(
    identifier: string,
    maxAttempts: number = 5,
    windowMs: number = 60000 // 1 minute default
): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const attempts = rateLimitStore.get(identifier) || [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < windowMs);

    if (recentAttempts.length >= maxAttempts) {
        const oldestAttempt = Math.min(...recentAttempts);
        const retryAfter = Math.ceil((oldestAttempt + windowMs - now) / 1000);
        return { allowed: false, retryAfter };
    }

    // Add current attempt
    recentAttempts.push(now);
    rateLimitStore.set(identifier, recentAttempts);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
        for (const [key, times] of rateLimitStore.entries()) {
            const validTimes = times.filter(time => now - time < windowMs);
            if (validTimes.length === 0) {
                rateLimitStore.delete(key);
            } else {
                rateLimitStore.set(key, validTimes);
            }
        }
    }

    return { allowed: true };
}