import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Eye, EyeOff, ListChecks } from "lucide-react";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { api } from "./api";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Sign in - Taskm";
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      await api.post("/auth/login", { email, password });
      navigate("/home", { replace: true });
    } catch (error) {
      const serverMessage = isAxiosError<{ error?: string }>(error)
        ? error.response?.data.error
        : undefined;
      setMessage(serverMessage ?? "Unable to reach the sign-in service. Check that the API server is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="About Taskm">
        <a className="login-brand" href="/home" aria-label="Taskm home">
          <span className="brand-mark"><CalendarDays size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">taskm</span>
        </a>

        <div className="login-story-content">
          <span className="login-eyebrow"><span className="status-dot" /> A LITTLE MORE IN RHYTHM</span>
          <h1>Make space for your best work.</h1>
          <p className="login-story-copy">
            A calmer place to bring your plans together, make progress, and
            keep good work moving.
          </p>

          <div className="login-preview">
            <div className="preview-heading">
              <span className="preview-icon"><ListChecks size={17} /></span>
              <span><strong>A clear head start</strong><small>Today, at a glance</small></span>
              <span className="preview-count">2 of 4</span>
            </div>
            <div className="preview-task">
              <span className="preview-check preview-check-done"><span /></span>
              <span className="preview-task-copy"><strong>Share the latest prototype</strong><small>Product launch <i className="preview-dot preview-dot-violet" /></small></span>
              <span className="preview-avatar preview-avatar-peach">MC</span>
            </div>
            <div className="preview-task">
              <span className="preview-check"><span /></span>
              <span className="preview-task-copy"><strong>Review this week's priorities</strong><small>Team operations <i className="preview-dot preview-dot-green" /></small></span>
              <span className="preview-avatar preview-avatar-lilac">AM</span>
            </div>
          </div>
        </div>

        <p className="login-story-footer">Thoughtful planning. Room to breathe.</p>
      </section>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="brand-mark"><CalendarDays size={18} strokeWidth={2.2} /></span>
            <span className="brand-name">taskm</span>
          </div>
          <div className="login-heading">
            <span className="login-eyebrow">WELCOME BACK</span>
            <h2 id="login-title">Sign in to Taskm</h2>
            <p>Pick up right where you left off.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                autoComplete="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setMessage("");
                }}
                placeholder="you@company.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="login-field">
              <span className="login-password-label">
                <label htmlFor="login-password">Password</label>
                <button
                  className="login-inline-link"
                  onClick={() => setMessage("Password recovery isn't available yet.")}
                  type="button"
                >
                  Forgot password?
                </button>
              </span>
              <span className="login-password-wrap">
                <input
                  id="login-password"
                  autoComplete="current-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setMessage("");
                  }}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </div>

            {message && <p className="login-message" role="alert">{message}</p>}

            <button className="login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing in..." : "Sign in"} {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="login-divider"><span>OR</span></div>
          <button
            className="google-login"
            onClick={() => setMessage("Google sign-in isn't configured yet.")}
            type="button"
          >
            <GoogleMark /> Continue with Google
          </button>

          <p className="login-help">
            Need an account? <Link to="/register">Create one</Link>
          </p>
        </div>
        <footer className="login-legal">
          <span>© {new Date().getFullYear()} Taskm</span>
          <span>Made for good work.</span>
        </footer>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.798 2.716v2.258h2.91c1.704-1.57 2.684-3.88 2.684-6.614Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.91-2.258c-.806.54-1.836.86-3.046.86-2.344 0-4.33-1.582-5.04-3.71H.951v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.593.102-1.17.28-1.71V4.958H.951A9 9 0 0 0 0 9c0 1.452.347 2.827.951 4.043L3.96 10.71Z" />
      <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.443 1.346l2.582-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .951 4.958L3.96 7.29C4.67 5.162 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

export default LoginPage;
