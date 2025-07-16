const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://jules-bsnr.onrender.com';

// Helper function to get auth token
const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

// Helper function to make authenticated requests
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Make sure the backend is running on http://localhost:4000');
    }
    throw error;
  }
};

// Authentication API calls
export const auth = {
  login: async (email: string, password: string) => {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      localStorage.setItem('token', response.token);
    }
    
    return response;
  },

  register: async (email: string, password: string, name?: string) => {
    // First register the user
    await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    // Then log them in to get a token
    const loginResponse = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (loginResponse.token) {
      localStorage.setItem('token', loginResponse.token);
    }
    
    return loginResponse;
  },

  logout: () => {
    localStorage.removeItem('token');
  },

  getProfile: async () => {
    return apiRequest('/api/auth/profile');
  },
};

// Chat API calls
export const chat = {
  sendMessage: async (message: string, userId: string) => {
    return apiRequest('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, userId }),
    });
  },
  getChatHistory: async (userId: string) => {
    return apiRequest(`/api/chat/${userId}`, {
      method: 'GET',
    });
  },
  getImages: async (query: string, page?: number) => {
    return apiRequest('/api/chat/images', {
      method: 'POST',
      body: JSON.stringify(page ? { query, page } : { query }),
    });
  },
  getProducts: async (query: string) => {
    return apiRequest('/api/chat/products', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },
};

// Product recommendations API calls
export const products = {
  getRecommendations: async () => {
    return apiRequest('/api/products/recommendations');
  },
};

// Upload API calls
export const upload = {
  uploadImage: async (formData: FormData) => {
    const token = getAuthToken();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Make sure the backend is running on http://localhost:4000');
      }
      throw error;
    }
  },
}; 