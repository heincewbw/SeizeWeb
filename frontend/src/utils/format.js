import { format } from 'date-fns';

/**
 * Format a number as currency (USD)
 * @param {number} value
 * @returns {string}
 */
export const formatCurrency = (value, currency = 'USD') => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  // USC (US Cents): backend stores raw cents from MT4, divide by 100 for display
  const isUSC = currency === 'USC';
  const displayValue = isUSC ? value / 100 : value;
  const displayCurrency = isUSC ? 'USD' : (currency || 'USD');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: displayCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(displayValue);
};

/**
 * Format a percentage value
 * @param {number} value
 * @returns {string}
 */
export const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${parseFloat(value).toFixed(2)}%`;
};

/**
 * Format a date string to a readable format
 * @param {string|Date} date
 * @returns {string}
 */
export const formatDate = (date) => {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd MMM yyyy HH:mm');
  } catch {
    return '—';
  }
};

/**
 * Format a number with commas
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
