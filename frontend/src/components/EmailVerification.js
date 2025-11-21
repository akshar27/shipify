import { useEffect, useState } from "react";
import API from "../services/api";
import { useParams, useNavigate } from "react-router-dom";

export default function EmailVerification() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        await API.get(`/auth/verify-email/${token}`);
        setStatus("success");

        setTimeout(() => {
          navigate("/login");
        }, 2000);

      } catch (err) {
        setStatus("error");
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="container mt-5 text-center">
      {status === "verifying" && <p>Verifying your email...</p>}
      {status === "success" && (
        <div className="alert alert-success">
          ✅ Email verified! Redirecting to login...
        </div>
      )}
      {status === "error" && (
        <div className="alert alert-danger">
          ❌ Invalid or expired verification link.
        </div>
      )}
    </div>
  );
}
