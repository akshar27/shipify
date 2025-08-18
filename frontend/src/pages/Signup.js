import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sender" });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/auth/register", form);
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.msg || "Registration failed");
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <h2 className="text-center mb-4">Sign Up</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <input className="form-control" name="name" placeholder="Name" onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <input className="form-control" name="email" type="email" placeholder="Email" onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <input className="form-control" name="password" type="password" placeholder="Password" onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <select name="role" className="form-select" onChange={handleChange}>
                <option value="sender">Sender</option>
                <option value="traveler">Traveler</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary w-100">Register</button>
          </form>
        </div>
      </div>
    </div>
  );
}
