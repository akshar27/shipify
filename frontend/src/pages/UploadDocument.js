// src/pages/UploadDocument.js
import { useState } from "react";
import API from "../services/api";
import { useNavigate } from "react-router-dom";

export default function UploadDocument() {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("document", file);

    try {
      const res = await API.post("/users/upload-doc", formData);
      setMsg(res.data.msg);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setMsg("Upload failed");
    }
  };

  return (
    <div className="container mt-5">
      <h2>Upload Government ID</h2>
      <form onSubmit={handleUpload} encType="multipart/form-data">
        <input type="file" onChange={(e) => setFile(e.target.files[0])} className="form-control my-3" />
        <button className="btn btn-primary" type="submit">Upload</button>
      </form>
      {msg && <p className="mt-3">{msg}</p>}
    </div>
  );
}
