import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await API.post("/auth/login", form);

      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      console.log("User Role:", user.role);

      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      alert(err.response?.data?.msg || "Login failed");
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <h2 className="text-center mb-4">Login</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <input className="form-control" name="email" type="email" placeholder="Email" onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <input className="form-control" name="password" type="password" placeholder="Password" onChange={handleChange} required />
            </div>
            <button type="submit" className="btn btn-success w-100">Login</button>
          </form>
        </div>
      </div>
    </div>
  );
}
