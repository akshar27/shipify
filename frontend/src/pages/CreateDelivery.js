import { useState, useRef } from "react";
import API from "../services/api";
import { Navigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  GoogleMap,
  LoadScript,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const mapStyle = { height: "300px", width: "100%" };
const defaultCenter = { lat: 37.7749, lng: -122.4194 };

export default function CreateDelivery() {
  const [form, setForm] = useState({
    itemType: "",
    size: "",
    weight: "",
  });

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLatLng, setPickupLatLng] = useState(null);
  const [dropoffLatLng, setDropoffLatLng] = useState(null);

  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user"));
  if (!user?.isVerified) {
    return <Navigate to="/upload-doc" />;
  }

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        pickup: pickupAddress,
        dropoff: dropoffAddress,
        pickupLat: pickupLatLng?.lat,
        pickupLng: pickupLatLng?.lng,
        dropoffLat: dropoffLatLng?.lat,
        dropoffLng: dropoffLatLng?.lng,
      };

      const res = await API.post("/deliveries", payload);
      const deliveryId = res.data.deliveryId;

      const stripe = await stripePromise;
      const session = await API.post("/payments/create-checkout-session", {
        deliveryId,
        amount: 10.0,
      });

      window.location.href = session.data.url;
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to create delivery or payment");
    }
  };

  const handlePlaceChanged = (type) => {
    const autocomplete = type === "pickup" ? pickupRef.current : dropoffRef.current;
    const place = autocomplete.getPlace();
    if (place.geometry) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      if (type === "pickup") {
        setPickupAddress(place.formatted_address);
        setPickupLatLng({ lat, lng });
      } else {
        setDropoffAddress(place.formatted_address);
        setDropoffLatLng({ lat, lng });
      }
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Create Delivery Request</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label><strong>Pickup Address:</strong></label>
          <LoadScript
            googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
            libraries={["places"]}
          >
            <Autocomplete onLoad={(a) => (pickupRef.current = a)} onPlaceChanged={() => handlePlaceChanged("pickup")}>
              <input
                className="form-control"
                placeholder="Enter pickup location"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
              />
            </Autocomplete>

            <GoogleMap
              mapContainerStyle={mapStyle}
              center={pickupLatLng || defaultCenter}
              zoom={pickupLatLng ? 13 : 11}
              onClick={(e) => {
                setPickupLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            >
              {pickupLatLng && <Marker position={pickupLatLng} />}
            </GoogleMap>
          </LoadScript>
        </div>

        <div className="mb-3">
          <label><strong>Dropoff Address:</strong></label>
          <LoadScript
            googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
            libraries={["places"]}
          >
            <Autocomplete onLoad={(a) => (dropoffRef.current = a)} onPlaceChanged={() => handlePlaceChanged("dropoff")}>
              <input
                className="form-control"
                placeholder="Enter dropoff location"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
              />
            </Autocomplete>

            <GoogleMap
              mapContainerStyle={mapStyle}
              center={dropoffLatLng || defaultCenter}
              zoom={dropoffLatLng ? 13 : 11}
              onClick={(e) => {
                setDropoffLatLng({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            >
              {dropoffLatLng && <Marker position={dropoffLatLng} />}
            </GoogleMap>
          </LoadScript>
        </div>

        <div className="mb-3">
          <input className="form-control" name="itemType" placeholder="Item Type (e.g. Laptop)" onChange={handleFormChange} required />
        </div>
        <div className="mb-3">
          <input className="form-control" name="size" placeholder="Size (e.g. Small/Medium/Large)" onChange={handleFormChange} required />
        </div>
        <div className="mb-3">
          <input className="form-control" name="weight" type="number" step="0.1" placeholder="Weight (kg)" onChange={handleFormChange} required />
        </div>

        <button type="submit" className="btn btn-primary w-100">Create & Pay</button>
      </form>
    </div>
  );
}
