/**
 * Pagination Utility
 * 
 * Provides efficient pagination for large datasets.
 * Enables loading packages in batches instead of all at once.
 */

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;      // Items per page (default: 50)
  offset?: number;     // Starting position (default: 0)
  page?: number;       // Page number (1-indexed, alternative to offset)
}

/**
 * Pagination result
 */
export interface PaginationResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Pagination state for UI
 */
export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  isLoading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Convert page number to offset
 */
export const pageToOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};

/**
 * Convert offset to page number
 */
export const offsetToPage = (offset: number, limit: number): number => {
  return Math.floor(offset / limit) + 1;
};

/**
 * Paginate an array
 */
export const paginateArray = <T>(
  items: T[],
  options: PaginationOptions = {}
): PaginationResult<T> => {
  const limit = options.limit ?? 50;
  const page = options.page ?? offsetToPage(options.offset ?? 0, limit);
  const offset = pageToOffset(page, limit);

  const total = items.length;
  const paginatedItems = items.slice(offset, offset + limit);
  const totalPages = Math.ceil(total / limit);

  return {
    items: paginatedItems,
    total,
    limit,
    offset,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

/**
 * Get next page options
 */
export const getNextPageOptions = (
  current: PaginationResult<any>
): PaginationOptions | null => {
  if (!current.hasNextPage) return null;
  return {
    page: current.page + 1,
    limit: current.limit,
  };
};

/**
 * Get previous page options
 */
export const getPreviousPageOptions = (
  current: PaginationResult<any>
): PaginationOptions | null => {
  if (!current.hasPreviousPage) return null;
  return {
    page: current.page - 1,
    limit: current.limit,
  };
};

/**
 * Get page options by number
 */
export const getPageOptions = (
  page: number,
  limit: number = 50
): PaginationOptions => {
  return { page, limit };
};

/**
 * Calculate total pages
 */
export const calculateTotalPages = (total: number, limit: number): number => {
  return Math.ceil(total / limit);
};

/**
 * Check if page is valid
 */
export const isValidPage = (
  page: number,
  totalPages: number
): boolean => {
  return page >= 1 && page <= totalPages;
};

/**
 * Get page range for display (e.g., "1-50 of 250")
 */
export const getPageRange = (result: PaginationResult<any>): string => {
  const start = result.offset + 1;
  const end = Math.min(result.offset + result.limit, result.total);
  return `${start}-${end} of ${result.total}`;
};

/**
 * Get page info for display
 */
export const getPageInfo = (result: PaginationResult<any>): string => {
  return `Page ${result.page} of ${result.totalPages}`;
};

/**
 * Validate pagination options
 */
export const validatePaginationOptions = (
  options: PaginationOptions
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (options.limit !== undefined) {
    if (options.limit < 1) {
      errors.push('Limit must be at least 1');
    }
    if (options.limit > 1000) {
      errors.push('Limit cannot exceed 1000');
    }
  }

  if (options.offset !== undefined) {
    if (options.offset < 0) {
      errors.push('Offset cannot be negative');
    }
  }

  if (options.page !== undefined) {
    if (options.page < 1) {
      errors.push('Page must be at least 1');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Merge pagination options (later options override earlier ones)
 */
export const mergePaginationOptions = (
  ...optionsList: (PaginationOptions | undefined)[]
): PaginationOptions => {
  const merged: PaginationOptions = {
    limit: 50,
    offset: 0,
  };

  for (const options of optionsList) {
    if (!options) continue;
    if (options.limit !== undefined) merged.limit = options.limit;
    if (options.offset !== undefined) merged.offset = options.offset;
    if (options.page !== undefined) {
      merged.page = options.page;
      merged.offset = pageToOffset(options.page, merged.limit);
    }
  }

  return merged;
};

/**
 * Create pagination state from result
 */
export const createPaginationState = (
  result: PaginationResult<any>
): PaginationState => {
  return {
    currentPage: result.page,
    pageSize: result.limit,
    totalItems: result.total,
    totalPages: result.totalPages,
    isLoading: false,
    hasNextPage: result.hasNextPage,
    hasPreviousPage: result.hasPreviousPage,
  };
};

/**
 * Format pagination info for logging
 */
export const formatPaginationInfo = (result: PaginationResult<any>): string => {
  return `[${getPageRange(result)}] ${getPageInfo(result)}`;
};

/**
 * Get items per page recommendations
 */
export const PAGINATION_PRESETS = {
  SMALL: 10,      // For mobile lists
  MEDIUM: 25,     // Default
  LARGE: 50,      // For desktop
  EXTRA_LARGE: 100, // For exports
} as const;

/**
 * Recommended page sizes by context
 */
export const getRecommendedPageSize = (context: 'mobile' | 'tablet' | 'desktop'): number => {
  switch (context) {
    case 'mobile':
      return PAGINATION_PRESETS.SMALL;
    case 'tablet':
      return PAGINATION_PRESETS.MEDIUM;
    case 'desktop':
      return PAGINATION_PRESETS.LARGE;
    default:
      return PAGINATION_PRESETS.MEDIUM;
  }
};
