import React from "react";
import { useLocation } from "react-router-dom";
import HomeScreen from "../components/HomeScreen";
import FlipBook from "../components/FlipBook";
import "../flipbook.css";

export default function FlipbookHome() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isCollabMode = params.get("mode") === "collab";
  const title = isCollabMode ? "Our Space to Create" : "Your Space to Create";

  return (
    <HomeScreen title={title}>
      <FlipBook collaborationEnabled={isCollabMode} />
    </HomeScreen>
  );
}
