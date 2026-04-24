import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../config/api';

const PENDING_REPORTS_KEY = 'pending_reports_v1';

const ensureBackendConfigured = () => {
  if (!API_BASE_URL) {
    const error = new Error('Missing backend URL. Set EXPO_PUBLIC_BACKEND_URL.');
    error.code = 'BACKEND_URL_MISSING';
    throw error;
  }
};

const normalizeImageType = (imageType) => {
  if (!imageType || typeof imageType !== 'string') {
    return 'image/jpeg';
  }
  return imageType;
};

const buildFormData = (payload) => {
  const formData = new FormData();

  formData.append('lat', String(payload.lat));
  formData.append('lng', String(payload.lng));
  formData.append('category_key', String(payload.category_key));
  formData.append('severity', String(payload.severity));

  if (payload.population_affected !== undefined && payload.population_affected !== null) {
    formData.append('population_affected', String(payload.population_affected));
  }

  if (payload.description) {
    formData.append('description', String(payload.description));
  }

  if (payload.photo?.uri) {
    formData.append('photo', {
      uri: payload.photo.uri,
      type: normalizeImageType(payload.photo.type),
      name: payload.photo.name || 'photo.jpg',
    });
  }

  return formData;
};

const sendReport = async (payload, token) => {
  ensureBackendConfigured();

  const response = await fetch(`${API_BASE_URL}/reports/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
    body: buildFormData(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Submit failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return response.json();
};

const readPendingReports = async () => {
  const raw = await AsyncStorage.getItem(PENDING_REPORTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writePendingReports = async (reports) => {
  await AsyncStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(reports));
};

const queueReport = async (payload) => {
  const pending = await readPendingReports();

  pending.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    payload,
  });

  await writePendingReports(pending);
};

export const submitOrQueueReport = async ({ payload, token }) => {
  try {
    const data = await sendReport(payload, token);
    return { mode: 'online', data };
  } catch (error) {
    await queueReport(payload);
    return { mode: 'offline_queued' };
  }
};

export const syncPendingReports = async ({ token }) => {
  const pending = await readPendingReports();

  if (pending.length === 0) {
    return { syncedCount: 0, remaining: 0 };
  }

  const failed = [];
  let syncedCount = 0;

  for (const item of pending) {
    try {
      await sendReport(item.payload, token);
      syncedCount += 1;
    } catch (error) {
      failed.push(item);
    }
  }

  await writePendingReports(failed);

  return {
    syncedCount,
    remaining: failed.length,
  };
};

export const reportOfflineQueue = {
  queueReport,
  readPendingReports,
};
