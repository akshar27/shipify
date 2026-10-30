import { useState } from "react";
import API from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import FormError from "../components/FormError";
import { GoogleLogin } from "@react-oauth/google";

export default function Signup() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [created, setCreated] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (form.password !== form.confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    if (!acceptTerms) {
      setErrorMsg("Please accept the Terms and the prohibited-items rules to create an account.");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        acceptTerms: true,
      });

      setCreated(true); // an inline message instead of a blocking alert()

    } catch (err) {
      setErrorMsg(err.response?.data?.msg || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async (credentialResponse) => {
    try {
      const idToken = credentialResponse.credential;

      const res = await API.post("/auth/google-login", { idToken });
      const { token, user } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate(user.termsAccepted ? "/dashboard" : "/accept-terms");

    } catch (error) {
      console.log(error);
      setErrorMsg("Google Signup failed.");
    }
  };

  if (created) {
    return (
      <div className="container mt-5 text-center">
        <h2>Check your email</h2>
        <p>We sent a link to <strong>{form.email}</strong>. Open it to verify your account, then log in.</p>
        <Link to="/login" className="btn btn-primary">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">

          <h2 className="text-center mb-4">Create an Account</h2>

          <FormError message={errorMsg} />

          <form onSubmit={handleSubmit}>
            
            <div className="mb-3">
              <input
                className="form-control"
                name="name"
                placeholder="Name"
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3">
              <input
                className="form-control"
                name="email"
                type="email"
                placeholder="Email"
                onChange={handleChange}
                required
              />
            </div>

            <div className="mb-3 position-relative">
              <input
                className="form-control"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                onChange={handleChange}
                required
              />
              <span
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                }}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <div className="mb-3 position-relative">
              <input
                className="form-control"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm Password"
                onChange={handleChange}
                required
              />
              <span
                onClick={() => setShowConfirm((prev) => !prev)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                }}
              >
                {showConfirm ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="acceptTerms"
                checked={acceptTerms}
                onChange={(e) => { setAcceptTerms(e.target.checked); setErrorMsg(""); }}
              />
              <label className="form-check-label" htmlFor="acceptTerms">
                I accept the <Link to="/terms" target="_blank">Terms</Link>, the <Link to="/privacy" target="_blank">Privacy Policy</Link> and
                the <Link to="/prohibited-items" target="_blank">prohibited-items rules</Link>.
              </label>
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : (
                "Register"
              )}
            </button>

            <div className="mt-3 text-center">
              <GoogleLogin
                onSuccess={handleGoogleSignup}
                onError={() => setErrorMsg("Google signup failed.")}
              />
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
