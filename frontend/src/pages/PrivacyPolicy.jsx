import React from "react";
import { useNavigate } from "react-router-dom";
import "./PrivacyPolicy.css";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="privacy-page">
      <div className="privacy-card">
        <button className="policy-back" onClick={handleBack}>
          Back
        </button>
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Last Updated: February 2026</p>
        <p>
          Quillow values your privacy. This Privacy Policy explains what data we
          collect, how we use it, and your rights.
        </p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li>Account Information: Email, username, password.</li>
          <li>Diary Content: Notes, images, and other content you create.</li>
          <li>Usage Data: Device information, login times, activity logs.</li>
          <li>Collaborator Data: Information of people you share entries with.</li>
        </ul>

        <h2>2. How We Use Your Data</h2>
        <ul>
          <li>To provide and improve the app functionality.</li>
          <li>To authenticate users and manage access controls.</li>
          <li>To facilitate collaboration and data synchronization.</li>
          <li>To monitor and prevent security threats.</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <ul>
          <li>We do not sell your data.</li>
          <li>Collaborators you invite can access shared entries.</li>
        </ul>

        <h2>4. Security</h2>
        <ul>
          <li>We use encryption, JWT authentication, and secure storage to protect your data.</li>
          <li>Access to sensitive information is restricted to authorized personnel.</li>
        </ul>

        <h2>5. Your Rights</h2>
        <ul>
          <li>Access your data: You can view your content.</li>
          <li>Correction: You can update your account information.</li>
        </ul>

        <h2>6. Cookies and Tracking</h2>
        <ul>
          <li>Minimal tracking may be used for app performance and analytics.</li>
          <li>We do not use cookies for targeted advertising.</li>
        </ul>

        <h2>7. Children’s Privacy</h2>

        <h2>8. Changes to Privacy Policy</h2>
        <p>
          We may update this policy to improve transparency or comply with laws.
          Updates will be posted with a revised date.
        </p>
      </div>
    </div>
  );
}
