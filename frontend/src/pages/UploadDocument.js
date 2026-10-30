import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";
import useCurrentUser from "../services/useCurrentUser";

const MAX_MB = 10;

// Sending or carrying a package needs a verified identity: an admin checks the ID photo and approves it.
export default function UploadDocument() {
  const { user, loading } = useCurrentUser();
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setMsg({ type: "danger", text: "Choose a photo or scan of your government ID first." });
    if (file.size > MAX_MB * 1024 * 1024) return setMsg({ type: "danger", text: `That file is too large. The limit is ${MAX_MB} MB.` });

    const formData = new FormData();
    formData.append("document", file);
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      await API.post("/users/upload-doc", formData);
      setSubmitted(true);
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, idSubmitted: true }));
    } catch (err) {
      setMsg({ type: "danger", text: err.response?.data?.msg || "Upload failed. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container mt-5"><p>Loading...</p></div>;

  if (user?.isVerified) {
    return (
      <div className="container mt-5">
        <h2>You are verified</h2>
        <p>Your ID has been approved. You can send and carry packages now.</p>
        <Link to="/create-delivery" className="btn btn-primary me-2">Create a delivery</Link>
        <Link to="/create-trip" className="btn btn-outline-primary">Post a trip</Link>
      </div>
    );
  }

  if (submitted || user?.idSubmitted) {
    return (
      <div className="container mt-5">
        <h2>Your ID is being reviewed</h2>
        <p>An admin will check it and approve your account. You do not need to do anything else; come back to this page to see when it is done.</p>
        <p className="text-muted small">Uploaded the wrong file? You can send a new one below and the review starts again.</p>
        {renderForm()}
      </div>
    );
  }

  function renderForm() {
    return (
      <form onSubmit={handleUpload} encType="multipart/form-data">
        <input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} className="form-control my-3" aria-label="ID document" />
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Uploading..." : "Upload"}</button>
        {msg.text && <div className={`alert alert-${msg.type} mt-3`} role="alert">{msg.text}</div>}
      </form>
    );
  }

  return (
    <div className="container mt-5">
      <h2>Verify your identity</h2>
      <p>To keep everyone safe, you need a verified account before you can send or carry a package. Upload a clear photo or scan of a government ID (passport, driver's license or national ID). An admin reviews it, usually within a day.</p>
      {renderForm()}
    </div>
  );
}
