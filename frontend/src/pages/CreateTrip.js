import useCurrentUser from "../services/useCurrentUser";
import { useState, useRef } from "react";
import API from "../services/api";
import { Navigate, useNavigate } from "react-router-dom";
import {
  GoogleMap,
  LoadScript,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";

const mapStyle = { height: "300px", width: "100%" };
const defaultCenter = { lat: 37.7749, lng: -122.4194 };

export default function CreateTrip() {
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [startLatLng, setStartLatLng] = useState(null);
  const [endLatLng, setEndLatLng] = useState(null);
  const [departure, setDeparture] = useState("");

  const startRef = useRef(null);
  const endRef = useRef(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const { user, loading: userLoading } = useCurrentUser();
  if (userLoading) return <div className="container mt-5"><p>Loading...</p></div>;
  if (!user?.isVerified) {
    return <Navigate to="/upload-doc" />;
  }

  const handlePlaceChanged = (type) => {
    const autocomplete = type === "start" ? startRef.current : endRef.current;
    const place = autocomplete.getPlace();
    if (place.geometry) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      if (type === "start") {
        setStartAddress(place.formatted_address);
        setStartLatLng({ lat, lng });
      } else {
        setEndAddress(place.formatted_address);
        setEndLatLng({ lat, lng });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!startLatLng || !endLatLng) return setError("Pick the start and end from the suggestions (or click each spot on the map), so senders near your route can find you.");
    try {
      const payload = {
        start: startAddress,
        end: endAddress,
        startLat: startLatLng?.lat,
        startLng: startLatLng?.lng,
        endLat: endLatLng?.lat,
        endLng: endLatLng?.lng,
        departure: new Date(departure),
      };

      await API.post("/trips", payload);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to create trip");
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Add Your Trip</h2>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <LoadScript
          googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
          libraries={["places"]}
        >
          {/* Start Location */}
          <div className="mb-3">
            <label className="form-label">Start Location</label>
            <Autocomplete onLoad={(a) => (startRef.current = a)} onPlaceChanged={() => handlePlaceChanged("start")}>
              <input
                type="text"
                className="form-control"
                placeholder="Enter start location"
                value={startAddress}
                onChange={(e) => { setStartAddress(e.target.value); setStartLatLng(null); }}
                required
              />
            </Autocomplete>
            <GoogleMap
              mapContainerStyle={mapStyle}
              center={startLatLng || defaultCenter}
              zoom={startLatLng ? 13 : 11}
              onClick={(e) => setStartLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
            >
              {startLatLng && <Marker position={startLatLng} />}
            </GoogleMap>
          </div>

          {/* End Location */}
          <div className="mb-3">
            <label className="form-label">End Location</label>
            <Autocomplete onLoad={(a) => (endRef.current = a)} onPlaceChanged={() => handlePlaceChanged("end")}>
              <input
                type="text"
                className="form-control"
                placeholder="Enter end location"
                value={endAddress}
                onChange={(e) => { setEndAddress(e.target.value); setEndLatLng(null); }}
                required
              />
            </Autocomplete>
            <GoogleMap
              mapContainerStyle={mapStyle}
              center={endLatLng || defaultCenter}
              zoom={endLatLng ? 13 : 11}
              onClick={(e) => setEndLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
            >
              {endLatLng && <Marker position={endLatLng} />}
            </GoogleMap>
          </div>
        </LoadScript>

        {/* Departure Date & Time */}
        <div className="mb-3">
          <label className="form-label">Departure Date & Time</label>
          <input
            type="datetime-local"
            className="form-control"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary w-100">
          Create Trip
        </button>
      </form>
    </div>
  );
}
