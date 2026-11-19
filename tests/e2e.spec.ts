import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

type TestAccount = { email: string; password: string; name: string };

const configuredEmail = process.env.E2E_USER_EMAIL;
const configuredPassword = process.env.E2E_USER_PASSWORD;
const hasPartialCredentials = Boolean(configuredEmail) !== Boolean(configuredPassword);
let account: TestAccount | null =
  configuredEmail && configuredPassword
    ? { email: configuredEmail, password: configuredPassword, name: "E2E user" }
    : null;

const projectName = `E2E Project ${randomUUID().slice(0, 8)}`;
const firstTaskTitle = `E2E Upcoming ${randomUUID().slice(0, 8)}`;
const secondTaskTitle = `E2E Today ${randomUUID().slice(0, 8)}`;

function createTestAccount(name = "Playwright User"): TestAccount {
  return {
    name,
    email: `e2e-${randomUUID()}@example.test`,
    password: `e2e-${randomUUID()}-A1!`,
  };
}

function getAccount(): TestAccount {
  if (!account) {
    throw new Error("The E2E account has not been initialized.");
  }
  return account;
}

async function expectWorkspace(page: Page) {
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your team" })).toBeVisible();
}

async function signIn(page: Page) {
  const currentAccount = getAccount();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(currentAccount.email);
  await page.locator("#login-password").fill(currentAccount.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectWorkspace(page);
}

async function registerAccount(page: Page, newAccount: TestAccount) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(newAccount.name);
  await page.getByLabel("Email address").fill(newAccount.email);
  await page.getByLabel("Password").fill(newAccount.password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expectWorkspace(page);
}

async function createTask(
  page: Page,
  title: string,
  options: { priority: "High" | "Low"; dueDate?: string },
) {
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a task" });
  await dialog.getByLabel("What needs to get done?").fill(title);
  await dialog.getByLabel("Project").selectOption({ label: projectName });
  await dialog.getByLabel("Priority").selectOption({ label: options.priority });
  if (options.dueDate) {
    await dialog.getByLabel("Due date").fill(options.dueDate);
    await dialog.getByLabel("Time").fill("10:30");
  }
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

test("end-to-end workspace journey", async ({ page, browser }, testInfo) => {
  if (hasPartialCredentials) {
    throw new Error("Set both E2E_USER_EMAIL and E2E_USER_PASSWORD, or leave both unset.");
  }

  await test.step("register or sign in and load the workspace", async () => {
    if (account) {
      await signIn(page);
      return;
    }

    account = createTestAccount();
    await page.goto("/register");
    await page.getByLabel("Your name").fill(account.name);
    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await registerAccount(page, account);
  });

  await test.step("open profile and settings", async () => {
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    const profileDialog = page.getByRole("dialog", { name: "Profile" });
    await expect(profileDialog.getByText(getAccount().email, { exact: true })).toBeVisible();
    await profileDialog.getByRole("button", { name: "Done" }).click();

    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const settingsDialog = page.getByRole("dialog", { name: "Settings" });
    await settingsDialog.getByLabel(/Compact task list/).check();
    await expect(page.locator(".app-shell")).toHaveClass(/app-shell-compact/);
    await settingsDialog.getByRole("button", { name: "Done" }).click();
  });

  await test.step("validate a project and create scheduled tasks", async () => {
    await page.getByRole("button", { name: "Create project" }).click();
    const projectDialog = page.getByRole("dialog", { name: "Create a project" });
    await projectDialog.getByRole("button", { name: "Create project" }).click();
    await expect(projectDialog.getByRole("alert")).toHaveText("Enter a project name.");
    await projectDialog.getByLabel("Project name").fill(projectName);
    await projectDialog.getByRole("button", { name: "Create project" }).click();
    await expect(projectDialog).toBeHidden();
    await expect(page.getByRole("button", { name: projectName, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Create project" }).click();
    const duplicateProjectDialog = page.getByRole("dialog", { name: "Create a project" });
    await duplicateProjectDialog.getByLabel("Project name").fill(projectName);
    await duplicateProjectDialog.getByRole("button", { name: "Create project" }).click();
    await expect(duplicateProjectDialog.getByRole("alert"))
      .toHaveText("A project with that name already exists.");
    await duplicateProjectDialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "New task" }).click();
    const taskDialog = page.getByRole("dialog", { name: "Create a task" });
    await taskDialog.getByRole("button", { name: "Create task" }).click();
    await expect(taskDialog.getByText("Give your task a name before adding it.")).toBeVisible();
    await taskDialog.getByRole("button", { name: "Cancel" }).click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");

    await createTask(page, firstTaskTitle, { priority: "High", dueDate: tomorrowDate });
    await expect(page.getByText("Tomorrow", { exact: true })).toBeVisible();
    await expect(page.getByText("10:30 AM", { exact: true })).toBeVisible();
    await expect(page.getByText("High", { exact: true })).toBeVisible();
    await createTask(page, secondTaskTitle, { priority: "Low" });
  });

  await test.step("search, filter, update, reload, and delete tasks", async () => {
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    await navigation.getByRole("button", { name: /^All tasks/ }).click();

    const search = page.getByRole("textbox", { name: "Search tasks" });
    await search.fill(firstTaskTitle);
    await expect(page.getByRole("heading", { name: firstTaskTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: secondTaskTitle, exact: true })).toBeHidden();
    await search.fill("no matching e2e task");
    await expect(page.getByText("No matching tasks")).toBeVisible();
    await search.fill("");

    await navigation.getByRole("button", { name: /^Upcoming/ }).click();
    await expect(page.getByRole("heading", { name: firstTaskTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: secondTaskTitle, exact: true })).toBeHidden();

    await navigation.getByRole("button", { name: /^All tasks/ }).click();
    const firstTask = page.locator(".task-row").filter({ hasText: firstTaskTitle });
    await firstTask.getByRole("button", { name: `Options for ${firstTaskTitle}` }).click();
    await firstTask.getByRole("button", { name: "Mark in progress" }).click();
    await firstTask.getByRole("button", { name: `Options for ${firstTaskTitle}` }).click();
    await expect(firstTask.getByRole("button", { name: "Mark as to do" })).toBeVisible();
    await firstTask.getByRole("button", { name: "Mark complete" }).click();
    await expect(firstTask.getByRole("button", { name: `Mark ${firstTaskTitle} incomplete` })).toBeVisible();

    const filters = page.getByRole("tablist", { name: "Filter tasks" });
    await filters.getByRole("tab", { name: "Completed" }).click();
    await expect(page.getByRole("heading", { name: firstTaskTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: secondTaskTitle, exact: true })).toBeHidden();
    await filters.getByRole("tab", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: secondTaskTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: firstTaskTitle, exact: true })).toBeHidden();

    await navigation.getByRole("button", { name: /^All tasks/ }).click();
    await page.reload();
    await expectWorkspace(page);
    await navigation.getByRole("button", { name: /^All tasks/ }).click();
    await expect(page.getByRole("button", { name: `Mark ${firstTaskTitle} incomplete` })).toBeVisible();

    const secondTask = page.locator(".task-row").filter({ hasText: secondTaskTitle });
    await secondTask.getByRole("button", { name: `Options for ${secondTaskTitle}` }).click();
    await secondTask.getByRole("button", { name: "Delete task" }).click();
    await expect(page.getByRole("heading", { name: secondTaskTitle, exact: true })).toBeHidden();

    const persistedTask = page.locator(".task-row").filter({ hasText: firstTaskTitle });
    await persistedTask.getByRole("button", { name: `Options for ${firstTaskTitle}` }).click();
    await persistedTask.getByRole("button", { name: "Delete task" }).click();
    await expect(page.getByRole("heading", { name: firstTaskTitle, exact: true })).toBeHidden();
  });

  await test.step("validate invitation errors and invite an active teammate", async () => {
    await page.getByRole("button", { name: "Invite a teammate" }).click();
    const inviteDialog = page.getByRole("dialog", { name: "Add a teammate" });
    await inviteDialog.getByLabel("Email address").fill(`missing-${randomUUID()}@example.test`);
    await inviteDialog.getByRole("button", { name: "Add teammate" }).click();
    await expect(inviteDialog.getByRole("alert"))
      .toHaveText("No active Taskm account was found with that email.");

    await inviteDialog.getByLabel("Email address").fill(getAccount().email);
    await inviteDialog.getByRole("button", { name: "Add teammate" }).click();
    await expect(inviteDialog.getByRole("alert"))
      .toHaveText("That person is already a member of this workspace.");

    if (testInfo.project.name !== "chromium") {
      await inviteDialog.getByRole("button", { name: "Cancel" }).click();
      return;
    }

    const teammate: TestAccount = createTestAccount("Playwright Teammate");
    const teammateContext = await browser.newContext();
    try {
      await registerAccount(await teammateContext.newPage(), teammate);
    } finally {
      await teammateContext.close();
    }

    await inviteDialog.getByLabel("Email address").fill(teammate.email);
    await inviteDialog.getByRole("button", { name: "Add teammate" }).click();
    await expect(inviteDialog).toBeHidden();
    await expect(page.locator(".team-member").filter({ hasText: teammate.name })).toBeVisible();
  });

  await test.step("navigate on mobile and verify logout protection", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: /^All tasks/ })
      .click();
    await expect(page.getByRole("heading", { name: "All tasks", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test("shows authentication errors and password visibility controls", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(`missing-${randomUUID()}@example.test`);
  const password = page.locator("#login-password");
  await password.fill("definitely-wrong");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("alert")).toHaveText("Password recovery isn't available yet.");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("alert")).toHaveText("Google sign-in isn't configured yet.");
});
