import axios from "axios";

// Access Vite env variable
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to attach access token
axiosInstance.interceptors.request.use(
  (config) => {
    let token = null;
    
    // Determine which token to use based on the API route
    if (config.url?.startsWith("/hospital")) {
      token = localStorage.getItem("hospitalAccessToken");
    } else {
      token = localStorage.getItem("accessToken");
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
