import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../services/api";

export default function AdminVerify() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
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
    try {
      await API.patch(`/admin/verify-user/${id}`);
      alert("User approved!");
      navigate("/admin");
    } catch (err) {
      alert("Failed to verify user");
    }
  };

  const handleReject = async () => {
    try {
      await API.delete(`/admin/delete-user/${id}`);
      alert("User rejected and deleted.");
      navigate("/admin");
    } catch (err) {
      alert("Failed to reject user");
    }
  };

  if (!user) return <p className="mt-5">Loading...</p>;

  const fullDocUrl = `http://localhost:5050${user.documentUrl}`; // or use env variable

  return (
    <div className="container mt-5">
      <h3>User Details</h3>
      <p><strong>Name:</strong> {user.name}</p>
      <p><strong>Email:</strong> {user.email}</p>

      {user.documentUrl && (
        <div className="mt-4">
          <strong>Document Preview:</strong><br />

          {/* Show inline preview based on file type */}
          {user.documentUrl.endsWith(".pdf") ? (
            <iframe
              src={fullDocUrl}
              title="Document Preview"
              width="100%"
              height="500px"
              style={{ border: "1px solid #ccc" }}
            />
          ) : (
            <img
              src={fullDocUrl}
              alt="Uploaded Document"
              className="img-fluid mt-2"
              style={{ maxHeight: "400px", border: "1px solid #ccc" }}
            />
          )}

          <div className="mt-2">
            <a href={fullDocUrl} target="_blank" rel="noopener noreferrer">
              Open in New Tab
            </a>
          </div>
        </div>
      )}

      <div className="mt-4">
        <button className="btn btn-success me-3" onClick={handleApprove}>Approve</button>
        <button className="btn btn-danger" onClick={handleReject}>Reject</button>
      </div>
    </div>
  );
}
