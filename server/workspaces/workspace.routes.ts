import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  addWorkspaceMemberController,
  createProjectController,
  currentWorkspaceController,
} from "./workspace.controller.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);
workspaceRouter.get("/current", currentWorkspaceController);
workspaceRouter.post("/members", addWorkspaceMemberController);
workspaceRouter.post("/projects", createProjectController);
