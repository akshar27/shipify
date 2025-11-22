import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";
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

    if (form.password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/register", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: "user",
      });

      alert("Account created! Please check your email to verify your account.");
      navigate("/login");

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

      navigate("/dashboard");

    } catch (error) {
      console.log(error);
      setErrorMsg("Google Signup failed.");
    }
  };

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
