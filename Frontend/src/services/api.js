import axios from 'axios';

// ======================= AXIOS INSTANCE =======================
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// ======================= REQUEST INTERCEPTOR =======================
api.interceptors.request.use(
  (config) => {
    // Use accessToken consistently
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Optional: Add unique request ID
    config.headers['X-Request-ID'] = crypto.randomUUID();

    // Debug logging for development
    if (import.meta.env.DEV) {
      console.log('Making API request:', {
        url: config.url,
        method: config.method?.toUpperCase(),
        params: config.params,
        data: config.data
      });
    }

    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// ======================= RESPONSE INTERCEPTOR WITH RETRY =======================
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

api.interceptors.response.use(
  (response) => {
    // Debug logging for development
    if (import.meta.env.DEV) {
      console.log('API response:', {
        url: response.config.url,
        status: response.status,
        data: response.data
      });
    }
    return response.data || response;
  },
  async (error) => {
    const originalConfig = error.config;

    // Debug logging for development
    if (import.meta.env.DEV) {
      console.error('API error:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        data: error.response?.data
      });
    }

    if (shouldRetry(error)) {
      return retryRequest(originalConfig);
    }

    return handleApiError(error);
  }
);

function shouldRetry(error) {
  return (error.code === 'ECONNABORTED' || !error.response) &&
         (!error.config.retryCount || error.config.retryCount < MAX_RETRIES);
}

async function retryRequest(config) {
  if (!config.retryCount) config.retryCount = 0;
  config.retryCount += 1;

  console.log(`Retrying request (attempt ${config.retryCount}):`, config.url);
  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  return api(config);
}

function handleApiError(error) {
  const { response } = error;

  if (!response) {
    return Promise.reject(new Error('Network error. Please check your connection.'));
  }

  if (response.status === 401) {
    handleUnauthorized();
  } else if (response.status === 403) {
    console.error('Access forbidden:', response.data?.message);
  }

  return Promise.reject({
    status: response.status,
    message: response.data?.message || error.message,
    errors: response.data?.errors,
    code: response.data?.code,
    response: response
  });
}

function handleUnauthorized() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
}

// ======================= HELPER METHODS =======================
export const get = (url, config = {}) => api.get(url, config);
export const post = (url, data, config = {}) => api.post(url, data, config);
export const put = (url, data, config = {}) => api.put(url, data, config);
export const patch = (url, data, config = {}) => api.patch(url, data, config);
export const del = (url, config = {}) => api.delete(url, config);

// ======================= NAMED API GROUPS =======================

// Auth API
export const authAPI = {
  login: (credentials) => post('/auth/login', credentials),
  register: (userData) => post('/auth/register', userData),
  me: () => get('/auth/me'),
  logout: () => post('/auth/logout')
};

// Employee API
export const employeeAPI = {
  getAll: (params) => get('/employees', { params }),
  getById: (id) => get(`/employees/${id}`),
  create: (data) => post('/employees', data),
  update: (id, data) => put(`/employees/${id}`, data),
  delete: (id) => del(`/employees/${id}`)
};

// Department API - Updated with better error handling
export const departmentAPI = {
  getAll: async (params) => {
    try {
      // Clean and validate params
      const cleanParams = {};
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            cleanParams[key] = String(value).trim();
          }
        });
      }

      console.log('Department API - Making request with params:', cleanParams);
      const response = await get('/departments', { params: cleanParams });
      console.log('Department API - Response received:', response);
      return response;
    } catch (error) {
      console.error('Department API - Error in getAll:', error);
      throw error;
    }
  },
  getById: (id) => get(`/departments/${id}`),
  create: (data) => post('/departments', data),
  update: (id, data) => put(`/departments/${id}`, data),
  delete: (id) => del(`/departments/${id}`),
  getHierarchy: (id) => get(`/departments/${id}/hierarchy`)
};

// Attendance API
export const attendanceAPI = {
  getAll: (params) => get('/attendance', { params }),
  getById: (id) => get(`/attendance/${id}`),
  create: (data) => post('/attendance', data),
  update: (id, data) => put(`/attendance/${id}`, data),
  delete: (id) => del(`/attendance/${id}`)
};

// Leave API
export const leaveAPI = {
  getRequests: (params) => get('/leave', { params }),
  getById: (id) => get(`/leave/${id}`),
  create: (data) => post('/leave', data),
  update: (id, data) => put(`/leave/${id}`, data),
  delete: (id) => del(`/leave/${id}`),
  // Leave policies
  getPolicies: (params) => get('/leave-policies', { params }),
  createPolicy: (data) => post('/leave-policies', data),
  updatePolicy: (id, data) => put(`/leave-policies/${id}`, data),
  deletePolicy: (id) => del(`/leave-policies/${id}`),
  // Leave balances
  getBalances: (params) => get('/leave-balances', { params }),
  createBalance: (data) => post('/leave-balances', data),
  updateBalance: (id, data) => put(`/leave-balances/${id}`, data),
  deleteBalance: (id) => del(`/leave-balances/${id}`)
};

