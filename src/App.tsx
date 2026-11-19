import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Ellipsis,
  Inbox,
  ListTodo,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { api, type PublicUser } from "./api";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type View = "Today" | "Upcoming" | "Completed" | "All tasks";

type Task = {
  id: string;
  title: string;
  project: string;
  projectId: string | null;
  projectColor: string | null;
  dueAt: string | null;
  date: string;
  time: string;
  priority: Priority;
  completed: boolean;
  status: "TODO" | "IN_PROGRESS" | "COMPLETED";
  assignee: string;
  assigneeId: string | null;
  initials: string;
  avatar: string;
};

type Project = { id: string; name: string; color: string | null };
type WorkspaceMember = { id: string; name: string; email: string; role: string };
type WorkspaceOption = { id: string; name: string; role: string };
type ApiTask = {
  id: string;
  title: string;
  projectId: string | null;
  dueAt: string | null;
  priority: Priority;
  status: Task["status"];
  project: Project | null;
  assignee: { id: string; name: string; email: string } | null;
};
type ApiWorkspace = {
  id: string;
  name: string;
  projects: Project[];
  members: WorkspaceMember[];
};
type CreateTaskInput = {
  title: string;
  projectId: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  priority: Priority;
};

const today = new Date();
const localDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const todayKey = localDate(today);
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const tomorrowKey = localDate(tomorrow);

const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", options).format(date);

const timeInMinutes = (time: string) => {
  const [clock, period] = time.split(" ");
  const [hour, minute] = clock.split(":").map(Number);
  return ((hour % 12) + (period === "PM" ? 12 : 0)) * 60 + minute;
};

const formatTime = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
};

const toInitials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();

function mapApiTask(task: ApiTask, currentUser: PublicUser): Task {
  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
  const assignee = task.assignee;
  return {
    id: task.id,
    title: task.title,
    project: task.project?.name ?? "No project",
    projectId: task.projectId,
    projectColor: task.project?.color ?? null,
    dueAt: task.dueAt,
    date: dueDate ? localDate(dueDate) : "",
    time: dueDate
      ? formatTime(`${String(dueDate.getHours()).padStart(2, "0")}:${String(dueDate.getMinutes()).padStart(2, "0")}`)
      : "",
    priority: task.priority,
    completed: task.status === "COMPLETED",
    status: task.status,
    assignee: assignee?.id === currentUser.id ? "You" : assignee?.name ?? "Unassigned",
    assigneeId: assignee?.id ?? null,
    initials: assignee ? toInitials(assignee.name) : "?",
    avatar: assignee?.id === currentUser.id ? "avatar-lilac" : "avatar-peach",
  };
}

