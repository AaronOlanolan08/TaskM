import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  addWorkspaceMemberController,
  createProjectController,
  currentWorkspaceController,
  deleteProjectController,
  listWorkspacesController,
  updateProjectController,
} from "./workspace.controller.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);
workspaceRouter.get("/", listWorkspacesController);
workspaceRouter.get("/current", currentWorkspaceController);
workspaceRouter.post("/members", addWorkspaceMemberController);
workspaceRouter.post("/projects", createProjectController);
workspaceRouter.patch("/projects/:id", updateProjectController);
workspaceRouter.delete("/projects/:id", deleteProjectController);
