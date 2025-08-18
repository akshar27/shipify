import { useState } from "react";
import API from "../services/api";
import { Navigate, useNavigate } from "react-router-dom";

export default function CreateTrip() {
  const [form, setForm] = useState({
    start: "",
    end: "",
    departure: "",
  });
  const navigate = useNavigate();

  // ✅ Load user from localStorage
  const user = JSON.parse(localStorage.getItem("user"));

  // ✅ Redirect unverified users
  if (!user?.isVerified) {
    return <Navigate to="/upload-doc" />;
  }

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await API.post("/trips", form);
      alert("Trip created successfully!");
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to create trip");
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Add Your Trip</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Start Location</label>
          <input
            type="text"
            name="start"
            className="form-control"
            placeholder="e.g., San Francisco, CA"
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">End Location</label>
          <input
            type="text"
            name="end"
            className="form-control"
            placeholder="e.g., San Jose, CA"
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Departure Date & Time</label>
          <input
            type="datetime-local"
            name="departure"
            className="form-control"
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary w-100">
          Create Trip
        </button>
      </form>
    </div>
  );
}
