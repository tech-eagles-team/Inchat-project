/**
 * Validate email format
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validate phone number format (E.164)
 */
export const isValidPhoneNumber = (phone) => {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};

/**
 * Validate password strength
 */
export const isValidPassword = (password) => {
    // At least 8 characters, uppercase, lowercase, and number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
};

/**
 * Validate username format
 */
export const isValidUsername = (username) => {
    if (!username) return true; // Username is optional
    // 3-30 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
};

/**
 * Escape HTML special characters to prevent XSS
 */
export const escapeHtml = (text) => {
    if (typeof text !== 'string') return text;

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
};

/**
 * Remove potentially malicious scripts from input
 */
export const removeMaliciousContent = (text) => {
    if (typeof text !== 'string') return text;
    // Remove script tags and event handlers
    return text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
};

/**
 * Validate and sanitize string input
 */
export const validateAndSanitizeString = (input, maxLength = 5000) => {
    if (typeof input !== 'string') {
        return { valid: false, error: 'Input must be a string' };
    }

    const trimmed = input.trim();

    if (trimmed.length === 0) {
        return { valid: false, error: 'Input cannot be empty' };
    }

    if (trimmed.length > maxLength) {
        return { valid: false, error: `Input must be ${maxLength} characters or less` };
    }

    // Remove potentially harmful content
    const sanitized = removeMaliciousContent(trimmed);

    return { valid: true, sanitized };
};

/**
 * Validate and sanitize user registration data
 */
export const validateRegistrationData = (data) => {
    const errors = [];

    // Email validation
    if (!data.email || !isValidEmail(data.email)) {
        errors.push('Invalid email address');
    }

    // Username validation
    if (!data.username || data.username.trim().length === 0) {
        errors.push('Username is required');
    } else if (data.username.length > 30) {
        errors.push('Username must be 30 characters or less');
    }

    // Password validation
    if (!data.password || !isValidPassword(data.password)) {
        errors.push('Password must be at least 8 characters with uppercase, lowercase, and number');
    }

    // Username validation (optional)
    if (data.username && !isValidUsername(data.username)) {
        errors.push('Username must be 3-30 characters, alphanumeric and underscores only');
    }

    // Phone number validation (optional)
    if (data.phoneNumber && !isValidPhoneNumber(data.phoneNumber)) {
        errors.push('Phone number must be in E.164 format (e.g., +1234567890)');
    }

    return { isValid: errors.length === 0, errors };
};
