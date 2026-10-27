import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../services/api";

export default function AdminVerify() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState(null); // { type, text }: inline feedback instead of a blocking alert()
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await API.get(`/admin/user/${id}`);
        setUser(res.data);
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    };

    fetchUser();
  }, [id]);

  const handleApprove = async () => {
    setBusy(true);
    try {
      await API.patch(`/admin/verify-user/${id}`);
      setNotice({ type: "success", text: "User approved. Taking you back to the list..." });
      setTimeout(() => navigate("/admin"), 1200);
    } catch (err) {
      setNotice({ type: "danger", text: err.response?.data?.msg || "Failed to verify user" });
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await API.post(`/admin/reject-user/${id}`);
      setNotice({ type: "success", text: "ID rejected. The person can upload a new one. Taking you back to the list..." });
      setTimeout(() => navigate("/admin"), 1200);
    } catch (err) {
      setNotice({ type: "danger", text: err.response?.data?.msg || "Failed to reject user" });
      setBusy(false);
    }
  };

  if (!user) return <p className="mt-5 text-center">Loading...</p>;

  const fullDocUrl = user.documentUrl; // S3 URL now

  return (
    <div className="container mt-5">
      <h3 className="mb-4">Verify User Document</h3>

      <button className="btn btn-secondary mb-3" onClick={() => navigate("/admin")}>
        ← Back to All Users
      </button>

      <div className="card shadow p-4">
        <h5><strong>Name:</strong> {user.name}</h5>
        <p><strong>Email:</strong> {user.email}</p>

        {user.documentUrl ? (
          <div className="mt-4">
            <h6><strong>Document Preview:</strong></h6>

            {/* PDF */}
            {(user.documentType === "pdf" || user.documentUrl.toLowerCase().endsWith(".pdf")) ? (
              <iframe
                src={fullDocUrl}
                title="Document Preview"
                width="100%"
                height="500"
                style={{ border: "1px solid #ccc" }}
              />
            ) : (
              // Image preview
              <img
                src={fullDocUrl}
                alt="Uploaded Document"
                className="img-fluid mt-2"
                style={{ maxHeight: "500px", border: "1px solid #ccc" }}
              />
            )}

            <div className="mt-2">
              <a href={fullDocUrl} target="_blank" rel="noopener noreferrer">
                Open in New Tab
              </a>
            </div>
          </div>
        ) : (
          <p className="text-danger mt-4">❌ No document uploaded by this user.</p>
        )}

        {notice && <div className={`alert alert-${notice.type} mt-4`} role="alert">{notice.text}</div>}

        <div className="mt-4">
          <button className="btn btn-success me-3" onClick={handleApprove} disabled={busy}>
            Approve
          </button>
          {!confirmingReject ? (
            <button className="btn btn-danger" onClick={() => setConfirmingReject(true)} disabled={busy}>
              Reject
            </button>
          ) : (
            <span>
              <span className="me-2">Reject this ID? The account stays and the person can upload another.</span>
              <button className="btn btn-danger me-2" onClick={handleReject} disabled={busy}>Yes, reject</button>
              <button className="btn btn-outline-secondary" onClick={() => setConfirmingReject(false)} disabled={busy}>Cancel</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
