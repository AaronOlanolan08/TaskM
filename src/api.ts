import axios, {
  isAxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshRequest: Promise<void> | null = null;

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (
    !isAxiosError(error) ||
    error.response?.status !== 401 ||
    !error.config
  ) {
    return Promise.reject(error);
  }

  const request = error.config as RetriableRequestConfig;
  const url = request.url ?? "";
  if (
    request._retry ||
    /^\/auth\/(?:login|register|refresh|logout)(?:[?#]|$)/.test(url)
  ) {
    return Promise.reject(error);
  }

  request._retry = true;
  if (!refreshRequest) {
    refreshRequest = api
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshRequest = null;
      });
  }

  try {
    await refreshRequest;
  } catch (refreshError) {
    if (isAxiosError(refreshError) && refreshError.response?.status === 401) {
      window.dispatchEvent(new Event("taskm:auth-expired"));
    }
    return Promise.reject(refreshError);
  }

  return api(request);
});
