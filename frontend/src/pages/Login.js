import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaGoogle } from "react-icons/fa";
import FormError from "../components/FormError";
import { GoogleLogin } from "@react-oauth/google";
import jwt_decode from "jwt-decode";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      setLoading(true);
      const res = await API.post("/auth/login", form);

      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      if (user.role === "admin") navigate("/admin");
      else navigate("/dashboard");

    } catch (err) {
      setErrorMsg(err.response?.data?.msg || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      const idToken = credentialResponse.credential;

      const res = await API.post("/auth/google-login", { idToken });
      const { token, user } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/dashboard");
    } catch (err) {
      console.log(err);
      setErrorMsg("Google login failed.");
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">

          <h2 className="text-center mb-4">Login</h2>

          <FormError message={errorMsg} />

          {/* Resend verification link */}
          {errorMsg === "Please verify your email first." && (
            <div className="text-center mt-2 mb-2">
              <button
                className="btn btn-link"
                onClick={() => navigate("/resend-verification")}
              >
                Resend verification email
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
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

            {/* Password */}
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
                  color: "#6c757d",
                }}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            {/* Forgot Password */}
            <div className="mb-3 text-end">
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => navigate("/forgot-password")}
                style={{ fontSize: "0.9rem" }}
              >
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="btn btn-success w-100"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : (
                "Login"
              )}
            </button>

            {/* Google Login */}
            <div className="mt-3 text-center">
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => setErrorMsg("Google login failed.")}
              />
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
