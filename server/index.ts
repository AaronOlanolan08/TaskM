import { app } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db/prisma.js";

await prisma.$connect();

const server = app.listen(config.PORT, "127.0.0.1", () => {
  console.log(`Taskm API listening on http://127.0.0.1:${config.PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(async (error) => {
      await prisma.$disconnect();
      if (error) {
        console.error("Error while shutting down the API:", error);
        process.exitCode = 1;
      }
    });
  });
}
