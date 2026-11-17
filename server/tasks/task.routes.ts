import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createTaskController,
  deleteTaskController,
  listTasksController,
  updateTaskController,
} from "./task.controller.js";

export const taskRouter = Router();

taskRouter.use(requireAuth);
taskRouter.get("/", listTasksController);
taskRouter.post("/", createTaskController);
taskRouter.patch("/:id", updateTaskController);
taskRouter.delete("/:id", deleteTaskController);
