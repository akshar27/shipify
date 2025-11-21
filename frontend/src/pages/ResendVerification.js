import { useState } from "react";
import API from "../services/api";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    try {
      const res = await API.post("/auth/resend-verification", { email });
      setMsg(res.data.msg);
    } catch (err) {
      setError(err.response?.data?.msg || "Something went wrong.");
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="text-center">Resend Verification Email</h2>

      <form onSubmit={handleSubmit} className="mt-4 col-md-6 mx-auto">
        <input
          type="email"
          className="form-control mb-3"
          placeholder="Enter your registered email"
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button className="btn btn-primary w-100" type="submit">
          Resend Email
        </button>

        {msg && <div className="alert alert-success mt-3">{msg}</div>}
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </form>
    </div>
  );
}
