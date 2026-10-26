import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import API from "../services/api";
import RulesList from "../components/RulesList";
import FormError from "../components/FormError";

// Shown to anyone who has not accepted the current Terms: people who signed up before they existed, Google sign-ups, and
// everyone again whenever the terms version changes. The API sends people here (403 TERMS_REQUIRED) when they try to
// create or take a delivery without having accepted.
export default function AcceptTerms() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!localStorage.getItem("token")) return <Navigate to="/login" />;

  const accept = async () => {
    setSaving(true);
    setError("");
    try {
      await API.post("/auth/accept-terms", { accept: true });
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...user, termsAccepted: true }));
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Could not save your choice. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container my-5" style={{ maxWidth: 760 }}>
      <h2>Before you continue</h2>
      <p>Please read and accept our rules. They keep senders and travelers safe.</p>

      <div className="card mb-3">
        <div className="card-body">
          <h5>Never send or carry</h5>
          <RulesList compact />
          <p className="mb-0 small">
            Read the full <Link to="/terms" target="_blank">Terms</Link>, the <Link to="/prohibited-items" target="_blank">prohibited items and traveler rules</Link> and the{" "}
            <Link to="/privacy" target="_blank">Privacy Policy</Link>.
          </p>
        </div>
      </div>

      <FormError message={error} />
      <div className="form-check mb-3">
        <input className="form-check-input" type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <label className="form-check-label" htmlFor="agree">
          I have read and accept the Terms, the Privacy Policy and the prohibited-items rules.
        </label>
      </div>
      <button className="btn btn-primary" disabled={!agreed || saving} onClick={accept}>
        {saving ? "Saving..." : "Accept and continue"}
      </button>
    </div>
  );
}
