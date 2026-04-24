const rawBaseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');
