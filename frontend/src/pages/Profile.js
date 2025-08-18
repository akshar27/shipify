import { useEffect, useState } from "react";
import API from "../services/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [newName, setNewName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await API.get("/users/profile");
        setProfile(res.data);
        setNewName(res.data.name);
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleNameUpdate = async () => {
    try {
      await API.patch("/users/update-profile", { name: newName });
      setProfile({ ...profile, name: newName });
      setIsEditing(false);
      setMessage("Name updated successfully");
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append("document", file);

    try {
      const res = await API.post("/users/upload-doc", formData);
      setMessage(res.data.msg);
    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  if (!profile) return <p className="text-center mt-5">Loading...</p>;

  return (
    <div className="container mt-5">
      <h2>Profile</h2>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="card mb-3 p-3">
        <div>
          <strong>Email:</strong> {profile.email}
        </div>

        <div className="mt-2">
          <strong>Name:</strong>{" "}
          {isEditing ? (
            <>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="form-control d-inline w-50 me-2"
              />
              <button className="btn btn-success btn-sm" onClick={handleNameUpdate}>
                Save
              </button>
              <button
                className="btn btn-secondary btn-sm ms-2"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {profile.name}
              <button
                className="btn btn-link btn-sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
            </>
          )}
        </div>

        <div className="mt-2">
          <strong>Verified:</strong> {profile.isVerified ? "✅" : "❌"}
        </div>

        {profile.documentUrl && (
          <div className="mt-2">
            <strong>Document:</strong> <a href={profile.documentUrl} target="_blank" rel="noreferrer">View</a>
          </div>
        )}

        {!profile.isVerified && (
          <form className="mt-3" onSubmit={handleFileUpload}>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              accept=".pdf,.jpg,.png"
              className="form-control mb-2"
            />
            <button className="btn btn-outline-primary btn-sm" type="submit">
              Upload Document for Verification
            </button>
          </form>
        )}

        {profile.avgRating && (
          <div className="mt-3">
            <strong>Avg Rating:</strong> {profile.avgRating} ⭐
          </div>
        )}
      </div>
    </div>
  );
}
