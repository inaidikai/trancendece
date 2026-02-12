import React from "react";
import { useNavigate } from "react-router-dom";
import "./PrivacyPolicy.css";

export default function Terms() {
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
        <h1>Terms and Conditions</h1>
        <p className="privacy-updated">Last Updated: February 2026</p>
        <p>Welcome to Quillow. By using our app, you agree to these terms.</p>

        <h2>1. Use of the App</h2>
        <ul>
          <li>You must be at least 10 years old.</li>
          <li>Keep your account credentials secure.</li>
        </ul>

        <h2>2. User Content</h2>
        <ul>
          <li>You are responsible for the content you create or share.</li>
          <li>
            You grant us permission to display content as needed for app
            functionality.
          </li>
          <li>We do not claim ownership of your content.</li>
        </ul>

        <h2>3. Collaboration &amp; Access</h2>
        <ul>
          <li>Only invited collaborators can access shared content.</li>
          <li>We are not liable if credentials are shared or compromised.</li>
        </ul>

        <h2>4. Security</h2>
        <ul>
          <li>We implement JWT authentication, access controls, and encrypted communication.</li>
          <li>Do not attempt to bypass security features.</li>
        </ul>

        <h2>5. Prohibited Activities</h2>
        <ul>
          <li>No hacking, scraping, or malware distribution.</li>
          <li>No account sharing or reverse-engineering of the app.</li>
        </ul>

        <h2>6. Limitation of Liability</h2>
        <ul>
          <li>The app is provided “as is.”</li>
          <li>
            We are not responsible for data loss, downtime, or damages caused by your use.
          </li>
        </ul>

        <h2>7. Changes</h2>
        <p>Terms may be updated at any time; continued use means acceptance.</p>

        <h2>8. Contact</h2>
        <p>Questions? Email us at contact.quilloww@gmail.com</p>
      </div>
    </div>
  );
}