function App({ currentUser }: { currentUser: PublicUser }) {
  const navigateToRoute = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [activeView, setActiveView] = useState<View>("Today");
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isHeaderProfileMenuOpen, setIsHeaderProfileMenuOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [accountModal, setAccountModal] = useState<"profile" | "settings" | null>(null);
  const [isCompactTaskList, setIsCompactTaskList] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const loadWorkspaces = async () => {
      setIsLoading(true);
      setApiError("");
      try {
        const response = await api.get<{ items: WorkspaceOption[] }>("/workspace");
        if (!active) return;
        const availableWorkspaces = response.data.items;
        setWorkspaces(availableWorkspaces);
        if (availableWorkspaces.length === 0) {
          setApiError("No workspace is available for this account.");
          return;
        }
        const savedWorkspaceId = window.localStorage.getItem(`taskm-workspace-${currentUser.id}`);
        const initialWorkspace = availableWorkspaces.find(
          (workspace) => workspace.id === savedWorkspaceId,
        ) ?? availableWorkspaces[0];
        setSelectedWorkspaceId(initialWorkspace.id);
      } catch (error) {
        if (!active) return;
        const message = isAxiosError<{ error?: string }>(error)
          ? error.response?.data.error
          : undefined;
        setApiError(message ?? "Unable to load your workspaces. Please try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadWorkspaces();
    return () => { active = false; };
  }, [currentUser]);

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    let active = true;
    const loadWorkspace = async () => {
      setIsLoading(true);
      setApiError("");
      try {
        const params = { workspaceId: selectedWorkspaceId };
        const [workspaceResponse, taskResponse] = await Promise.all([
          api.get<ApiWorkspace>("/workspace/current", { params }),
          api.get<{ items: ApiTask[] }>("/tasks", {
            params: { ...params, page: 1, limit: 100 },
          }),
        ]);
        if (!active) return;
        setWorkspaceName(workspaceResponse.data.name);
        setProjects(workspaceResponse.data.projects);
        setMembers(workspaceResponse.data.members);
        setTasks(taskResponse.data.items.map((task) => mapApiTask(task, currentUser)));
      } catch (error) {
        if (!active) return;
        const message = isAxiosError<{ error?: string }>(error)
          ? error.response?.data.error
          : undefined;
        setApiError(message ?? "Unable to load your tasks. Please try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadWorkspace();
    return () => { active = false; };
  }, [currentUser, selectedWorkspaceId]);

  useEffect(() => {
    if (!isHeaderProfileMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsHeaderProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsHeaderProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isHeaderProfileMenuOpen]);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!workspaceMenuRef.current?.contains(event.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsWorkspaceMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isWorkspaceMenuOpen]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (activeView === "Today") return task.date === todayKey;
        if (activeView === "Upcoming") return !task.completed && task.date > todayKey;
        if (activeView === "Completed") return task.completed;
        return true;
      })
      .filter((task) => {
        if (activeFilter === "Open") return !task.completed;
        if (activeFilter === "Completed") return task.completed;
        return true;
      })
      .filter((task) => {
        if (!normalizedQuery) return true;
        return `${task.title} ${task.project} ${task.assignee}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((first, second) =>
        (first.date || "9999-99-99").localeCompare(second.date || "9999-99-99") ||
        (first.time && second.time ? timeInMinutes(first.time) - timeInMinutes(second.time) : 0),
      );
  }, [activeFilter, activeView, query, tasks]);

  const openCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.filter((task) => task.completed).length;
  const todayCount = tasks.filter((task) => task.date === todayKey).length;
  const upcomingCount = tasks.filter(
    (task) => !task.completed && task.date > todayKey,
  ).length;
  const pageTitle =
    activeView === "All tasks" ? "All tasks" : activeView;

  const setTaskStatus = async (task: Task, status: Task["status"]) => {
    try {
      const response = await api.patch<{ task: ApiTask }>(
        `/tasks/${task.id}`,
        { status },
        { params: { workspaceId: selectedWorkspaceId } },
      );
      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === task.id ? mapApiTask(response.data.task, currentUser) : item,
        ),
      );
      setApiError("");
    } catch {
      setApiError("Could not update this task. Please try again.");
    }
  };

  const toggleTask = (task: Task) =>
    setTaskStatus(task, task.completed ? "TODO" : "COMPLETED");

  const deleteTask = async (id: string) => {
    try {
      await api.delete(`/tasks/${id}`, { params: { workspaceId: selectedWorkspaceId } });
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
      setApiError("");
    } catch {
      setApiError("Could not delete this task. Please try again.");
    }
  };

  const addTask = async (task: CreateTaskInput) => {
    const response = await api.post<{ task: ApiTask }>("/tasks", task, {
      params: { workspaceId: selectedWorkspaceId },
    });
    setTasks((currentTasks) => [mapApiTask(response.data.task, currentUser), ...currentTasks]);
    setActiveView("All tasks");
    setActiveFilter("All");
    setApiError("");
  };

  const addProject = async (project: { name: string; color: string }) => {
    const response = await api.post<{ project: Project }>("/workspace/projects", project, {
      params: { workspaceId: selectedWorkspaceId },
    });
    setProjects((currentProjects) =>
      [...currentProjects, response.data.project].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    );
    setApiError("");
  };

  const inviteMember = async (email: string) => {
    const response = await api.post<{ member: WorkspaceMember }>("/workspace/members", {
      email,
    }, { params: { workspaceId: selectedWorkspaceId } });
    setMembers((currentMembers) => [...currentMembers, response.data.member]);
    setApiError("");
  };

  const logout = async () => {
    setIsLoggingOut(true);
    setApiError("");
    try {
      await api.post("/auth/logout");
      navigateToRoute("/login", { replace: true });
    } catch {
      setApiError("Could not sign out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navigate = (view: View) => {
    setActiveView(view);
    setActiveFilter("All");
    setIsSidebarOpen(false);
  };

  const selectWorkspace = (workspace: WorkspaceOption) => {
    setSelectedWorkspaceId(workspace.id);
    setWorkspaceName(workspace.name);
    window.localStorage.setItem(`taskm-workspace-${currentUser.id}`, workspace.id);
    setIsWorkspaceMenuOpen(false);
    setIsSidebarOpen(false);
    setIsModalOpen(false);
    setIsProjectModalOpen(false);
    setIsInviteModalOpen(false);
    setQuery("");
    setTasks([]);
    setProjects([]);
    setMembers([]);
  };

  return (
    <div className={`app-shell ${isCompactTaskList ? "app-shell-compact" : ""}`}>
      {isSidebarOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><CalendarDays size={18} strokeWidth={2.2} /></div>
          <span className="brand-name">taskm</span>
          <button
            aria-label="Close navigation"
            className="icon-button mobile-close"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-menu-wrap" ref={workspaceMenuRef}>
          <button
            aria-expanded={isWorkspaceMenuOpen}
            aria-haspopup="menu"
            className="workspace-switcher"
            disabled={workspaces.length < 2}
            onClick={() => setIsWorkspaceMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <span className="workspace-avatar">{workspaceName.charAt(0).toUpperCase() || "W"}</span>
            <span className="workspace-copy">
              <span className="workspace-label">Workspace</span>
              <span className="workspace-name">{workspaceName || "Your workspace"}</span>
            </span>
            {workspaces.length > 1 && <ChevronDown size={16} className="workspace-chevron" />}
          </button>
          {isWorkspaceMenuOpen && workspaces.length > 1 && (
            <div aria-label="Select workspace" className="workspace-menu" role="menu">
              {workspaces.map((workspace) => (
                <button
                  aria-checked={workspace.id === selectedWorkspaceId}
                  className="workspace-menu-item"
                  key={workspace.id}
                  onClick={() => selectWorkspace(workspace)}
                  role="menuitemradio"
                  type="button"
                >
                  <span className="workspace-menu-avatar">{workspace.name.charAt(0).toUpperCase()}</span>
                  <span>{workspace.name}</span>
                  {workspace.id === selectedWorkspaceId && <Check size={15} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-heading">WORKSPACE</p>
          <NavButton
            active={activeView === "Today"}
            icon={<Inbox size={18} />}
            label="Today"
            count={todayCount}
            onClick={() => navigate("Today")}
          />
          <NavButton
            active={activeView === "Upcoming"}
            icon={<CalendarDays size={18} />}
            label="Upcoming"
            count={upcomingCount}
            onClick={() => navigate("Upcoming")}
          />
          <NavButton
            active={activeView === "All tasks"}
            icon={<ListTodo size={18} />}
            label="All tasks"
            count={openCount}
            onClick={() => navigate("All tasks")}
          />
          <NavButton
            active={activeView === "Completed"}
            icon={<CheckCheck size={18} />}
            label="Completed"
            count={completedCount}
            onClick={() => navigate("Completed")}
          />

          <div className="nav-section-heading">
            <p className="nav-heading">YOUR PROJECTS</p>
            <button
              className="tiny-icon-button"
              aria-label="Create project"
              onClick={() => setIsProjectModalOpen(true)}
            >
              <Plus size={15} />
            </button>
          </div>
          {projects.map((project, index) => (
            <button className="project-link" key={project.id} onClick={() => { setQuery(project.name); navigate("All tasks"); }}>
              <span
                className={`project-dot ${project.color ? "" : ["dot-violet", "dot-orange", "dot-green"][index % 3]}`}
                style={project.color ? { backgroundColor: project.color } : undefined}
              /> {project.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            aria-label="Open navigation"
            className="icon-button mobile-menu"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumbs">
            <span>{workspaceName || "Workspace"}</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="Search tasks"
                placeholder="Search anything..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <div className="account-menu-wrapper" ref={accountMenuRef}>
              <button
                aria-expanded={isHeaderProfileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                className="account-menu-trigger"
                onClick={() => setIsHeaderProfileMenuOpen((isOpen) => !isOpen)}
                type="button"
              >
                <span className="avatar avatar-lilac topbar-avatar">{toInitials(currentUser.name)}</span>
              </button>
              {isHeaderProfileMenuOpen && (
                <div aria-label="Account menu" className="account-menu" role="menu">
                  <button
                    className="account-menu-item"
                    onClick={() => {
                      setIsHeaderProfileMenuOpen(false);
                      setAccountModal("profile");
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <UserRound size={16} /><span>Profile</span>
                  </button>
                  <button
                    className="account-menu-item"
                    onClick={() => {
                      setIsHeaderProfileMenuOpen(false);
                      setAccountModal("settings");
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Settings2 size={16} /><span>Settings</span>
                  </button>
                  <div className="account-menu-divider" />
                  <button
                    className="account-menu-item account-menu-signout"
                    disabled={isLoggingOut}
                    onClick={() => {
                      setIsHeaderProfileMenuOpen(false);
                      void logout();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <LogOut size={16} /><span>{isLoggingOut ? "Signing out..." : "Log out"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-wrap">
          <section className="page-intro">
            <div>
              <div className="eyebrow"><span className="status-dot" /> YOUR DAY, AT A GLANCE</div>
              <h1>{pageTitle}</h1>
              <p className="page-subtitle">
                {activeView === "Today"
                  ? `A little progress adds up. Here's what's on your plate for ${formatDate(today, { weekday: "long", month: "long", day: "numeric" })}.`
                  : activeView === "Upcoming"
                    ? "The things coming up next. Plenty of time to make them happen."
                    : activeView === "Completed"
                      ? "Look at everything you've already moved forward."
                      : "Everything your team is working on, all in one place."}
              </p>
            </div>
            <button className="primary-button" onClick={() => setIsModalOpen(true)}>
              <Plus size={17} strokeWidth={2.4} /> New task
            </button>
          </section>

          <section className="overview-grid" aria-label="Task overview">
            <OverviewCard
              label="Tasks for today"
              value={String(todayCount).padStart(2, "0")}
              detail="Keep your day moving"
              icon={<CalendarDays size={18} />}
              tone="overview-gray"
            />
            <OverviewCard
              label="Still in progress"
              value={String(openCount).padStart(2, "0")}
              detail="One step at a time"
              icon={<Clock3 size={18} />}
              tone="overview-white"
            />
            <OverviewCard
              label="Already done"
              value={String(completedCount).padStart(2, "0")}
              detail="Nice work — keep it up"
              icon={<Check size={18} />}
              tone="overview-white"
            />
          </section>

          <section className="work-area">
            <div className="task-section">
              <div className="section-heading">
                <div>
                  <h2>{activeView === "Today" ? "Your schedule" : `${pageTitle} list`}</h2>
                  <p>{visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"} to keep things moving</p>
                </div>
              </div>

              <div className="filter-pills" role="tablist" aria-label="Filter tasks">
                {["All", "Open", "Completed"].map((filter) => (
                  <button
                    className={`filter-pill ${activeFilter === filter ? "filter-pill-active" : ""}`}
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    role="tab"
                    aria-selected={activeFilter === filter}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="task-list">
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => void toggleTask(task)}
                    onSetStatus={(status) => void setTaskStatus(task, status)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
                {visibleTasks.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon"><CheckCheck size={22} /></div>
                    <strong>{isLoading ? "Loading your tasks..." : query ? "No matching tasks" : "All clear for now"}</strong>
                    <p>{isLoading ? "Getting your workspace ready." : query ? "Try a different search or clear the filter." : "Take a breath, or add a new task whenever you're ready."}</p>
                    {!isLoading && !query && <button className="text-button" onClick={() => setIsModalOpen(true)}><Plus size={15} /> Add a task</button>}
                  </div>
                )}
              </div>
              {activeView === "Today" && (
                <button className="add-task-row" onClick={() => setIsModalOpen(true)}>
                  <span className="add-task-plus"><Plus size={16} /></span> Add a task to today
                </button>
              )}
            </div>

            <aside className="right-rail">
              <div className="mini-calendar-card">
                <div className="rail-heading">
                  <div><h3>This week</h3><span>{formatDate(today, { month: "long", year: "numeric" })}</span></div>
                  <div className="calendar-controls">
                    <button aria-label="Previous week" className="tiny-icon-button"><ChevronLeft size={16} /></button>
                    <button aria-label="Next week" className="tiny-icon-button"><ChevronRight size={16} /></button>
                  </div>
                </div>
                <MiniWeek />
              </div>

              <div className="focus-card">
                <div className="focus-topline"><span className="focus-icon"><Sparkles size={16} /></span><span>YOUR FOCUS</span></div>
                <h3>Small steps,<br />big momentum.</h3>
                <p>You've completed {completedCount} {completedCount === 1 ? "task" : "tasks"} so far. Keep going at your own pace.</p>
                <div className="progress-track"><span style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }} /></div>
                <div className="progress-meta"><span>Weekly progress</span><strong>{tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}%</strong></div>
              </div>

              <div className="team-card">
                <div className="team-card-heading"><div><h3>Your team</h3><span>Working together</span></div><button className="tiny-icon-button" aria-label="Team options"><Ellipsis size={17} /></button></div>
                {members.map((member, index) => (
                  <div className="team-member" key={member.id}>
                    <span className={`avatar ${index % 2 ? "avatar-peach" : "avatar-lilac"}`}>{toInitials(member.name)}</span>
                    <span className="team-member-name">{member.name} <small>{member.id === currentUser.id ? "You" : member.role.toLowerCase()}</small></span>
                    <span className="presence presence-online" />
                  </div>
                ))}
                <button className="invite-button" onClick={() => setIsInviteModalOpen(true)}>
                  <Users size={15} /> Invite a teammate
                </button>
              </div>
            </aside>
          </section>
          <footer className="page-footer"><span>Made for good work.</span><span>Taskm <span className="footer-dot">·</span> Your work, in rhythm</span></footer>
        </div>
      </main>

      {apiError && <div className="storage-message" role="alert">{apiError}</div>}
      {isModalOpen && (
        <NewTaskModal
          members={members}
          onClose={() => setIsModalOpen(false)}
          onAdd={addTask}
          projects={projects}
        />
      )}
      {isProjectModalOpen && (
        <NewProjectModal
          onClose={() => setIsProjectModalOpen(false)}
          onCreate={addProject}
        />
      )}
      {isInviteModalOpen && (
        <InviteTeammateModal
          onClose={() => setIsInviteModalOpen(false)}
          onInvite={inviteMember}
        />
      )}
      {accountModal && (
        <AccountModal
          compactTaskList={isCompactTaskList}
          currentUser={currentUser}
          mode={accountModal}
          onClose={() => setAccountModal(null)}
          onCompactTaskListChange={setIsCompactTaskList}
        />
      )}
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button className={`nav-item ${active ? "nav-item-active" : ""}`} onClick={onClick}>
      {icon}<span>{label}</span>{count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );
}

function OverviewCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <article className={`overview-card ${tone}`}>
      <div className="overview-top"><span>{label}</span><span className="overview-icon">{icon}</span></div>
      <div className="overview-value">{value}</div>
      <div className="overview-detail">{detail}</div>
    </article>
  );
}

function TaskRow({
  task,
  onToggle,
  onSetStatus,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onSetStatus: (status: Task["status"]) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOverdue =
    !task.completed && task.dueAt !== null && new Date(task.dueAt).getTime() < Date.now();
  const changeStatus = (status: Task["status"]) => {
    onSetStatus(status);
    setMenuOpen(false);
  };
  return (
    <article className={`task-row ${task.completed ? "task-row-complete" : ""}`}>
      <button
        className={`task-check ${task.completed ? "task-check-done" : ""}`}
        aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
        onClick={onToggle}
      >
        {task.completed ? <Check size={13} strokeWidth={2.7} /> : <Circle size={19} strokeWidth={1.6} />}
      </button>
      <div className="task-main">
        <div className="task-title-line">
          <h3>{task.title}</h3>
          {isOverdue && <span className="task-status-badge task-status-overdue">Overdue</span>}
          {task.status === "IN_PROGRESS" && <span className="task-status-badge task-status-in-progress">In progress</span>}
          <span className={`priority priority-${task.priority.toLowerCase()}`}><span />{task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}</span>
        </div>
        <div className="task-meta">
          <span className="task-project"><span className="project-dot" style={task.projectColor ? { backgroundColor: task.projectColor } : undefined} />{task.project}</span>
          <span className="meta-divider" />
          {task.time && <span className="task-time"><Clock3 size={13} />{task.time}</span>}
          {task.date && task.date !== todayKey && <><span className="meta-divider" /><span>{task.date === tomorrowKey ? "Tomorrow" : formatDate(new Date(`${task.date}T12:00:00`), { month: "short", day: "numeric" })}</span></>}
        </div>
      </div>
      <div className="task-assignee"><span className={`avatar ${task.avatar}`}>{task.initials}</span><span>{task.assignee}</span></div>
      <div className="task-actions">
        <button className="tiny-icon-button task-more" aria-label={`Options for ${task.title}`} onClick={() => setMenuOpen(!menuOpen)}><Ellipsis size={18} /></button>
        {menuOpen && (
          <div className="task-menu">
            {task.status !== "TODO" && <button onClick={() => changeStatus("TODO")}>Mark as to do</button>}
            {task.status !== "IN_PROGRESS" && <button onClick={() => changeStatus("IN_PROGRESS")}>Mark in progress</button>}
            {task.status !== "COMPLETED" && <button onClick={() => changeStatus("COMPLETED")}>Mark complete</button>}
            <button onClick={onDelete}><Trash2 size={14} /> Delete task</button>
          </div>
        )}
      </div>
    </article>
  );
}

function MiniWeek() {
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return (
    <div className="mini-week">
      {Array.from({ length: 7 }, (_, index) => {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + index);
        const isToday = localDate(day) === todayKey;
        return (
          <div className={`mini-day ${isToday ? "mini-day-today" : ""}`} key={day.toISOString()}>
            <span>{formatDate(day, { weekday: "short" }).slice(0, 1)}</span>
            <strong>{day.getDate()}</strong>
            <i className={index === 1 || index === 3 ? "mini-day-dot" : ""} />
          </div>
        );
      })}
    </div>
  );
}

function InviteTeammateModal({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await onInvite(email.trim().toLowerCase());
      onClose();
    } catch (submitError) {
      const message = isAxiosError<{ error?: string }>(submitError)
        ? submitError.response?.data.error
        : undefined;
      setError(message ?? "Could not add this teammate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="invite-modal-title" aria-modal="true" className="task-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <span className="modal-eyebrow">GROW YOUR TEAM</span>
            <h2 id="invite-modal-title">Add a teammate</h2>
          </div>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-field">
            <span>Email address</span>
            <input
              autoComplete="email"
              autoFocus
              maxLength={320}
              onChange={(event) => { setEmail(event.target.value); setError(""); }}
              placeholder="teammate@company.com"
              required
              type="email"
              value={email}
            />
          </label>
          <p>They must already have an active Taskm account to be added.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="secondary-button" onClick={onClose} type="button" disabled={isSubmitting}>Cancel</button>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add teammate"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function NewTaskModal({
  onClose,
  onAdd,
  projects,
  members,
}: {
  onClose: () => void;
  onAdd: (task: CreateTaskInput) => Promise<void>;
  projects: Project[];
  members: WorkspaceMember[];
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState("09:00");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Give your task a name before adding it.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await onAdd({
        title: cleanTitle,
        projectId: projectId || null,
        assigneeId: assigneeId || null,
        dueAt: date ? new Date(`${date}T${time || "00:00"}:00`).toISOString() : null,
        priority,
      });
      onClose();
    } catch (submitError) {
      const message = isAxiosError<{ error?: string }>(submitError)
        ? submitError.response?.data.error
        : undefined;
      setError(message ?? "Could not create this task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="modal-title" aria-modal="true" className="task-modal" role="dialog">
        <div className="modal-heading">
          <div><span className="modal-eyebrow">MAKE A LITTLE PROGRESS</span><h2 id="modal-title">Create a task</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-field">
            <span>What needs to get done?</span>
            <input autoFocus maxLength={120} onChange={(event) => { setTitle(event.target.value); setError(""); }} placeholder="e.g. Share the latest prototype" value={title} />
            {error && <small className="form-error">{error}</small>}
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>Project</span>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">No project</option>
                {projects.map((projectOption) => <option key={projectOption.id} value={projectOption.id}>{projectOption.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="form-field">
              <span>Assignee</span>
              <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                <option value="">Unassigned</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Due date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
          {date && <label className="form-field">
            <span>Time</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button><button className="primary-button" type="submit" disabled={isSubmitting}><Plus size={16} /> {isSubmitting ? "Creating..." : "Create task"}</button></div>
        </form>
      </section>
    </div>
  );
}

function AccountModal({
  mode,
  currentUser,
  compactTaskList,
  onCompactTaskListChange,
  onClose,
}: {
  mode: "profile" | "settings";
  currentUser: PublicUser;
  compactTaskList: boolean;
  onCompactTaskListChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isProfile = mode === "profile";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="account-modal-title" aria-modal="true" className="task-modal account-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <span className="modal-eyebrow">{isProfile ? "YOUR ACCOUNT" : "MAKE TASKM YOURS"}</span>
            <h2 id="account-modal-title">{isProfile ? "Profile" : "Settings"}</h2>
          </div>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        {isProfile ? (
          <div className="account-profile-details">
            <span className="avatar avatar-lilac account-profile-avatar">{toInitials(currentUser.name)}</span>
            <div className="account-profile-field"><span>Name</span><strong>{currentUser.name}</strong></div>
            <div className="account-profile-field"><span>Email</span><strong>{currentUser.email}</strong></div>
          </div>
        ) : (
          <label className="settings-toggle">
            <span><strong>Compact task list</strong><small>Show more tasks with less spacing.</small></span>
            <input
              checked={compactTaskList}
              onChange={(event) => onCompactTaskListChange(event.target.checked)}
              type="checkbox"
            />
          </label>
        )}
        <div className="modal-actions">
          <button className="primary-button" onClick={onClose} type="button">Done</button>
        </div>
      </section>
    </div>
  );
}

function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (project: { name: string; color: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8b5cf6");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Enter a project name.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onCreate({ name: cleanName, color });
      onClose();
    } catch (submitError) {
      const message = isAxiosError<{ error?: string }>(submitError)
        ? submitError.response?.data.error
        : undefined;
      setError(message ?? "Could not create this project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="project-modal-title" aria-modal="true" className="task-modal" role="dialog">
        <div className="modal-heading">
          <div><span className="modal-eyebrow">MAKE ROOM FOR GOOD WORK</span><h2 id="project-modal-title">Create a project</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="form-field">
            <span>Project name</span>
            <input
              autoFocus
              maxLength={100}
              onChange={(event) => { setName(event.target.value); setError(""); }}
              placeholder="e.g. Website refresh"
              value={name}
            />
            {error && <small className="form-error" role="alert">{error}</small>}
          </label>
          <label className="form-field">
            <span>Project color</span>
            <input aria-label="Project color" onChange={(event) => setColor(event.target.value)} type="color" value={color} />
          </label>
          <div className="modal-actions">
            <button className="secondary-button" disabled={isSubmitting} onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={isSubmitting} type="submit">
              <Plus size={16} /> {isSubmitting ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