// Payroll API
export const payrollAPI = {
  getAll: (params) => get('/payroll', { params }),
  getById: (id) => get(`/payroll/${id}`),
  create: (data) => post('/payroll', data),
  update: (id, data) => put(`/payroll/${id}`, data),
  delete: (id) => del(`/payroll/${id}`)
};

// Job Posting API
export const jobPostingAPI = {
  getAll: (params) => get('/job-postings', { params }),
  getById: (id) => get(`/job-postings/${id}`),
  create: (data) => post('/job-postings', data),
  update: (id, data) => put(`/job-postings/${id}`, data),
  delete: (id) => del(`/job-postings/${id}`)
};

// Job Application API
export const jobApplicationAPI = {
  getAll: (params) => get('/job-applications', { params }),
  getById: (id) => get(`/job-applications/${id}`),
  create: (data) => post('/job-applications', data),
  update: (id, data) => put(`/job-applications/${id}`, data),
  delete: (id) => del(`/job-applications/${id}`)
};

// Interview API
export const interviewAPI = {
  getAll: (params) => get('/interviews', { params }),
  getById: (id) => get(`/interviews/${id}`),
  create: (data) => post('/interviews', data),
  update: (id, data) => put(`/interviews/${id}`, data),
  delete: (id) => del(`/interviews/${id}`)
};

// Performance Review API
export const performanceAPI = {
  getAll: (params) => get('/performance-reviews', { params }),
  getById: (id) => get(`/performance-reviews/${id}`),
  create: (data) => post('/performance-reviews', data),
  update: (id, data) => put(`/performance-reviews/${id}`, data),
  delete: (id) => del(`/performance-reviews/${id}`)
};

// Position API
export const positionAPI = {
  getAll: (params) => get('/positions', { params }),
  getById: (id) => get(`/positions/${id}`),
  create: (data) => post('/positions', data),
  update: (id, data) => put(`/positions/${id}`, data),
  delete: (id) => del(`/positions/${id}`)
};

// Training Record API
export const trainingRecordAPI = {
  getAll: (params) => get('/training-records', { params }),
  getById: (id) => get(`/training-records/${id}`),
  create: (data) => post('/training-records', data),
  update: (id, data) => put(`/training-records/${id}`, data),
  delete: (id) => del(`/training-records/${id}`)
};

// Training Program API
export const trainingProgramAPI = {
  getAll: (params) => get('/training-programs', { params }),
  getById: (id) => get(`/training-programs/${id}`),
  create: (data) => post('/training-programs', data),
  update: (id, data) => put(`/training-programs/${id}`, data),
  delete: (id) => del(`/training-programs/${id}`)
};

// Document API
export const documentAPI = {
  getAll: (params) => get('/documents', { params }),
  getById: (id) => get(`/documents/${id}`),
  upload: (formData) => post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, data) => put(`/documents/${id}`, data),
  delete: (id) => del(`/documents/${id}`),
  download: (id) => get(`/documents/${id}/download`, { responseType: 'blob' }),
  view: (id) => get(`/documents/${id}/view`, { responseType: 'blob' })
};

// Onboarding Task API
export const onboardingTaskAPI = {
  getAll: (params) => get('/onboarding-tasks', { params }),
  getById: (id) => get(`/onboarding-tasks/${id}`),
  create: (data) => post('/onboarding-tasks', data),
  update: (id, data) => put(`/onboarding-tasks/${id}`, data),
  delete: (id) => del(`/onboarding-tasks/${id}`)
};

// Onboarding Template API
export const onboardingTemplateAPI = {
  getAll: (params) => get('/onboarding-templates', { params }),
  getById: (id) => get(`/onboarding-templates/${id}`),
  create: (data) => post('/onboarding-templates', data),
  update: (id, data) => put(`/onboarding-templates/${id}`, data),
  delete: (id) => del(`/onboarding-templates/${id}`)
};

// Reports API
export const reportsAPI = {
  getEmployeeStats: (params) => get('/reports/employees/stats', { params }),
  getAttendanceReport: (params) => get('/reports/attendance', { params }),
  getLeaveReport: (params) => get('/reports/leave', { params }),
  getPayrollReport: (params) => get('/reports/payroll', { params }),
  getAuditReport: (params) => get('/reports/audit', { params })
};

// User API
export const userAPI = {
  getAll: (params) => get('/users', { params }),
  getById: (id) => get(`/users/${id}`),
  create: (data) => post('/users', data),
  update: (id, data) => put(`/users/${id}`, data),
  delete: (id) => del(`/users/${id}`),
  changePassword: (data) => patch('/users/change-password', data),
  getActivity: (id, params) => get(`/users/${id}/activity`, { params })
};

// ======================= DEFAULT EXPORT =======================
export default api;