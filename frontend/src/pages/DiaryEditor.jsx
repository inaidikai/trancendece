import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function DiaryEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [text, setText] = useState("");

  return (
    <div style={{ padding: 20 }}>
      <h1>Diary #{id}</h1>
      <textarea
        style={{ width: "100%", height: 300 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write here..."
      />
      <div style={{ marginTop: 10 }}>
        <button onClick={() => nav("/world")}>Back to 3D World</button>
      </div>
    </div>
  );
}
