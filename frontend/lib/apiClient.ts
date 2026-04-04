import axios from "axios";
import { getAccessToken } from "@/lib/authClient";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api").replace(/\/$/, "");

const apiClient = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
		Accept: "application/json",
	},
});

const PROTECTED_PATH_PREFIXES = ["/dashboard", "/profile", "/settings", "/fomiqsign"];

function shouldRedirectOnUnauthorized(pathname: string) {
	if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
		return false;
	}

	return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

apiClient.interceptors.request.use((config) => {
	if (config.data instanceof FormData) {
		if (config.headers.delete) {
			config.headers.delete("Content-Type");
		} else {
			delete config.headers["Content-Type"];
			delete config.headers["content-type"];
		}
	}
	// Attach Bearer token from frontend-owned cookie
	if (typeof window !== "undefined") {
		const token = getAccessToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
	}
	return config;
});

apiClient.interceptors.response.use(
	(response) => {
    const data = response.data;
    
    // Automatically store tokens in JS-accessible cookies if returned in the JSON body
    if (typeof window !== "undefined") {
      const ONE_DAY = 60 * 60 * 24;
      const SEVEN_DAYS = ONE_DAY * 7;
      
      const secure = location.protocol === "https:" ? "; Secure" : "";
      
      if (data.token || data.accessToken) {
        const token = data.token || data.accessToken;
        document.cookie = `accessToken=${token}; Path=/; Max-Age=${ONE_DAY}; SameSite=Lax${secure}`;
      }
      
      if (data.refreshToken) {
        document.cookie = `refreshToken=${data.refreshToken}; Path=/; Max-Age=${SEVEN_DAYS}; SameSite=Lax${secure}`;
      }
    }

    // Return data directly to match previous ApiClient behavior
    return data;
  },
	(error) => {
		if (
			error.response?.status === 401 &&
			typeof window !== "undefined" &&
			shouldRedirectOnUnauthorized(window.location.pathname)
		) {
      // Clear local state if possible (optional but recommended)
			window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
		}
		return Promise.reject(error);
	},
);

export default apiClient;
