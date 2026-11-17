import axios from "axios";

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
