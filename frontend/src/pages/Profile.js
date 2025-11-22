import { useEffect, useState } from "react";
import API from "../services/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");

  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const res = await API.get("/users/profile");
    setProfile(res.data);

    setName(res.data.name);
    setBio(res.data.bio || "");
    setPhone(res.data.phone || "");
  };

  /* ================================
     📸 Handle Profile Photo Upload
  ================================ */
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    uploadPhoto(file);
  };

  const uploadPhoto = async (file) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("photo", file);

      const res = await API.post("/users/upload-photo", formData);

      setMessage("Profile photo updated!");
      setProfile({ ...profile, profilePicture: res.data.photoUrl });

      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      console.error("Photo upload failed", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* ================================
     📌 Save Name + Bio + Phone
  ================================ */
  const saveChanges = async () => {
    try {
      await API.patch("/users/update-profile", {
        name,
        bio,
        phone,
      });

      setMessage("Profile updated!");
      setEditMode(false);
      loadProfile();

      setTimeout(() => setMessage(""), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  if (!profile) return <p className="text-center mt-5">Loading...</p>;

  return (
    <div className="container mt-5">

      <h2>Your Profile</h2>

      {message && <div className="alert alert-success">{message}</div>}

      <div className="card p-4 mb-4">
        
        {/* Profile Photo */}
        <div className="text-center">
          <img
            src={photoPreview || profile.profilePicture || "https://via.placeholder.com/150"}
            alt="Profile"
            className="rounded-circle mb-3"
            style={{ width: 140, height: 140, objectFit: "cover" }}
          />

          <label className="btn btn-outline-primary btn-sm mt-2">
            Change Photo
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handlePhotoSelect}
            />
          </label>

          {uploading && <p className="text-muted mt-2">Uploading...</p>}
        </div>

        {/* Editable Fields */}
        <div className="mt-4">
          <label className="fw-bold">Name</label>
          <input
            className="form-control mb-3"
            value={name}
            disabled={!editMode}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="fw-bold">Phone</label>
          <input
            className="form-control mb-3"
            value={phone}
            disabled={!editMode}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number"
          />

          <label className="fw-bold">Bio</label>
          <textarea
            className="form-control mb-3"
            value={bio}
            disabled={!editMode}
            rows="3"
            onChange={(e) => setBio(e.target.value)}
            placeholder="Write something about yourself..."
          ></textarea>

          {!editMode ? (
            <button className="btn btn-primary" onClick={() => setEditMode(true)}>
              Edit Profile
            </button>
          ) : (
            <>
              <button className="btn btn-success me-2" onClick={saveChanges}>
                Save Changes
              </button>
              <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                Cancel
              </button>
            </>
          )}
        </div>

        {/* 🔗 PUBLIC PROFILE LINK + COPY BUTTON */}
        <div className="mt-4">
          <strong>Public Profile Link:</strong>

          <div className="input-group mt-1">
            <input
              className="form-control"
              value={`${window.location.origin}/public-profile/${profile.id}`}
              readOnly
              id="publicProfileLink"
            />

            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/public-profile/${profile.id}`
                );
                setMessage("Copied to clipboard!");
                setTimeout(() => setMessage(""), 1500);
              }}
            >
              📋 Copy
            </button>
          </div>
        </div>


        {/* Verified Badge */}
        <p className="mt-3">
          <strong>Verified:</strong> {profile.isVerified ? "✅ Verified" : "❌ Not Verified"}
        </p>

        <p><strong>Email Verified:</strong> {profile.emailVerified ? "✅ Verified" : "❌ Not Verified"}</p>

        {/* Average Rating */}
        {profile.avgRating && (
          <>
            <h4 className="mt-3">⭐ {profile.avgRating} / 5</h4>
            <p className="text-muted">{profile.totalRatings} reviews</p>
          </>
        )}
      </div>

      {/* REVIEWS SECTION */}
      <div className="card p-4">
        <h4>Reviews</h4>

        {profile.reviews.length === 0 ? (
          <p>No reviews yet.</p>
        ) : (
          profile.reviews.map((r) => (
            <div key={r.id} className="border-bottom py-2">
              <strong>{r.rater.name} — ⭐ {r.rating}</strong>
              <p>{r.comment}</p>
              <small>{new Date(r.createdAt).toLocaleDateString()}</small>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
