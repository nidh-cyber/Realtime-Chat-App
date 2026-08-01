import axios from 'axios';

const getBaseUrl = () => {
    if (import.meta.env.MODE === "development") {
        return "http://localhost:5001/api";
    }

    if (import.meta.env.VITE_BACKEND_URL) {
        return `${import.meta.env.VITE_BACKEND_URL}/api`;
    }

    return "/api";
};

export const axiosInstance = axios.create({
    baseURL: getBaseUrl(),
    withCredentials: true,
    timeout: 10000,
});
