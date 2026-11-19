import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { api } from "./api";

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Create account - Taskm";
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/auth/register", { name, email, password });
      navigate("/home", { replace: true });
    } catch (error) {
      const serverMessage = isAxiosError<{ error?: string }>(error)
        ? error.response?.data.error
        : undefined;
      setMessage(serverMessage ?? "Unable to create your account. Check that the API server is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-label="About Taskm">
        <Link className="login-brand" to="/home" aria-label="Taskm home">
          <span className="brand-mark"><CalendarDays size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">taskm</span>
        </Link>
        <div className="login-story-content">
          <span className="login-eyebrow"><span className="status-dot" /> A LITTLE MORE IN RHYTHM</span>
          <h1>Make space for your best work.</h1>
          <p className="login-story-copy">Create your account and give your plans a calmer place to grow.</p>
        </div>
        <p className="login-story-footer">Thoughtful planning. Room to breathe.</p>
      </section>
      <section className="login-form-panel" aria-labelledby="register-title">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="brand-mark"><CalendarDays size={18} strokeWidth={2.2} /></span>
            <span className="brand-name">taskm</span>
          </div>
          <div className="login-heading">
            <span className="login-eyebrow">GET STARTED</span>
            <h2 id="register-title">Create your account</h2>
            <p>Your workspace is just a few details away.</p>
          </div>
          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label className="required-field" htmlFor="register-name">Your name</label>
              <input id="register-name" autoComplete="name" maxLength={120} onChange={(event) => { setName(event.target.value); setMessage(""); }} required value={name} />
            </div>
            <div className="login-field">
              <label className="required-field" htmlFor="register-email">Email address</label>
              <input id="register-email" autoComplete="email" onChange={(event) => { setEmail(event.target.value); setMessage(""); }} required type="email" value={email} />
            </div>
            <div className="login-field">
              <label className="required-field" htmlFor="register-password">Password</label>
              <input id="register-password" autoComplete="new-password" minLength={8} onChange={(event) => { setPassword(event.target.value); setMessage(""); }} required type="password" value={password} />
              <small className="register-hint">Use at least 8 characters.</small>
            </div>
            <div className="login-field">
              <label className="required-field" htmlFor="register-confirm-password">Confirm password</label>
              <input id="register-confirm-password" autoComplete="new-password" onChange={(event) => { setConfirmPassword(event.target.value); setMessage(""); }} required type="password" value={confirmPassword} />
            </div>
            {message && <p className="login-message" role="alert">{message}</p>}
            <button className="login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating account..." : "Create account"} {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>
          <p className="login-help">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
        <footer className="login-legal"><span>© {new Date().getFullYear()} Taskm</span><span>Made for good work.</span></footer>
      </section>
    </main>
  );
}

export default RegisterPage;
