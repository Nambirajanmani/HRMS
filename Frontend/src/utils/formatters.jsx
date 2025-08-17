import { format, parseISO, isValid } from 'date-fns'

/**
 * Format currency value
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (default: USD)
 * @param {string} locale - Locale for formatting (default: en-US)
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '$0.00'
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format number with thousand separators
 * @param {number} number - The number to format
 * @param {string} locale - Locale for formatting (default: en-US)
 * @returns {string} - Formatted number string
 */
export const formatNumber = (number, locale = 'en-US') => {
  if (typeof number !== 'number' || isNaN(number)) {
    return '0'
  }

  return new Intl.NumberFormat(locale).format(number)
}

/**
 * Format percentage
 * @param {number} value - The value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} - Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%'
  }

  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format date
 * @param {string|Date} date - The date to format
 * @param {string} formatString - Format string (default: 'MMM dd, yyyy')
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, formatString = 'MMM dd, yyyy') => {
  if (!date) return 'N/A'

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(dateObj)) return 'Invalid Date'
    return format(dateObj, formatString)
  } catch (error) {
    console.error('Date formatting error:', error)
    return 'Invalid Date'
  }
}

/**
 * Format date and time
 * @param {string|Date} date - The date to format
 * @param {string} formatString - Format string (default: 'MMM dd, yyyy HH:mm')
 * @returns {string} - Formatted datetime string
 */
export const formatDateTime = (date, formatString = 'MMM dd, yyyy HH:mm') => {
  return formatDate(date, formatString)
}

/**
 * Format time
 * @param {string|Date} date - The date to format
 * @param {string} formatString - Format string (default: 'HH:mm')
 * @returns {string} - Formatted time string
 */
export const formatTime = (date, formatString = 'HH:mm') => {
  return formatDate(date, formatString)
}

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted file size string
 */
export const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Format phone number
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return ''

  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '')

  // Format US phone numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  // Format international numbers with country code
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }

  // Return original if can't format
  return phoneNumber
}

/**
 * Format name (capitalize first letter of each word)
 * @param {string} name - The name to format
 * @returns {string} - Formatted name
 */
export const formatName = (name) => {
  if (!name || typeof name !== 'string') return ''

  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format employee ID
 * @param {string} id - The employee ID to format
 * @param {string} prefix - Prefix for the ID (default: 'EMP')
 * @returns {string} - Formatted employee ID
 */
export const formatEmployeeId = (id, prefix = 'EMP') => {
  if (!id) return ''

  // If already has prefix, return as is
  if (id.startsWith(prefix)) return id

  // Add prefix and pad with zeros
  const numericPart = id.replace(/\D/g, '')
  return `${prefix}${numericPart.padStart(3, '0')}`
}

/**
 * Format duration in hours and minutes
 * @param {number} minutes - Duration in minutes
 * @returns {string} - Formatted duration string
 */
export const formatDuration = (minutes) => {
  if (typeof minutes !== 'number' || minutes < 0) return '0m'

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) {
    return `${remainingMinutes}m`
  }

  if (remainingMinutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainingMinutes}m`
}

/**
 * Format address
 * @param {object} address - Address object with street, city, state, zip
 * @returns {string} - Formatted address string
 */
export const formatAddress = (address) => {
  if (!address || typeof address !== 'object') return ''

  const { street, city, state, zip, country } = address
  const parts = []

  if (street) parts.push(street)
  if (city) parts.push(city)
  if (state) parts.push(state)
  if (zip) parts.push(zip)
  if (country && country !== 'US') parts.push(country)

  return parts.join(', ')
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 50)
 * @returns {string} - Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || typeof text !== 'string') return ''

  if (text.length <= maxLength) return text

  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Format enum values to readable text
 * @param {string} enumValue - Enum value to format
 * @returns {string} - Formatted readable text
 */
export const formatEnumValue = (enumValue) => {
  if (!enumValue || typeof enumValue !== 'string') return ''

  return enumValue
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format initials from name
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} - Formatted initials
 */
export const formatInitials = (firstName, lastName) => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : ''
  const last = lastName ? lastName.charAt(0).toUpperCase() : ''
  return `${first}${last}`
}

export default {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDate,
  formatDateTime,
  formatTime,
  formatFileSize,
  formatPhoneNumber,
  formatName,
  formatEmployeeId,
  formatDuration,
  formatAddress,
  truncateText,
  formatEnumValue,
  formatInitials,
}