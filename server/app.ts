import cookieParser from "cookie-parser";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { authRouter } from "./auth/auth.routes.js";
import { taskRouter } from "./tasks/task.routes.js";
import { workspaceRouter } from "./workspaces/workspace.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/workspace", workspaceRouter);

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "API route not found." });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error("Unhandled API error:", error);
  response.status(500).json({ error: "An unexpected server error occurred." });
};

app.use(errorHandler);
