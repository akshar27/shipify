import { useEffect, useState } from "react";
import API from "../services/api";
import { useParams } from "react-router-dom";

export default function EmailVerification() {
  const { token } = useParams(); // from URL like /verify-email/:token
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const res = await API.get(`/auth/verify-email/${token}`);
        setStatus("success");
      } catch (err) {
        setStatus("error");
      }
    };
    verifyEmail();
  }, [token]);

  return (
    <div className="container mt-5 text-center">
      {status === "verifying" && <p>Verifying your email...</p>}
      {status === "success" && (
        <div className="alert alert-success">✅ Your email has been verified!</div>
      )}
      {status === "error" && (
        <div className="alert alert-danger">❌ Verification failed. Link may be invalid or expired.</div>
      )}
    </div>
  );
}
