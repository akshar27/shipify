import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../services/api";

export default function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get(`/users/public/${id}`);
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to load public profile", err);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <h3 className="text-center mt-5">Loading profile...</h3>;
  if (!profile) return <h3 className="text-center mt-5">Profile not found</h3>;

  return (
    <div className="container mt-5">
      <div className="card p-4">

        <div className="text-center">
          <img
            src={profile.profilePicture || "https://via.placeholder.com/150"}
            alt="Profile"
            className="rounded-circle mb-3"
            style={{ width: 140, height: 140, objectFit: "cover" }}
          />
        </div>

        <h3 className="text-center">{profile.name}</h3>

        {profile.bio && <p className="text-center text-muted">{profile.bio}</p>}

        <p className="text-center">
          {profile.isVerified ? "✅ Verified User" : "❌ Not Verified"}
        </p>

        {/* ⭐ Rating */}
        {profile.avgRating && (
          <div className="text-center mt-2">
            <h4>⭐ {profile.avgRating} / 5</h4>
            <p className="text-muted">{profile.totalRatings} reviews</p>
          </div>
        )}

        <hr />

        {/* Reviews */}
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

        <hr />

        <p><strong>Completed Deliveries:</strong> {profile.completedDeliveries}</p>
        <p><strong>Completed Trips:</strong> {profile.completedTrips}</p>
        <p><strong>Member Since:</strong> {new Date(profile.memberSince).toLocaleDateString()}</p>

      </div>
    </div>
  );
}
