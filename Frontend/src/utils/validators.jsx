import { VALIDATION_RULES } from './constants'

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false
  return VALIDATION_RULES.EMAIL.PATTERN.test(email)
}

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Whether phone number is valid
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false
  return VALIDATION_RULES.PHONE.PATTERN.test(phone)
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid and errors
 */
export const validatePassword = (password) => {
  const errors = []
  
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Password is required'] }
  }

  if (password.length < VALIDATION_RULES.PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${VALIDATION_RULES.PASSWORD.MIN_LENGTH} characters long`)
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: getPasswordStrength(password)
  }
}

/**
 * Get password strength score
 * @param {string} password - Password to evaluate
 * @returns {object} - Strength score and label
 */
export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: 'Very Weak' }

  let score = 0
  
  // Length
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  
  // Character types
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1
  
  // Patterns
  if (!/(.)\1{2,}/.test(password)) score += 1 // No repeated characters
  if (!/123|abc|qwe/i.test(password)) score += 1 // No common sequences

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const colors = ['red', 'orange', 'yellow', 'blue', 'green', 'emerald']
  
  const index = Math.min(Math.floor(score / 1.5), labels.length - 1)
  
  return {
    score,
    label: labels[index],
    color: colors[index],
    percentage: (score / 8) * 100
  }
}

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field
 * @returns {string|null} - Error message or null if valid
 */
export const validateRequired = (value, fieldName = 'This field') => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return `${fieldName} is required`
  }
  
  if (Array.isArray(value) && value.length === 0) {
    return `${fieldName} is required`
  }
  
  return null
}

/**
 * Validate string length
 * @param {string} value - String to validate
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @param {string} fieldName - Name of the field
 * @returns {string|null} - Error message or null if valid
 */
export const validateLength = (value, min = 0, max = Infinity, fieldName = 'This field') => {
  if (!value || typeof value !== 'string') return null
  
  if (value.length < min) {
    return `${fieldName} must be at least ${min} characters long`
  }
  
  if (value.length > max) {
    return `${fieldName} must be no more than ${max} characters long`
  }
  
  return null
}

/**
 * Validate number range
 * @param {number} value - Number to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} fieldName - Name of the field
 * @returns {string|null} - Error message or null if valid
 */
export const validateRange = (value, min = -Infinity, max = Infinity, fieldName = 'This field') => {
  if (typeof value !== 'number' || isNaN(value)) {
    return `${fieldName} must be a valid number`
  }
  
  if (value < min) {
    return `${fieldName} must be at least ${min}`
  }
  
  if (value > max) {
    return `${fieldName} must be no more than ${max}`
  }
  
  return null
}

/**
 * Validate date
 * @param {string|Date} date - Date to validate
 * @param {string} fieldName - Name of the field
 * @returns {string|null} - Error message or null if valid
 */
export const validateDate = (date, fieldName = 'Date') => {
  if (!date) return null
  
  const dateObj = new Date(date)
  
  if (isNaN(dateObj.getTime())) {
    return `${fieldName} must be a valid date`
  }
  
  return null
}

/**
 * Validate date range
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {string|null} - Error message or null if valid
 */
export const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return null
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Both dates must be valid'
  }
  
  if (start > end) {
    return 'Start date must be before end date'
  }
  
  return null
}

/**
 * Validate file upload
 * @param {File} file - File to validate
 * @param {object} options - Validation options
 * @returns {string|null} - Error message or null if valid
 */
export const validateFile = (file, options = {}) => {
  if (!file) return null
  
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf']
  } = options
  
  // Check file size
  if (file.size > maxSize) {
    return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
  }
  
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
  }
  
  // Check file extension
  const extension = '.' + file.name.split('.').pop().toLowerCase()
  if (!allowedExtensions.includes(extension)) {
    return `File extension not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
  }
  
  return null
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @param {string} fieldName - Name of the field
 * @returns {string|null} - Error message or null if valid
 */
export const validateUrl = (url, fieldName = 'URL') => {
  if (!url || typeof url !== 'string') return null
  
  try {
    new URL(url)
    return null
  } catch {
    return `${fieldName} must be a valid URL`
  }
}

/**
 * Validate employee ID format
 * @param {string} employeeId - Employee ID to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateEmployeeId = (employeeId) => {
  if (!employeeId || typeof employeeId !== 'string') {
    return 'Employee ID is required'
  }
  
  // Allow formats like EMP001, EMP-001, 001, etc.
  if (!/^(EMP[-]?)?\d{3,}$/i.test(employeeId)) {
    return 'Employee ID must be in format EMP001 or similar'
  }
  
  return null
}

/**
 * Validate form data against schema
 * @param {object} data - Form data to validate
 * @param {object} schema - Validation schema
 * @returns {object} - Validation result with errors
 */
export const validateForm = (data, schema) => {
  const errors = {}
  let isValid = true
  
  Object.keys(schema).forEach(field => {
    const rules = schema[field]
    const value = data[field]
    
    // Check required
    if (rules.required) {
      const error = validateRequired(value, rules.label || field)
      if (error) {
        errors[field] = error
        isValid = false
        return
      }
    }
    
    // Skip other validations if field is empty and not required
    if (!value && !rules.required) return
    
    // Check email
    if (rules.email && !isValidEmail(value)) {
      errors[field] = `${rules.label || field} must be a valid email`
      isValid = false
    }
    
    // Check phone
    if (rules.phone && !isValidPhone(value)) {
      errors[field] = `${rules.label || field} must be a valid phone number`
      isValid = false
    }
    
    // Check length
    if (rules.minLength || rules.maxLength) {
      const error = validateLength(
        value,
        rules.minLength || 0,
        rules.maxLength || Infinity,
        rules.label || field
      )
      if (error) {
        errors[field] = error
        isValid = false
      }
    }
    
    // Check range
    if (rules.min !== undefined || rules.max !== undefined) {
      const error = validateRange(
        value,
        rules.min,
        rules.max,
        rules.label || field
      )
      if (error) {
        errors[field] = error
        isValid = false
      }
    }
    
    // Check custom validation
    if (rules.validate && typeof rules.validate === 'function') {
      const error = rules.validate(value, data)
      if (error) {
        errors[field] = error
        isValid = false
      }
    }
  })
  
  return { isValid, errors }
}

export default {
  isValidEmail,
  isValidPhone,
  validatePassword,
  getPasswordStrength,
  validateRequired,
  validateLength,
  validateRange,
  validateDate,
  validateDateRange,
  validateFile,
  validateUrl,
  validateEmployeeId,
  validateForm,
}