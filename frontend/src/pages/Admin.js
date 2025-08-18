import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const res = await API.get("/admin/all-users");
        setUsers(res.data);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };
    fetchAllUsers();
  }, []);

  const getStatus = (user) => {
    if (user.isVerified) return "✅ Verified";
    if (user.documentUrl) return "🟡 Pending Verification";
    return "❌ Not Submitted";
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">All Users</h2>
      <table className="table table-bordered">
        <thead className="table-light">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Document</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                {u.documentUrl ? (
                  <a href={u.documentUrl} target="_blank" rel="noreferrer">View</a>
                ) : (
                  "Not Submitted"
                )}
              </td>
              <td>{getStatus(u)}</td>
              <td>
                {u.documentUrl && !u.isVerified && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/admin/verify/${u.id}`)}
                  >
                    Review
                  </button>
                )}
                {u.isVerified && (
                  <span className="text-success">Done</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
