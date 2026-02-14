import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Page from "./Page";
import ZoomEditMode from "./ZoomEditMode";
import {
  acceptCollaborationInvite,
  createEntry,
  declineCollaborationInvite,
  getCollaborators,
  getEntries,
  getEntry,
  getFriends,
  getMyCollaborationInvites,
  getMyDiaryProfile,
  inviteCollaborator,
  removeCollaborator,
  sendFriendRequest,
  searchUsers,
  updateEntry,
} from "../app/api/diaryApi";
import { makeSocket } from "../socket";

const STORAGE_KEY_PREFIX = "diary-pages-v1:";
const DEFAULT_PAGES = 3;
const DEFAULT_FONT = '"Baloo 2", sans-serif';
const DEFAULT_COLOR = "#000000";
const DEFAULT_TEXT_SIZE = 16;
const MIN_TEXT_SIZE = 10;
const MAX_TEXT_SIZE = 72;
const PAGE_BOUNDS = { width: 400, height: 500 };
const DELETE_ANIM_MS = 280;
const PAGE_RENDER_RADIUS = 8;
const DIARY_TYPE_PRIVATE = "private";
const DIARY_TYPE_COLLABORATIVE = "collaborative";
const ACTIVE_DIARY_ENTRY_STORAGE_PREFIX = "activeDiaryEntryId:";

const COLLAB_COLORS = [
  "#BCC15B",
  "#57B7BC",
  "#FC7832",
  "#F0D055",
  "#7EC77B",
  "#7BB2FF",
  "#FF9EC9",
  "#9B7BFF",
  "#59D4A8",
  "#FFB347",
];

const FALLBACK_ENTRY_TITLE = "My Diary";
const COLLAB_HOME_ROUTE = "/home?mode=collab";
const COLLAB_WS_EVENTS = {
  JOIN_ROOM: "join_entry_room",
  LEAVE_ROOM: "leave_entry_room",
  ENTRY_EDIT: "entry_edit",
  ENTRY_CURSOR_MOVE: "entry_cursor_move",
  ENTRY_CURSOR_CLEAR: "entry_cursor_clear",
  STATE_REQUEST: "state_request",
  STATE_RESPONSE: "state_response",
  ACCESS_DENIED: "access_denied",
  NOTIFICATION_CREATED: "notification:created",
};

const hashString = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getColorForUser = (username) =>
  COLLAB_COLORS[hashString(username) % COLLAB_COLORS.length];

const TOOL_KEYS = {
  SELECT: "select",
  TEXT: "text",
  MIC: "mic",
  STICKER: "sticker",
  IMAGE: "image",
};

const FONT_OPTIONS = [
  "Baloo Thambi 2",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Montserrat",
  "Nunito",
  "Raleway",
  "Work Sans",
  "Fira Sans",
  "Source Sans Pro",
  "PT Sans",
  "Ubuntu",
  "Mulish",
  "Manrope",
  "Rubik",
  "DM Sans",
  "Quicksand",
  "Karla",
  "Barlow",
  "Heebo",
  "Assistant",
  "Arimo",
  "Cabin",
  "Hind",
  "Noto Sans",
  "Titillium Web",
  "Oxygen",
  "Varela Round",
  "Merriweather",
  "Playfair Display",
  "Libre Baskerville",
  "Crimson Text",
  "Cormorant Garamond",
  "EB Garamond",
  "Spectral",
  "Alegreya",
  "Alegreya SC",
  "Lora",
  "PT Serif",
  "Bitter",
  "Cardo",
  "Zilla Slab",
  "Vollkorn",
  "Old Standard TT",
  "Domine",
  "Bebas Neue",
  "Oswald",
  "Anton",
  "Abril Fatface",
  "Lobster",
  "Cinzel",
  "Alfa Slab One",
  "Permanent Marker",
  "Luckiest Guy",
  "Chewy",
  "Fredoka",
  "Baloo 2",
  "Righteous",
  "Comfortaa",
  "Teko",
  "Acme",
  "Bangers",
  "Kanit",
  "Passion One",
  "Changa One",
  "Kirang Haerang",
  "Pacifico",
  "Dancing Script",
  "Caveat",
  "Indie Flower",
  "Patrick Hand",
  "Shadows Into Light",
  "Gloria Hallelujah",
  "Satisfy",
  "Sacramento",
  "Great Vibes",
  "Allura",
  "Handlee",
  "Kaushan Script",
  "Courgette",
  "Marck Script",
  "Bad Script",
  "Yellowtail",
  "Cookie",
  "Josefin Sans",
  "Poiret One",
  "Prata",
  "Italiana",
  "Cormorant",
  "Cinzel Decorative",
  "Playball",
  "Parisienne",
  "Petit Formal Script",
  "Special Elite",
  "Monoton",
  "Rock Salt",
  "Fredericka the Great",
  "Press Start 2P",
  "VT323",
  "Pixelify Sans",
  "Orbitron",
  "Audiowide",
  "Black Ops One",
  "Fira Code",
  "Source Code Pro",
  "JetBrains Mono",
  "Inconsolata",
  "IBM Plex Mono",
  "Space Mono",
  "Courier Prime",
  "Cousine",
  "Noto Sans Arabic",
  "Noto Naskh Arabic",
  "Cairo",
  "Amiri",
  "Tajawal",
  "Almarai",
  "Lateef",
  "Scheherazade New",
  "Comic Neue",
  "Bubblegum Sans",
  "Sniglet",
  "Cherry Cream Soda",
  "Boogaloo",
  "Gochi Hand",
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Segoe UI",
];

const SYSTEM_FONT_OPTIONS = new Set([
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Segoe UI",
]);

const loadedFontStylesheets = new Set();

const normalizeFontName = (value = "") =>
  String(value)
    .split(",")[0]
    .replace(/["']/g, "")
    .trim();

const ensureFontIsLoaded = (fontName) => {
  if (typeof document === "undefined") return;
  if (!fontName || SYSTEM_FONT_OPTIONS.has(fontName)) return;
  if (loadedFontStylesheets.has(fontName)) return;

  const linkId = `gf-${fontName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, "+")}&display=swap`;
    document.head.appendChild(link);
  }

  loadedFontStylesheets.add(fontName);
};


const STICKERS = [
  { id: "sticker-1", label: "Paper 01", category: "Paper", src: "/assets/paper/Paper%2001.png" },
  { id: "sticker-2", label: "Paper 02", category: "Paper", src: "/assets/paper/Paper%2002.png" },
  { id: "sticker-3", label: "Paper 03", category: "Paper", src: "/assets/paper/Paper%2003.png" },
  { id: "sticker-4", label: "Paper 04", category: "Paper", src: "/assets/paper/Paper%2004.png" },
  { id: "sticker-5", label: "Paper 05", category: "Paper", src: "/assets/paper/Paper%2005.png" },
  { id: "sticker-6", label: "Paper 06", category: "Paper", src: "/assets/paper/Paper%2006.png" },
  { id: "sticker-7", label: "Paper 07", category: "Paper", src: "/assets/paper/Paper%2007.png" },
  { id: "sticker-8", label: "Paper 08", category: "Paper", src: "/assets/paper/Paper%2008.png" },
  { id: "sticker-9", label: "Paper 09", category: "Paper", src: "/assets/paper/Paper%2009.png" },
  { id: "sticker-10", label: "Paper 10", category: "Paper", src: "/assets/paper/Paper%2010.png" },
  { id: "sticker-11", label: "Paper 11", category: "Paper", src: "/assets/paper/Paper%2011.png" },
  { id: "sticker-12", label: "Paper 12", category: "Paper", src: "/assets/paper/Paper%2012.png" },
  { id: "sticker-13", label: "Paper 13", category: "Paper", src: "/assets/paper/Paper%2013.png" },
  { id: "sticker-14", label: "Paper 14", category: "Paper", src: "/assets/paper/Paper%2014.png" },
  { id: "sticker-15", label: "Paper 15", category: "Paper", src: "/assets/paper/Paper%2015.png" },
  { id: "sticker-16", label: "Paper 16", category: "Paper", src: "/assets/paper/Paper%2016.png" },
  { id: "sticker-17", label: "Paper 17", category: "Paper", src: "/assets/paper/Paper%2017.png" },
  { id: "sticker-18", label: "Paper 18", category: "Paper", src: "/assets/paper/Paper%2018.png" },
  { id: "sticker-19", label: "Paper 19", category: "Paper", src: "/assets/paper/Paper%2019.png" },
  { id: "sticker-20", label: "Paper 20", category: "Paper", src: "/assets/paper/Paper%2020.png" },
  { id: "sticker-21", label: "Paper 21", category: "Paper", src: "/assets/paper/Paper%2021.png" },
  { id: "sticker-22", label: "Paper 22", category: "Paper", src: "/assets/paper/Paper%2022.png" },
  { id: "sticker-23", label: "Paper 23", category: "Paper", src: "/assets/paper/Paper%2023.png" },
  { id: "sticker-24", label: "Paper 24", category: "Paper", src: "/assets/paper/Paper%2024.png" },
  { id: "sticker-25", label: "Paper 25", category: "Paper", src: "/assets/paper/Paper%2025.png" },
  { id: "sticker-26", label: "Paper 26", category: "Paper", src: "/assets/paper/Paper%2026.png" },
  { id: "sticker-27", label: "Paper 27", category: "Paper", src: "/assets/paper/Paper%2027.png" },
  { id: "sticker-28", label: "Paper 28", category: "Paper", src: "/assets/paper/Paper%2028.png" },
  { id: "sticker-29", label: "Paper 29", category: "Paper", src: "/assets/paper/Paper%2029.png" },
  { id: "sticker-30", label: "Paper 30", category: "Paper", src: "/assets/paper/Paper%2030.png" },
  { id: "sticker-31", label: "Paper 31", category: "Paper", src: "/assets/paper/Paper%2031.png" },
  { id: "sticker-32", label: "Paper 32", category: "Paper", src: "/assets/paper/Paper%2032.png" },
  { id: "sticker-33", label: "Paper 33", category: "Paper", src: "/assets/paper/Paper%2033.png" },
  { id: "sticker-34", label: "Paper 34", category: "Paper", src: "/assets/paper/Paper%2034.png" },
  { id: "sticker-35", label: "Paper 35", category: "Paper", src: "/assets/paper/Paper%2035.png" },
  { id: "sticker-36", label: "Paper 36", category: "Paper", src: "/assets/paper/Paper%2036.png" },
  { id: "sticker-37", label: "Paper 37", category: "Paper", src: "/assets/paper/Paper%2037.png" },
  { id: "sticker-38", label: "Paper 38", category: "Paper", src: "/assets/paper/Paper%2038.png" },
  { id: "sticker-39", label: "Paper 39", category: "Paper", src: "/assets/paper/Paper%2039.png" },
  { id: "sticker-40", label: "Paper 40", category: "Paper", src: "/assets/paper/Paper%2040.png" },
  { id: "sticker-41", label: "Paper 41", category: "Paper", src: "/assets/paper/Paper%2041.png" },
  { id: "sticker-42", label: "Paper 42", category: "Paper", src: "/assets/paper/Paper%2042.png" },
  { id: "sticker-43", label: "Paper 43", category: "Paper", src: "/assets/paper/Paper%2043.png" },
  { id: "sticker-44", label: "Paper 44", category: "Paper", src: "/assets/paper/Paper%2044.png" },
  { id: "sticker-45", label: "Paper 45", category: "Paper", src: "/assets/paper/Paper%2045.png" },
  { id: "sticker-46", label: "Paper 46", category: "Paper", src: "/assets/paper/Paper%2046.png" },
  { id: "sticker-47", label: "Paper 47", category: "Paper", src: "/assets/paper/Paper%2047.png" },
  { id: "sticker-48", label: "Paper 48", category: "Paper", src: "/assets/paper/Paper%2048.png" },
  { id: "sticker-49", label: "Paper 49", category: "Paper", src: "/assets/paper/Paper%2049.png" },
  { id: "sticker-50", label: "Paper 50", category: "Paper", src: "/assets/paper/Paper%2050.png" },
  { id: "sticker-51", label: "Scotch Tape 01", category: "Paper", src: "/assets/paper/Scotch%20Tape%2001.png" },
  { id: "sticker-52", label: "Scotch Tape 02", category: "Paper", src: "/assets/paper/Scotch%20Tape%2002.png" },
  { id: "sticker-53", label: "Scotch Tape 03", category: "Paper", src: "/assets/paper/Scotch%20Tape%2003.png" },
  { id: "sticker-54", label: "Scotch Tape 04", category: "Paper", src: "/assets/paper/Scotch%20Tape%2004.png" },
  { id: "sticker-55", label: "Scotch Tape 05", category: "Paper", src: "/assets/paper/Scotch%20Tape%2005.png" },
  { id: "sticker-56", label: "Scotch Tape 06", category: "Paper", src: "/assets/paper/Scotch%20Tape%2006.png" },
  { id: "sticker-57", label: "Scotch Tape 07", category: "Paper", src: "/assets/paper/Scotch%20Tape%2007.png" },
  { id: "sticker-58", label: "Scotch Tape 08", category: "Paper", src: "/assets/paper/Scotch%20Tape%2008.png" },
  { id: "sticker-59", label: "Scotch Tape 09", category: "Paper", src: "/assets/paper/Scotch%20Tape%2009.png" },
  { id: "sticker-60", label: "Scotch Tape 10", category: "Paper", src: "/assets/paper/Scotch%20Tape%2010.png" },
  { id: "sticker-61", label: "Scotch Tape 11", category: "Paper", src: "/assets/paper/Scotch%20Tape%2011.png" },
  { id: "sticker-62", label: "Scotch Tape 12", category: "Paper", src: "/assets/paper/Scotch%20Tape%2012.png" },
  { id: "sticker-63", label: "Scotch Tape 16", category: "Paper", src: "/assets/paper/Scotch%20Tape%2016.png" },
  { id: "sticker-64", label: "Зажим 1", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%201.png" },
  { id: "sticker-65", label: "Зажим 2", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%202.png" },
  { id: "sticker-66", label: "Зажим 3", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%203.png" },
  { id: "sticker-67", label: "Зажим 4", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%204.png" },
  { id: "sticker-68", label: "Зажим 5", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%205.png" },
  { id: "sticker-69", label: "Зажим 6", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%206.png" },
  { id: "sticker-70", label: "Зажим 7", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%207.png" },
  { id: "sticker-71", label: "Зажим 8", category: "Paper", src: "/assets/paper/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%208.png" },
  { id: "sticker-72", label: "Кнопка 1", category: "Paper", src: "/assets/paper/%D0%9A%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0%201.png" },
  { id: "sticker-73", label: "Кнопка 2", category: "Paper", src: "/assets/paper/%D0%9A%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0%202.png" },
  { id: "sticker-74", label: "Кнопка 3", category: "Paper", src: "/assets/paper/%D0%9A%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0%203.png" },
  { id: "sticker-75", label: "Стикер 1", category: "Paper", src: "/assets/paper/%D0%A1%D1%82%D0%B8%D0%BA%D0%B5%D1%80%201.png" },
  { id: "sticker-76", label: "Стикер 2", category: "Paper", src: "/assets/paper/%D0%A1%D1%82%D0%B8%D0%BA%D0%B5%D1%80%202.png" },
  { id: "sticker-77", label: "Стикер 3", category: "Paper", src: "/assets/paper/%D0%A1%D1%82%D0%B8%D0%BA%D0%B5%D1%80%203.png" },
  { id: "sticker-78", label: "Стикер 4", category: "Paper", src: "/assets/paper/%D0%A1%D1%82%D0%B8%D0%BA%D0%B5%D1%80%204.png" },
  { id: "sticker-79", label: "Стикер 5", category: "Paper", src: "/assets/paper/%D0%A1%D1%82%D0%B8%D0%BA%D0%B5%D1%80%205.png" },
  { id: "sticker-80", label: "02", category: "Vintage", src: "/assets/vintage/02.png" },
  { id: "sticker-81", label: "03", category: "Vintage", src: "/assets/vintage/03.png" },
  { id: "sticker-82", label: "04", category: "Vintage", src: "/assets/vintage/04.png" },
  { id: "sticker-83", label: "05", category: "Vintage", src: "/assets/vintage/05.png" },
  { id: "sticker-84", label: "06", category: "Vintage", src: "/assets/vintage/06.png" },
  { id: "sticker-85", label: "07", category: "Vintage", src: "/assets/vintage/07.png" },
  { id: "sticker-86", label: "08", category: "Vintage", src: "/assets/vintage/08.png" },
  { id: "sticker-87", label: "09", category: "Vintage", src: "/assets/vintage/09.png" },
  { id: "sticker-88", label: "10", category: "Vintage", src: "/assets/vintage/10.png" },
  { id: "sticker-89", label: "11", category: "Vintage", src: "/assets/vintage/11.png" },
  { id: "sticker-90", label: "12", category: "Vintage", src: "/assets/vintage/12.png" },
  { id: "sticker-91", label: "13", category: "Vintage", src: "/assets/vintage/13.png" },
  { id: "sticker-92", label: "14", category: "Vintage", src: "/assets/vintage/14.png" },
  { id: "sticker-93", label: "15", category: "Vintage", src: "/assets/vintage/15.png" },
  { id: "sticker-94", label: "16", category: "Vintage", src: "/assets/vintage/16.png" },
  { id: "sticker-95", label: "17", category: "Vintage", src: "/assets/vintage/17.png" },
  { id: "sticker-96", label: "18", category: "Vintage", src: "/assets/vintage/18.png" },
  { id: "sticker-97", label: "19", category: "Vintage", src: "/assets/vintage/19.png" },
  { id: "sticker-98", label: "20", category: "Vintage", src: "/assets/vintage/20.png" },
  { id: "sticker-99", label: "21", category: "Vintage", src: "/assets/vintage/21.png" },
  { id: "sticker-100", label: "22", category: "Vintage", src: "/assets/vintage/22.png" },
  { id: "sticker-101", label: "23", category: "Vintage", src: "/assets/vintage/23.png" },
  { id: "sticker-102", label: "24", category: "Vintage", src: "/assets/vintage/24.png" },
  { id: "sticker-103", label: "25", category: "Vintage", src: "/assets/vintage/25.png" },
  { id: "sticker-104", label: "26", category: "Vintage", src: "/assets/vintage/26.png" },
  { id: "sticker-105", label: "27", category: "Vintage", src: "/assets/vintage/27.png" },
  { id: "sticker-106", label: "28", category: "Vintage", src: "/assets/vintage/28.png" },
  { id: "sticker-107", label: "29", category: "Vintage", src: "/assets/vintage/29.png" },
  { id: "sticker-108", label: "30", category: "Vintage", src: "/assets/vintage/30.png" },
  { id: "sticker-109", label: "31", category: "Vintage", src: "/assets/vintage/31.png" },
  { id: "sticker-110", label: "32", category: "Vintage", src: "/assets/vintage/32.png" },
  { id: "sticker-111", label: "33", category: "Vintage", src: "/assets/vintage/33.png" },
  { id: "sticker-112", label: "34", category: "Vintage", src: "/assets/vintage/34.png" },
  { id: "sticker-113", label: "35 1", category: "Vintage", src: "/assets/vintage/35%201.png" },
  { id: "sticker-114", label: "6490e7eb-6231-466f-9416-298c59982d6c 1", category: "Vintage", src: "/assets/vintage/6490e7eb-6231-466f-9416-298c59982d6c%201.png" },
  { id: "sticker-115", label: "Зажим 8", category: "Vintage", src: "/assets/vintage/%D0%97%D0%B0%D0%B6%D0%B8%D0%BC%208.png" },
  { id: "sticker-116", label: "image 43", category: "Flowers", src: "/assets/flowers/image%2043.png" },
  { id: "sticker-117", label: "image 44", category: "Flowers", src: "/assets/flowers/image%2044.png" },
  { id: "sticker-118", label: "image 45", category: "Flowers", src: "/assets/flowers/image%2045.png" },
  { id: "sticker-119", label: "image 46", category: "Flowers", src: "/assets/flowers/image%2046.png" },
  { id: "sticker-120", label: "image 47", category: "Flowers", src: "/assets/flowers/image%2047.png" },
  { id: "sticker-121", label: "image 48", category: "Flowers", src: "/assets/flowers/image%2048.png" },
  { id: "sticker-122", label: "image 49", category: "Flowers", src: "/assets/flowers/image%2049.png" },
  { id: "sticker-123", label: "image 50", category: "Flowers", src: "/assets/flowers/image%2050.png" },
  { id: "sticker-124", label: "image 51", category: "Flowers", src: "/assets/flowers/image%2051.png" },
  { id: "sticker-125", label: "image 34", category: "G Style", src: "/assets/gstyle/image%2034.png" },
  { id: "sticker-126", label: "image 35", category: "G Style", src: "/assets/gstyle/image%2035.png" },
  { id: "sticker-127", label: "image 36", category: "G Style", src: "/assets/gstyle/image%2036.png" },
  { id: "sticker-128", label: "image 37", category: "G Style", src: "/assets/gstyle/image%2037.png" },
  { id: "sticker-129", label: "image 38", category: "G Style", src: "/assets/gstyle/image%2038.png" },
  { id: "sticker-130", label: "image 39", category: "G Style", src: "/assets/gstyle/image%2039.png" },
  { id: "sticker-131", label: "image 40", category: "G Style", src: "/assets/gstyle/image%2040.png" },
  { id: "sticker-132", label: "image 41", category: "G Style", src: "/assets/gstyle/image%2041.png" },
  { id: "sticker-133", label: "image 42", category: "G Style", src: "/assets/gstyle/image%2042.png" },
  { id: "sticker-134", label: "image 22", category: "Duck", src: "/assets/duck/image%2022.png" },
  { id: "sticker-135", label: "image 23", category: "Duck", src: "/assets/duck/image%2023.png" },
  { id: "sticker-136", label: "image 24", category: "Duck", src: "/assets/duck/image%2024.png" },
  { id: "sticker-137", label: "image 26", category: "Duck", src: "/assets/duck/image%2026.png" },
  { id: "sticker-138", label: "image 52", category: "Duck", src: "/assets/duck/image%2052.png" },
  { id: "sticker-139", label: "image 53", category: "Duck", src: "/assets/duck/image%2053.png" },
  { id: "sticker-140", label: "image 54", category: "Duck", src: "/assets/duck/image%2054.png" },
  { id: "sticker-141", label: "image 56", category: "Duck", src: "/assets/duck/image%2056.png" },
  { id: "sticker-142", label: "image 57", category: "Pumpkin", src: "/assets/pumpkin/image%2057.png" },
  { id: "sticker-143", label: "image 58", category: "Pumpkin", src: "/assets/pumpkin/image%2058.png" },
  { id: "sticker-144", label: "image 59", category: "Pumpkin", src: "/assets/pumpkin/image%2059.png" },
  { id: "sticker-145", label: "image 60", category: "Pumpkin", src: "/assets/pumpkin/image%2060.png" },
  { id: "sticker-146", label: "thumbnail_large-1", category: "Letters", src: "/assets/letters/thumbnail_large-1.png" },
  { id: "sticker-147", label: "tl(1)-1", category: "Letters", src: "/assets/letters/tl%281%29-1.png" },
  { id: "sticker-148", label: "tl(1)-2", category: "Letters", src: "/assets/letters/tl%281%29-2.png" },
  { id: "sticker-149", label: "tl(1)", category: "Letters", src: "/assets/letters/tl%281%29.png" },
  { id: "sticker-150", label: "tl(10)-1", category: "Letters", src: "/assets/letters/tl%2810%29-1.png" },
  { id: "sticker-151", label: "tl(10)-2", category: "Letters", src: "/assets/letters/tl%2810%29-2.png" },
  { id: "sticker-152", label: "tl(10)", category: "Letters", src: "/assets/letters/tl%2810%29.png" },
  { id: "sticker-153", label: "tl(11)-1", category: "Letters", src: "/assets/letters/tl%2811%29-1.png" },
  { id: "sticker-154", label: "tl(11)-2", category: "Letters", src: "/assets/letters/tl%2811%29-2.png" },
  { id: "sticker-155", label: "tl(11)", category: "Letters", src: "/assets/letters/tl%2811%29.png" },
  { id: "sticker-156", label: "tl(12)-1", category: "Letters", src: "/assets/letters/tl%2812%29-1.png" },
  { id: "sticker-157", label: "tl(12)-2", category: "Letters", src: "/assets/letters/tl%2812%29-2.png" },
  { id: "sticker-158", label: "tl(12)", category: "Letters", src: "/assets/letters/tl%2812%29.png" },
  { id: "sticker-159", label: "tl(13)-1", category: "Letters", src: "/assets/letters/tl%2813%29-1.png" },
  { id: "sticker-160", label: "tl(13)-2", category: "Letters", src: "/assets/letters/tl%2813%29-2.png" },
  { id: "sticker-161", label: "tl(13)", category: "Letters", src: "/assets/letters/tl%2813%29.png" },
  { id: "sticker-162", label: "tl(14)-1", category: "Letters", src: "/assets/letters/tl%2814%29-1.png" },
  { id: "sticker-163", label: "tl(14)-2", category: "Letters", src: "/assets/letters/tl%2814%29-2.png" },
  { id: "sticker-164", label: "tl(14)", category: "Letters", src: "/assets/letters/tl%2814%29.png" },
  { id: "sticker-165", label: "tl(15)-1", category: "Letters", src: "/assets/letters/tl%2815%29-1.png" },
  { id: "sticker-166", label: "tl(15)-2", category: "Letters", src: "/assets/letters/tl%2815%29-2.png" },
  { id: "sticker-167", label: "tl(15)-3", category: "Letters", src: "/assets/letters/tl%2815%29-3.png" },
  { id: "sticker-168", label: "tl(15)", category: "Letters", src: "/assets/letters/tl%2815%29.png" },
  { id: "sticker-169", label: "tl(16)-1", category: "Letters", src: "/assets/letters/tl%2816%29-1.png" },
  { id: "sticker-170", label: "tl(16)-2", category: "Letters", src: "/assets/letters/tl%2816%29-2.png" },
  { id: "sticker-171", label: "tl(16)", category: "Letters", src: "/assets/letters/tl%2816%29.png" },
  { id: "sticker-172", label: "tl(17)-1", category: "Letters", src: "/assets/letters/tl%2817%29-1.png" },
  { id: "sticker-173", label: "tl(17)-2", category: "Letters", src: "/assets/letters/tl%2817%29-2.png" },
  { id: "sticker-174", label: "tl(17)", category: "Letters", src: "/assets/letters/tl%2817%29.png" },
  { id: "sticker-175", label: "tl(18)-1", category: "Letters", src: "/assets/letters/tl%2818%29-1.png" },
  { id: "sticker-176", label: "tl(18)", category: "Letters", src: "/assets/letters/tl%2818%29.png" },
  { id: "sticker-177", label: "tl(19)-1", category: "Letters", src: "/assets/letters/tl%2819%29-1.png" },
  { id: "sticker-178", label: "tl(19)-2", category: "Letters", src: "/assets/letters/tl%2819%29-2.png" },
  { id: "sticker-179", label: "tl(19)-3", category: "Letters", src: "/assets/letters/tl%2819%29-3.png" },
  { id: "sticker-180", label: "tl(19)", category: "Letters", src: "/assets/letters/tl%2819%29.png" },
  { id: "sticker-181", label: "tl(2)-1", category: "Letters", src: "/assets/letters/tl%282%29-1.png" },
  { id: "sticker-182", label: "tl(2)-2", category: "Letters", src: "/assets/letters/tl%282%29-2.png" },
  { id: "sticker-183", label: "tl(2)", category: "Letters", src: "/assets/letters/tl%282%29.png" },
  { id: "sticker-184", label: "tl(20)-1", category: "Letters", src: "/assets/letters/tl%2820%29-1.png" },
  { id: "sticker-185", label: "tl(20)-2", category: "Letters", src: "/assets/letters/tl%2820%29-2.png" },
  { id: "sticker-186", label: "tl(20)-3", category: "Letters", src: "/assets/letters/tl%2820%29-3.png" },
  { id: "sticker-187", label: "tl(20)", category: "Letters", src: "/assets/letters/tl%2820%29.png" },
  { id: "sticker-188", label: "tl(21)-1", category: "Letters", src: "/assets/letters/tl%2821%29-1.png" },
  { id: "sticker-189", label: "tl(21)-2", category: "Letters", src: "/assets/letters/tl%2821%29-2.png" },
  { id: "sticker-190", label: "tl(21)", category: "Letters", src: "/assets/letters/tl%2821%29.png" },
  { id: "sticker-191", label: "tl(22)-1", category: "Letters", src: "/assets/letters/tl%2822%29-1.png" },
  { id: "sticker-192", label: "tl(22)", category: "Letters", src: "/assets/letters/tl%2822%29.png" },
  { id: "sticker-193", label: "tl(23)-1", category: "Letters", src: "/assets/letters/tl%2823%29-1.png" },
  { id: "sticker-194", label: "tl(23)-2", category: "Letters", src: "/assets/letters/tl%2823%29-2.png" },
  { id: "sticker-195", label: "tl(23)", category: "Letters", src: "/assets/letters/tl%2823%29.png" },
  { id: "sticker-196", label: "tl(24)-1", category: "Letters", src: "/assets/letters/tl%2824%29-1.png" },
  { id: "sticker-197", label: "tl(24)-2", category: "Letters", src: "/assets/letters/tl%2824%29-2.png" },
  { id: "sticker-198", label: "tl(24)", category: "Letters", src: "/assets/letters/tl%2824%29.png" },
  { id: "sticker-199", label: "tl(25)-1", category: "Letters", src: "/assets/letters/tl%2825%29-1.png" },
  { id: "sticker-200", label: "tl(25)-2", category: "Letters", src: "/assets/letters/tl%2825%29-2.png" },
  { id: "sticker-201", label: "tl(25)", category: "Letters", src: "/assets/letters/tl%2825%29.png" },
  { id: "sticker-202", label: "tl(26)-1", category: "Letters", src: "/assets/letters/tl%2826%29-1.png" },
  { id: "sticker-203", label: "tl(26)-2", category: "Letters", src: "/assets/letters/tl%2826%29-2.png" },
  { id: "sticker-204", label: "tl(26)", category: "Letters", src: "/assets/letters/tl%2826%29.png" },
  { id: "sticker-205", label: "tl(27)-1", category: "Letters", src: "/assets/letters/tl%2827%29-1.png" },
  { id: "sticker-206", label: "tl(27)-2", category: "Letters", src: "/assets/letters/tl%2827%29-2.png" },
  { id: "sticker-207", label: "tl(27)", category: "Letters", src: "/assets/letters/tl%2827%29.png" },
  { id: "sticker-208", label: "tl(28)-1", category: "Letters", src: "/assets/letters/tl%2828%29-1.png" },
  { id: "sticker-209", label: "tl(28)-2", category: "Letters", src: "/assets/letters/tl%2828%29-2.png" },
  { id: "sticker-210", label: "tl(28)", category: "Letters", src: "/assets/letters/tl%2828%29.png" },
  { id: "sticker-211", label: "tl(29)-1", category: "Letters", src: "/assets/letters/tl%2829%29-1.png" },
  { id: "sticker-212", label: "tl(29)-2", category: "Letters", src: "/assets/letters/tl%2829%29-2.png" },
  { id: "sticker-213", label: "tl(29)-3", category: "Letters", src: "/assets/letters/tl%2829%29-3.png" },
  { id: "sticker-214", label: "tl(29)", category: "Letters", src: "/assets/letters/tl%2829%29.png" },
  { id: "sticker-215", label: "tl(3)-1", category: "Letters", src: "/assets/letters/tl%283%29-1.png" },
  { id: "sticker-216", label: "tl(3)-2", category: "Letters", src: "/assets/letters/tl%283%29-2.png" },
  { id: "sticker-217", label: "tl(3)", category: "Letters", src: "/assets/letters/tl%283%29.png" },
  { id: "sticker-218", label: "tl(31)", category: "Letters", src: "/assets/letters/tl%2831%29.png" },
  { id: "sticker-219", label: "tl(32)", category: "Letters", src: "/assets/letters/tl%2832%29.png" },
  { id: "sticker-220", label: "tl(33)", category: "Letters", src: "/assets/letters/tl%2833%29.png" },
  { id: "sticker-221", label: "tl(34)", category: "Letters", src: "/assets/letters/tl%2834%29.png" },
  { id: "sticker-222", label: "tl(36)", category: "Letters", src: "/assets/letters/tl%2836%29.png" },
  { id: "sticker-223", label: "tl(37)", category: "Letters", src: "/assets/letters/tl%2837%29.png" },
  { id: "sticker-224", label: "tl(38)", category: "Letters", src: "/assets/letters/tl%2838%29.png" },
  { id: "sticker-225", label: "tl(39)", category: "Letters", src: "/assets/letters/tl%2839%29.png" },
  { id: "sticker-226", label: "tl(4)-1", category: "Letters", src: "/assets/letters/tl%284%29-1.png" },
  { id: "sticker-227", label: "tl(4)-2", category: "Letters", src: "/assets/letters/tl%284%29-2.png" },
  { id: "sticker-228", label: "tl(4)", category: "Letters", src: "/assets/letters/tl%284%29.png" },
  { id: "sticker-229", label: "tl(40)", category: "Letters", src: "/assets/letters/tl%2840%29.png" },
  { id: "sticker-230", label: "tl(41)", category: "Letters", src: "/assets/letters/tl%2841%29.png" },
  { id: "sticker-231", label: "tl(42)", category: "Letters", src: "/assets/letters/tl%2842%29.png" },
  { id: "sticker-232", label: "tl(43)", category: "Letters", src: "/assets/letters/tl%2843%29.png" },
  { id: "sticker-233", label: "tl(5)-1", category: "Letters", src: "/assets/letters/tl%285%29-1.png" },
  { id: "sticker-234", label: "tl(5)-2", category: "Letters", src: "/assets/letters/tl%285%29-2.png" },
  { id: "sticker-235", label: "tl(5)", category: "Letters", src: "/assets/letters/tl%285%29.png" },
  { id: "sticker-236", label: "tl(6)-1", category: "Letters", src: "/assets/letters/tl%286%29-1.png" },
  { id: "sticker-237", label: "tl(6)-2", category: "Letters", src: "/assets/letters/tl%286%29-2.png" },
  { id: "sticker-238", label: "tl(6)", category: "Letters", src: "/assets/letters/tl%286%29.png" },
  { id: "sticker-239", label: "tl(7)-1", category: "Letters", src: "/assets/letters/tl%287%29-1.png" },
  { id: "sticker-240", label: "tl(7)-2", category: "Letters", src: "/assets/letters/tl%287%29-2.png" },
  { id: "sticker-241", label: "tl(7)", category: "Letters", src: "/assets/letters/tl%287%29.png" },
  { id: "sticker-242", label: "tl(8)-1", category: "Letters", src: "/assets/letters/tl%288%29-1.png" },
  { id: "sticker-243", label: "tl(8)-2", category: "Letters", src: "/assets/letters/tl%288%29-2.png" },
  { id: "sticker-244", label: "tl(8)", category: "Letters", src: "/assets/letters/tl%288%29.png" },
  { id: "sticker-245", label: "tl(9)-1", category: "Letters", src: "/assets/letters/tl%289%29-1.png" },
  { id: "sticker-246", label: "tl(9)", category: "Letters", src: "/assets/letters/tl%289%29.png" },
  { id: "sticker-247", label: "tl-1", category: "Letters", src: "/assets/letters/tl-1.png" },
  { id: "sticker-248", label: "tl-2", category: "Letters", src: "/assets/letters/tl-2.png" },
  { id: "sticker-249", label: "tl", category: "Letters", src: "/assets/letters/tl.png" },
];

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createTextBlock = ({ x, y, font, color, text, fontSize, width, height }) => ({
  id: createId(),
  type: "text",
  x,
  y,
  w: width || 220,
  h: height || 90,
  text: text || "",
  font: font || DEFAULT_FONT,
  color: color || DEFAULT_COLOR,
  fontSize: fontSize || DEFAULT_TEXT_SIZE,
});

const createStickerBlock = ({ x, y, src }) => ({
  id: createId(),
  type: "sticker",
  x,
  y,
  w: 90,
  h: 90,
  src,
});

const PORTRAIT_FRAME_SRC = "/assets/frame.png";
const PORTRAIT_FRAME_INSET = { top: 10, right: 10, bottom: 30, left: 10 };
const EMPTY_BLOCKS = Object.freeze([]);

const createImageBlock = ({ x, y, src }) => ({
  id: createId(),
  type: "image",
  x,
  y,
  w: 180,
  h: 140,
  src,
});

const createFramedImageBlock = ({ x, y, imageSrc, frameSrc, frameInset }) => ({
  id: createId(),
  type: "framedImage",
  x,
  y,
  w: 220,
  h: 280,
  imageSrc,
  frameSrc,
  frameInset,
});

const createEmptyPage = () => ({
  frontBlocks: [],
  backBlocks: [],
});

const createDefaultPages = (count = DEFAULT_PAGES) =>
  Array.from({ length: count }, () => createEmptyPage());

const normalizePages = (pages) =>
  pages.map((page) => ({
    frontBlocks: Array.isArray(page.frontBlocks) ? page.frontBlocks : [],
    backBlocks: Array.isArray(page.backBlocks) ? page.backBlocks : [],
  }));

const getStorageUserScope = (userId) => {
  const normalized = String(userId || "").trim();
  return normalized || "anonymous";
};

const loadPages = (diaryType = DIARY_TYPE_PRIVATE, userId = null) => {
  const normalizedDiaryType = normalizeDiaryType(diaryType, DIARY_TYPE_PRIVATE);
  const storageKey = getPagesStorageKey(normalizedDiaryType, userId);
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        return normalizePages(parsed);
      }
    } catch {
      // ignore
    }
  }

  return createDefaultPages();
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseEntryPages = (content) => {
  if (!content) return null;
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (Array.isArray(parsed)) return normalizePages(parsed);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.pages)) {
      return normalizePages(parsed.pages);
    }
  } catch {
    // ignore malformed content and fall back to local state
  }
  return null;
};

const parseBooleanLike = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
};

const normalizeDiaryType = (value, fallback = DIARY_TYPE_PRIVATE) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === DIARY_TYPE_PRIVATE || normalized === DIARY_TYPE_COLLABORATIVE) {
      return normalized;
    }
  }
  return fallback;
};

const getEntryDiaryType = (entry, fallback = null) => {
  const normalizedType = normalizeDiaryType(entry?.diary_type, "");
  if (normalizedType) return normalizedType;

  const privacyFlag = parseBooleanLike(entry?.is_private ?? entry?.isPrivate);
  if (privacyFlag === true) return DIARY_TYPE_PRIVATE;
  if (privacyFlag === false) return DIARY_TYPE_COLLABORATIVE;
  return fallback;
};

const matchesDiaryType = (entry, requestedDiaryType) => {
  const expectedType = normalizeDiaryType(requestedDiaryType, DIARY_TYPE_PRIVATE);
  const resolvedType = getEntryDiaryType(entry);
  if (resolvedType) return resolvedType === expectedType;
  // Legacy rows without diary metadata are treated as private only.
  return expectedType === DIARY_TYPE_PRIVATE;
};

const getDiaryStorageKey = (diaryType, userId = null) =>
  `${ACTIVE_DIARY_ENTRY_STORAGE_PREFIX}${getStorageUserScope(userId)}:${normalizeDiaryType(diaryType)}`;

const getPagesStorageKey = (diaryType, userId) =>
  `${STORAGE_KEY_PREFIX}${getStorageUserScope(userId)}:${normalizeDiaryType(diaryType)}`;

const normalizeCollaboratorRows = (rows = [], fallbackOwner = "Owner") => {
  const ownerRow = rows.find((row) => row.role === "owner");
  const ownerUsername = ownerRow?.username || fallbackOwner;
  const owner = {
    username: ownerUsername,
    role: "owner",
    color: getColorForUser(ownerUsername),
  };

  const collaborators = rows
    .filter((row) => row.role !== "owner" && row.status === "accepted")
    .map((row) => ({
      id: row.user_id || row.id,
      username: row.username,
      role: row.role || "collaborator",
      color: getColorForUser(row.username || ""),
    }));

  const invites = rows
    .filter((row) => row.status === "pending")
    .map((row) => ({
      id: row.id,
      collaboratorId: row.user_id || null,
      username: row.username,
      status: "pending",
    }));

  return { owner, collaborators, invites };
};

export default function FlipBook({
  registerActions,
  onPageCountChange,
  onPageInfoChange,
  currentUser,
  collaborationEnabled = false,
}) {
  const navigate = useNavigate();
  const { id: routeEntryId } = useParams();
  const requestedDiaryType = collaborationEnabled
    ? DIARY_TYPE_COLLABORATIVE
    : DIARY_TYPE_PRIVATE;
  const [pages, setPages] = useState(() => createDefaultPages());
  const [current, setCurrent] = useState(0);
  const [isOpen] = useState(true);
  const [active, setActive] = useState({ index: 0, side: "front" });
  const activeRef = useRef(active);
  const [pageBounds, setPageBounds] = useState(PAGE_BOUNDS);
  const [isFlipping, setIsFlipping] = useState(false);
  const flipTimerRef = useRef(null);
  const [flipDurationMs, setFlipDurationMs] = useState(500);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const deleteTimerRef = useRef(null);

  const [activeTool, setActiveTool] = useState(TOOL_KEYS.TEXT);
  const [selectedSticker, setSelectedSticker] = useState(STICKERS[0]);
  const [pendingImage, setPendingImage] = useState(null);
  const [pendingFrameImage, setPendingFrameImage] = useState(null);
  const [uploadMode, setUploadMode] = useState("normal");
  const [sessionUser, setSessionUser] = useState(() => ({
    id: currentUser?.id || "",
    username: currentUser?.username || "",
    name: currentUser?.name || currentUser?.username || "",
  }));
  const [entryId, setEntryId] = useState(routeEntryId || null);
  const [entryDiaryType, setEntryDiaryType] = useState(requestedDiaryType);
  const [entryRole, setEntryRole] = useState("owner");
  const [entryTitle, setEntryTitle] = useState(FALLBACK_ENTRY_TITLE);
  const [entryLoading, setEntryLoading] = useState(true);
  const [entryError, setEntryError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [friendsDirectory, setFriendsDirectory] = useState([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [incomingInvites, setIncomingInvites] = useState([]);
  const [collabState, setCollabState] = useState(() => {
    const ownerUsername = currentUser?.username || "Owner";
    const owner = {
      username: ownerUsername,
      role: "owner",
      color: getColorForUser(ownerUsername),
    };
    return {
      bookId: routeEntryId ? `book-${routeEntryId}` : "book-1",
      owner,
      collaborators: [],
      invites: [],
      unmetFriendships: [],
    };
  });
  const [inviteName, setInviteName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteMenuRef = useRef(null);
  const [inviteError, setInviteError] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [fontFamily, setFontFamily] = useState(
    () => localStorage.getItem("tool-font") || DEFAULT_FONT
  );
  const [fontColor, setFontColor] = useState(
    () => localStorage.getItem("tool-color") || DEFAULT_COLOR
  );
  const [fontSize, setFontSize] = useState(() => {
    const stored = parseInt(localStorage.getItem("tool-font-size") || "", 10);
    return Number.isFinite(stored) ? stored : DEFAULT_TEXT_SIZE;
  });

  const [selectedBlock, setSelectedBlock] = useState(null);
  const selectedRef = useRef(selectedBlock);
  const [zoomMode, setZoomMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [isMicArmed, setIsMicArmed] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState(false);
  const [activeTextId, setActiveTextId] = useState(null);
  const [stickerFilter, setStickerFilter] = useState("All");
  const shouldListenRef = useRef(false);
  const recognitionRef = useRef(null);
  const speechTargetRef = useRef(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const stickerMenuRef = useRef(null);
  const uploadInputRef = useRef(null);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const fontMenuRef = useRef(null);
  const currentUserId = sessionUser?.id || currentUser?.id || currentUser?.username || "local";
  const storageUserId = sessionUser?.id || currentUser?.id || null;
  const currentUserName =
    sessionUser?.name || sessionUser?.username || currentUser?.name || currentUser?.username || "You";
  const isOwner = entryRole === "owner";
  const friendshipBlockers = Array.isArray(collabState.unmetFriendships)
    ? collabState.unmetFriendships
    : [];
  const hasFriendshipBlockers =
    entryDiaryType === DIARY_TYPE_COLLABORATIVE && !isOwner && friendshipBlockers.length > 0;
  const canEditEntry = (entryRole === "owner" || entryRole === "editor") && !hasFriendshipBlockers;
  const canUseCollaborationUi = entryDiaryType === DIARY_TYPE_COLLABORATIVE;
  const [remotePresence, setRemotePresence] = useState({});
  const presenceChannelRef = useRef(null);
  const presenceThrottleRef = useRef(null);
  const pendingPresenceRef = useRef(null);
  const lastPresenceTextIdRef = useRef(null);
  const suppressBroadcastRef = useRef(false);
  const didPersistInitialPagesRef = useRef(false);
  const isHydratingFromBackendRef = useRef(false);
  const skipNextRemoteSaveRef = useRef(false);
  const skipNextRealtimeEmitRef = useRef(false);
  const saveTimerRef = useRef(null);
  const realtimeSocketRef = useRef(null);
  const realtimeEmitTimerRef = useRef(null);

  const hydratePagesFromEntry = (entry) => {
    const parsedPages = parseEntryPages(entry?.content);
    if (parsedPages && parsedPages.length) {
      isHydratingFromBackendRef.current = true;
      skipNextRemoteSaveRef.current = true;
      setPages(parsedPages);
      setCurrent(0);
      setActive({ index: 0, side: "front" });
      queueMicrotask(() => {
        isHydratingFromBackendRef.current = false;
      });
    }
  };

  const refreshCollaborators = async (targetEntryId, ownerUsername, options = {}) => {
    if (!targetEntryId) return;
    try {
      const collabData = await getCollaborators(targetEntryId);
      const ownerFromApi = collabData?.owner?.username || ownerUsername;
      const normalized = normalizeCollaboratorRows(collabData?.collaborators || [], ownerFromApi);
      const unmetFriendships = Array.isArray(collabData?.unmet_friendships)
        ? collabData.unmet_friendships
        : [];
      const activeRole = options.currentRole || entryRole;
      const shouldWarn = activeRole !== "owner" && unmetFriendships.length > 0;

      if (shouldWarn) {
        const names = unmetFriendships
          .map((item) => item?.username)
          .filter(Boolean)
          .join(", ");
        setInviteMessage(
          names
            ? `You must be friends with ${names} before you can edit this collaborative diary.`
            : "You must be friends with all collaborators before you can edit this diary."
        );
      } else if (!inviteError) {
        setInviteMessage("");
      }

      setCollabState({
        bookId: `book-${targetEntryId}`,
        owner: normalized.owner,
        collaborators: normalized.collaborators,
        invites: normalized.invites,
        unmetFriendships,
      });
    } catch {
      // Keep existing collaboration UI state on backend errors.
    }
  };

  const refreshIncomingInvites = async () => {
    try {
      const inviteData = await getMyCollaborationInvites();
      const rows = Array.isArray(inviteData?.invites) ? inviteData.invites : [];
      setIncomingInvites(rows);
    } catch {
      setIncomingInvites([]);
    }
  };

  const persistActiveEntryId = (nextEntryId, diaryType = requestedDiaryType) => {
    if (!nextEntryId) return null;
    const normalizedId = String(nextEntryId);
    const normalizedDiaryType = normalizeDiaryType(diaryType, requestedDiaryType);
    setEntryId(normalizedId);
    setEntryDiaryType(normalizedDiaryType);
    if (typeof window !== "undefined") {
      localStorage.setItem(getDiaryStorageKey(normalizedDiaryType, storageUserId), normalizedId);
      localStorage.setItem("activeDiaryEntryId", normalizedId);
    }
    return normalizedId;
  };

  const resolveInviteEntryId = async () => {
    const collaborativeStorageKey = getDiaryStorageKey(DIARY_TYPE_COLLABORATIVE, storageUserId);
    const storedCollaborativeId =
      typeof window !== "undefined" ? localStorage.getItem(collaborativeStorageKey) : null;
    const immediateId =
      (entryDiaryType === DIARY_TYPE_COLLABORATIVE ? entryId : null) ||
      routeEntryId ||
      storedCollaborativeId;
    if (immediateId) {
      try {
        const entryResult = await getEntry(immediateId);
        const immediateEntry = entryResult?.entry || null;
        if (getEntryDiaryType(immediateEntry) === DIARY_TYPE_COLLABORATIVE) {
          return persistActiveEntryId(immediateEntry.id, DIARY_TYPE_COLLABORATIVE);
        }
      } catch {
        // Continue to collaborative fallback lookup below.
      }
    }

    let entries = [];
    try {
      const entriesResult = await getEntries();
      entries = Array.isArray(entriesResult?.entries) ? entriesResult.entries : [];
    } catch {
      // Continue with createEntry fallback if entries listing is unavailable.
    }
    const meId = sessionUser?.id || currentUserId;
    const collaborativeEntries = entries.filter(
      (item) => getEntryDiaryType(item) === DIARY_TYPE_COLLABORATIVE
    );
    const acceptedSharedEntry = collaborativeEntries.find(
      (item) => String(item.my_role || "").trim().length > 0
    );
    const fallbackEntry =
      acceptedSharedEntry ||
      collaborativeEntries.find((item) => String(item.owner_id || "") === String(meId || "")) ||
      collaborativeEntries[0] ||
      null;

    if (fallbackEntry?.id) {
      setEntryTitle(fallbackEntry.title || FALLBACK_ENTRY_TITLE);
      setEntryRole(fallbackEntry.my_role || "owner");
      return persistActiveEntryId(fallbackEntry.id, DIARY_TYPE_COLLABORATIVE);
    }

    const created = await createEntry({
      title: entryTitle || FALLBACK_ENTRY_TITLE,
      content: createDefaultPages(),
      isPrivate: false,
      diaryType: DIARY_TYPE_COLLABORATIVE,
    });
    const createdEntry = created?.entry || null;
    if (!createdEntry?.id) return null;

    setEntryTitle(createdEntry.title || FALLBACK_ENTRY_TITLE);
    setEntryRole("owner");
    return persistActiveEntryId(createdEntry.id, DIARY_TYPE_COLLABORATIVE);
  };

  useEffect(() => {
    const parseDurationMs = (value) => {
      const trimmed = String(value || "").trim();
      if (!trimmed) return null;
      if (trimmed.endsWith("ms")) {
        const num = parseFloat(trimmed.replace("ms", ""));
        return Number.isFinite(num) ? num : null;
      }
      if (trimmed.endsWith("s")) {
        const num = parseFloat(trimmed.replace("s", ""));
        return Number.isFinite(num) ? num * 1000 : null;
      }
      const num = parseFloat(trimmed);
      return Number.isFinite(num) ? num : null;
    };

    const readPageBounds = () => {
      if (typeof window === "undefined") return PAGE_BOUNDS;
      const root = window.getComputedStyle(document.documentElement);
      const width = parseFloat(root.getPropertyValue("--page-width"));
      const height = parseFloat(root.getPropertyValue("--page-height"));
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return { width, height };
      }
      const pageEl = document.querySelector(".book .page");
      if (pageEl) {
        const rect = pageEl.getBoundingClientRect();
        if (rect.width && rect.height) {
          return { width: rect.width, height: rect.height };
        }
      }
      return PAGE_BOUNDS;
    };

    const updateBounds = () => {
      const next = readPageBounds();
      setPageBounds(next);
      const root = window.getComputedStyle(document.documentElement);
      const durationValue = root.getPropertyValue("--flip-duration");
      const parsed = parseDurationMs(durationValue);
      if (parsed && parsed > 0) {
        setFlipDurationMs(parsed);
      }
    };

    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) {
        clearTimeout(flipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (presenceThrottleRef.current) {
        clearTimeout(presenceThrottleRef.current);
        presenceThrottleRef.current = null;
      }
    };
  }, []);


  useEffect(() => {
    if (!isListening) return;
    const { index, side } = activeRef.current;
    const blocks = getPageBlocks(index, side);
    const hasText = blocks.some((block) => block.type === "text");
    if (!hasText) {
      disarmMic();
      setActiveTool(TOOL_KEYS.SELECT);
      setSelectedBlock(null);
      setActiveTextId(null);
    } else if (activeTextId) {
      const activeBlock = getBlockById(index, side, activeTextId);
      if (!activeBlock || activeBlock.type !== "text") {
        disarmMic();
        setActiveTool(TOOL_KEYS.SELECT);
        setActiveTextId(null);
      }
    }
  }, [pages, active, isListening, activeTextId]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    selectedRef.current = selectedBlock;
  }, [selectedBlock]);

  useEffect(() => {
    isHydratingFromBackendRef.current = true;
    skipNextRemoteSaveRef.current = true;
    setPages(loadPages(requestedDiaryType, storageUserId));
    setCurrent(0);
    setActive({ index: 0, side: "front" });
    queueMicrotask(() => {
      isHydratingFromBackendRef.current = false;
    });
  }, [requestedDiaryType, storageUserId]);

  useEffect(() => {
    if (!stickerOpen) return;
    const handlePointerDown = (event) => {
      if (!stickerMenuRef.current) return;
      if (!stickerMenuRef.current.contains(event.target)) {
        setStickerOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [stickerOpen]);

  useEffect(() => {
    if (!showFontDropdown) return;
    const handlePointerDown = (event) => {
      if (!fontMenuRef.current) return;
      if (!fontMenuRef.current.contains(event.target)) {
        setShowFontDropdown(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [showFontDropdown]);

  useEffect(() => {
    let cancelled = false;

    const loadEntryContext = async () => {
      setEntryLoading(true);
      setEntryError("");
      setEntryDiaryType(requestedDiaryType);
      setCollabState((prev) => ({ ...prev, unmetFriendships: [] }));

      try {
        const [profileResult, friendsResult, collaborationInvitesResult] = await Promise.all([
          getMyDiaryProfile().catch(() => null),
          getFriends().catch(() => null),
          getMyCollaborationInvites().catch(() => null),
        ]);

        if (cancelled) return;

        const me = profileResult?.user || null;
        if (me) {
          setSessionUser({
            id: me.id || "",
            username: me.username || "",
            name: me.full_name || me.username || "",
          });
        }

        const friends = Array.isArray(friendsResult?.friends) ? friendsResult.friends : [];
        setFriendsDirectory(
          friends.map((friend) => ({
            id: friend.id,
            username: friend.username,
          }))
        );
        const incoming = Array.isArray(collaborationInvitesResult?.invites)
          ? collaborationInvitesResult.invites
          : [];
        setIncomingInvites(incoming);

        const meId = me?.id || currentUserId;
        const storageKey = getDiaryStorageKey(requestedDiaryType, meId);
        const storedEntryId =
          typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
        const candidateEntryId = routeEntryId || storedEntryId;

        let entry = null;
        if (candidateEntryId) {
          try {
            const entryResult = await getEntry(candidateEntryId);
            entry = entryResult?.entry || null;
            if (
              entry &&
              !routeEntryId &&
              !matchesDiaryType(entry, requestedDiaryType)
            ) {
              entry = null;
            }
          } catch (error) {
            // Route-bound ids should still surface their real error.
            if (routeEntryId) {
              throw error;
            }
            // Recover from stale/inaccessible remembered entry id.
            if (typeof window !== "undefined") {
              localStorage.removeItem(storageKey);
            }
          }
        }

        if (!entry) {
          try {
            const entriesResult = await getEntries();
            const entries = Array.isArray(entriesResult?.entries) ? entriesResult.entries : [];
            const matchingEntries = entries.filter(
              (item) => matchesDiaryType(item, requestedDiaryType)
            );
            const acceptedSharedEntry = matchingEntries.find(
              (item) => String(item.my_role || "").trim().length > 0
            );
            entry =
              acceptedSharedEntry ||
              matchingEntries.find((item) => String(item.owner_id || "") === String(meId || "")) ||
              matchingEntries[0] ||
              null;
          } catch {
            // If listing fails, continue with entry creation fallback.
          }

          if (!entry) {
            const created = await createEntry({
              title: FALLBACK_ENTRY_TITLE,
              content: createDefaultPages(),
              isPrivate: requestedDiaryType === DIARY_TYPE_PRIVATE,
              diaryType: requestedDiaryType,
            });
            entry = created?.entry || null;
          }
        }

        if (cancelled) return;

        if (!entry?.id) {
          throw new Error("Failed to load diary entry");
        }

        const resolvedDiaryType = getEntryDiaryType(entry, requestedDiaryType);
        const resolvedEntryId = persistActiveEntryId(entry.id, resolvedDiaryType);
        setEntryTitle(entry.title || FALLBACK_ENTRY_TITLE);
        hydratePagesFromEntry(entry);

        // If my_role is null, this user is the entry owner.
        const role = entry.my_role || "owner";
        setEntryRole(role);

        if (resolvedDiaryType === DIARY_TYPE_COLLABORATIVE) {
          await refreshCollaborators(
            resolvedEntryId,
            entry.owner_username || me?.username || currentUser?.username || "Owner",
            { currentRole: role }
          );
        } else {
          setInviteMessage("");
          const ownerUsername =
            entry.owner_username ||
            me?.username ||
            currentUser?.username ||
            collabState.owner?.username ||
            "Owner";
          setCollabState({
            bookId: `book-${resolvedEntryId}`,
            owner: {
              username: ownerUsername,
              role: "owner",
              color: getColorForUser(ownerUsername),
            },
            collaborators: [],
            invites: [],
            unmetFriendships: [],
          });
        }
      } catch (error) {
        if (cancelled) return;
        const deniedAccess =
          error?.status === 403 ||
          error?.status === 404 ||
          /access denied/i.test(String(error?.message || ""));
        if (routeEntryId && deniedAccess) {
          navigate(COLLAB_HOME_ROUTE, { replace: true });
          return;
        }
        setEntryRole(currentUser?.role === "collaborator" ? "viewer" : "owner");
        setEntryError(error?.message || "Failed to load diary");
      } finally {
        if (!cancelled) {
          setEntryLoading(false);
        }
      }
    };

    loadEntryContext();

    return () => {
      cancelled = true;
    };
  }, [routeEntryId, requestedDiaryType, navigate]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (entryDiaryType !== DIARY_TYPE_COLLABORATIVE || !entryId) {
      if (realtimeSocketRef.current) {
        realtimeSocketRef.current.disconnect();
        realtimeSocketRef.current = null;
      }
      return undefined;
    }

    const targetEntryId = String(entryId);
    const socket = makeSocket();
    realtimeSocketRef.current = socket;

    const unwrapPayload = (rawPayload) => {
      if (rawPayload && typeof rawPayload === "object" && rawPayload.payload) {
        return rawPayload.payload;
      }
      return rawPayload || {};
    };

    const applyIncomingPages = (rawContent) => {
      const parsedPages = parseEntryPages(rawContent);
      if (!parsedPages || !parsedPages.length) return;
      isHydratingFromBackendRef.current = true;
      skipNextRemoteSaveRef.current = true;
      skipNextRealtimeEmitRef.current = true;
      setPages(parsedPages);
      queueMicrotask(() => {
        isHydratingFromBackendRef.current = false;
      });
    };

    const handleConnect = () => {
      socket.emit(COLLAB_WS_EVENTS.JOIN_ROOM, { entryId: targetEntryId });
      socket.emit(COLLAB_WS_EVENTS.STATE_REQUEST, { entryId: targetEntryId });
    };

    const handleEntryEdit = (rawPayload = {}) => {
      const payload = unwrapPayload(rawPayload);
      const incomingEntryId = String(payload.entryId || payload.entry_id || "");
      if (incomingEntryId !== targetEntryId) return;
      applyIncomingPages(payload.content);
    };

    const handleRemoteCursorMove = (rawPayload = {}) => {
      const payload = unwrapPayload(rawPayload);
      const incomingEntryId = String(payload.entryId || payload.entry_id || "");
      if (incomingEntryId && incomingEntryId !== targetEntryId) return;

      const position = payload.position && typeof payload.position === "object" ? payload.position : {};
      const textId = String(position.textId || position.id || "");
      const remoteUserId = String(payload.userId || payload.user_id || position.userId || "");
      if (!textId || !remoteUserId) return;

      const remoteName = position.name || payload.name || remoteUserId;
      const remoteColor = position.color || payload.color || getUserColor(remoteName);
      const nextCursorIndex = Number.isFinite(position.cursorIndex)
        ? position.cursorIndex
        : Number.isFinite(position.selectionEnd)
          ? position.selectionEnd
          : Number.isFinite(position.selectionStart)
            ? position.selectionStart
            : 0;

      setRemotePresence((prev) => {
        const next = { ...prev };
        const textMap = next[textId] ? { ...next[textId] } : {};
        textMap[remoteUserId] = {
          userId: remoteUserId,
          name: remoteName,
          color: remoteColor,
          cursorIndex: nextCursorIndex,
          selectionStart: Number.isFinite(position.selectionStart) ? position.selectionStart : nextCursorIndex,
          selectionEnd: Number.isFinite(position.selectionEnd) ? position.selectionEnd : nextCursorIndex,
          lastSeenTs: position.lastSeenTs || payload.timestamp || Date.now(),
        };
        next[textId] = textMap;
        return next;
      });
    };

    const handleRemoteCursorClear = (rawPayload = {}) => {
      const payload = unwrapPayload(rawPayload);
      const incomingEntryId = String(payload.entryId || payload.entry_id || "");
      if (incomingEntryId && incomingEntryId !== targetEntryId) return;
      const remoteUserId = String(payload.userId || payload.user_id || "");
      if (!remoteUserId) return;

      setRemotePresence((prev) => {
        const next = {};
        Object.entries(prev || {}).forEach(([textId, users]) => {
          if (!users || typeof users !== "object") return;
          const userMap = { ...users };
          delete userMap[remoteUserId];
          if (Object.keys(userMap).length > 0) {
            next[textId] = userMap;
          }
        });
        return next;
      });
    };

    const handleStateResponse = (rawPayload = {}) => {
      const payload = unwrapPayload(rawPayload);
      const incomingEntryId = String(payload.entryId || payload.entry_id || "");
      if (incomingEntryId && incomingEntryId !== targetEntryId) return;
      applyIncomingPages(payload.content);
    };

    const handleAccessDenied = (rawPayload = {}) => {
      const payload = unwrapPayload(rawPayload);
      const incomingEntryId = String(payload.entryId || payload.entry_id || "");
      if (incomingEntryId && incomingEntryId !== targetEntryId) return;
      const missingFriends = Array.isArray(payload.missingFriends) ? payload.missingFriends : [];
      if (missingFriends.length > 0) {
        setCollabState((prev) => ({
          ...prev,
          unmetFriendships: missingFriends,
        }));
      }
      setSaveError(payload.message || "Collaboration edit is blocked.");
    };

    const handleNotificationCreated = (rawPayload = {}) => {
      const payload = unwrapPayload(rawPayload);
      const notification = payload?.notification || payload;
      const metadata = notification?.metadata || {};
      const notificationEntryId = String(
        metadata.entryId ||
          metadata.entry_id ||
          notification?.entity_id ||
          notification?.entityId ||
          ""
      );
      if (notificationEntryId !== targetEntryId) return;

      if (notification?.type === "collaboration_removed") {
        navigate(COLLAB_HOME_ROUTE, { replace: true });
        return;
      }

      if (notification?.type === "collaboration_friendship_required") {
        const missingFriends = Array.isArray(metadata?.missingFriends) ? metadata.missingFriends : [];
        if (missingFriends.length > 0) {
          setCollabState((prev) => ({
            ...prev,
            unmetFriendships: missingFriends,
          }));
        }
        setSaveError(
          notification?.message || "You must be friends with all collaborators to edit this entry."
        );
      }
    };

    socket.on("connect", handleConnect);
    socket.on(COLLAB_WS_EVENTS.ENTRY_EDIT, handleEntryEdit);
    socket.on(COLLAB_WS_EVENTS.ENTRY_CURSOR_MOVE, handleRemoteCursorMove);
    socket.on(COLLAB_WS_EVENTS.ENTRY_CURSOR_CLEAR, handleRemoteCursorClear);
    socket.on(COLLAB_WS_EVENTS.STATE_RESPONSE, handleStateResponse);
    socket.on(COLLAB_WS_EVENTS.ACCESS_DENIED, handleAccessDenied);
    socket.on(COLLAB_WS_EVENTS.NOTIFICATION_CREATED, handleNotificationCreated);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off(COLLAB_WS_EVENTS.ENTRY_EDIT, handleEntryEdit);
      socket.off(COLLAB_WS_EVENTS.ENTRY_CURSOR_MOVE, handleRemoteCursorMove);
      socket.off(COLLAB_WS_EVENTS.ENTRY_CURSOR_CLEAR, handleRemoteCursorClear);
      socket.off(COLLAB_WS_EVENTS.STATE_RESPONSE, handleStateResponse);
      socket.off(COLLAB_WS_EVENTS.ACCESS_DENIED, handleAccessDenied);
      socket.off(COLLAB_WS_EVENTS.NOTIFICATION_CREATED, handleNotificationCreated);
      if (socket.connected) {
        socket.emit(COLLAB_WS_EVENTS.LEAVE_ROOM, { entryId: targetEntryId });
      }
      socket.disconnect();
      if (realtimeSocketRef.current === socket) {
        realtimeSocketRef.current = null;
      }
    };
  }, [entryDiaryType, entryId, navigate]);

  useEffect(() => {
    if (entryDiaryType !== DIARY_TYPE_COLLABORATIVE || !entryId || !canEditEntry) return;
    if (isHydratingFromBackendRef.current) return;
    if (skipNextRealtimeEmitRef.current) {
      skipNextRealtimeEmitRef.current = false;
      return;
    }

    const socket = realtimeSocketRef.current;
    if (!socket) return;

    if (realtimeEmitTimerRef.current) {
      clearTimeout(realtimeEmitTimerRef.current);
    }

    realtimeEmitTimerRef.current = setTimeout(() => {
      if (!socket.connected) return;
      socket.emit(COLLAB_WS_EVENTS.ENTRY_EDIT, {
        entryId: String(entryId),
        content: pages,
        operation: "page_update",
        timestamp: Date.now(),
      });
    }, 240);

    return () => {
      if (realtimeEmitTimerRef.current) {
        clearTimeout(realtimeEmitTimerRef.current);
      }
    };
  }, [pages, entryDiaryType, entryId, canEditEntry]);

  useEffect(() => {
    return () => {
      if (realtimeEmitTimerRef.current) {
        clearTimeout(realtimeEmitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (entryDiaryType !== DIARY_TYPE_COLLABORATIVE || !entryId) return undefined;
    const interval = window.setInterval(() => {
      refreshCollaborators(entryId, collabState.owner?.username || "Owner", {
        currentRole: entryRole,
      });
    }, 12000);
    return () => window.clearInterval(interval);
  }, [entryDiaryType, entryId, collabState.owner?.username, entryRole]);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return undefined;
    }
    const channel = new BroadcastChannel(`book-presence-${collabState.bookId}`);
    presenceChannelRef.current = channel;

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      if (data.userId === currentUserId) return;

      if (data.type === "presence") {
        setRemotePresence((prev) => {
          const next = { ...prev };
          if (!data.isActive) {
            if (next[data.textId]) {
              const { [data.userId]: _, ...rest } = next[data.textId];
              if (Object.keys(rest).length) {
                next[data.textId] = rest;
              } else {
                delete next[data.textId];
              }
            }
            return next;
          }
          const textMap = next[data.textId] ? { ...next[data.textId] } : {};
          textMap[data.userId] = {
            userId: data.userId,
            name: data.name,
            color: data.color,
            cursorIndex: data.cursorIndex,
            selectionStart: data.selectionStart,
            selectionEnd: data.selectionEnd,
            lastSeenTs: data.lastSeenTs || Date.now(),
          };
          next[data.textId] = textMap;
          return next;
        });
        return;
      }

      if (data.type === "page-update") {
        const { pageIndex, side, blocks } = data;
        if (!Array.isArray(blocks)) return;
        suppressBroadcastRef.current = true;
        updateBlocks(pageIndex, side, () => blocks, { broadcast: false });
        queueMicrotask(() => {
          suppressBroadcastRef.current = false;
        });
      }
    };

    return () => {
      channel.close();
      presenceChannelRef.current = null;
    };
  }, [collabState.bookId, currentUserId]);


  useEffect(() => {
    // Skip initial write on mount to avoid blocking with a large JSON stringify.
    if (!didPersistInitialPagesRef.current) {
      didPersistInitialPagesRef.current = true;
      return;
    }
    localStorage.setItem(getPagesStorageKey(requestedDiaryType, storageUserId), JSON.stringify(pages));
  }, [pages, requestedDiaryType, storageUserId]);

  useEffect(() => {
    if (!entryId || entryLoading || !canEditEntry) return;
    if (isHydratingFromBackendRef.current) return;
    if (skipNextRemoteSaveRef.current) {
      skipNextRemoteSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaveError("");
        await updateEntry(entryId, { content: pages });
      } catch (error) {
        const isFriendshipBlocked = error?.data?.code === "COLLAB_FRIENDSHIP_REQUIRED";
        if (isFriendshipBlocked) {
          const missingFriends = Array.isArray(error?.data?.missingFriends)
            ? error.data.missingFriends
            : [];
          if (missingFriends.length > 0) {
            setCollabState((prev) => ({
              ...prev,
              unmetFriendships: missingFriends,
            }));
          }
          setSaveError(error?.message || "You must be friends with all collaborators to edit this entry.");
          return;
        }

        const deniedAccess =
          error?.status === 403 ||
          error?.status === 404 ||
          /access denied/i.test(String(error?.message || ""));
        if (deniedAccess && entryDiaryType === DIARY_TYPE_COLLABORATIVE) {
          navigate(COLLAB_HOME_ROUTE, { replace: true });
          return;
        }
        setSaveError(error?.message || "Failed to save diary");
      }
    }, 650);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [pages, entryId, entryLoading, canEditEntry, entryDiaryType, navigate]);

  useEffect(() => {
    const normalizedFont = normalizeFontName(fontFamily);
    if (!FONT_OPTIONS.includes(normalizedFont)) {
      setFontFamily(DEFAULT_FONT);
    }
  }, [fontFamily]);

  useEffect(() => {
    const fontsToLoad = new Set([normalizeFontName(fontFamily)]);
    pages.forEach((page) => {
      ["frontBlocks", "backBlocks"].forEach((side) => {
        const blocks = page?.[side];
        if (!Array.isArray(blocks)) return;
        blocks.forEach((block) => {
          if (block?.type === "text") {
            fontsToLoad.add(normalizeFontName(block.font));
          }
        });
      });
    });
    fontsToLoad.forEach((fontName) => ensureFontIsLoaded(fontName));
  }, [pages, fontFamily]);

  useEffect(() => {
    localStorage.setItem("tool-font", fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem("tool-color", fontColor);
  }, [fontColor]);

  useEffect(() => {
    localStorage.setItem("tool-font-size", String(fontSize));
  }, [fontSize]);

  const updateBlocks = (index, side, updater, options = {}) => {
    setPages((prev) => {
      const next = [...prev];
      const page = { ...next[index] };
      const key = side === "front" ? "frontBlocks" : "backBlocks";
      const updatedBlocks = updater(page[key] || []);
      page[key] = updatedBlocks;
      next[index] = page;
      if (options.broadcast && !suppressBroadcastRef.current) {
        sendCollabEvent({
          type: "page-update",
          pageIndex: index,
          side,
          blocks: updatedBlocks,
        });
      }
      return next;
    });
  };

  const setBlocksForSide = (index, side, blocks, options = {}) => {
    updateBlocks(index, side, () => blocks, options);
  };

  const addBlock = (index, side, block) => {
    if (!canEditEntry) return;
    updateBlocks(index, side, (blocks) => [...blocks, block], { broadcast: true });
  };

  const buildTextSegments = (block, nextText) => {
    const username = sessionUser?.username || currentUser?.username;
    if (!username) return block.segments || [];
    const prevText = block.text || "";
    const prevSegments = Array.isArray(block.segments) ? block.segments : [];
    if (nextText === prevText) return prevSegments;
    const appended =
      prevText && nextText.startsWith(prevText) ? nextText.slice(prevText.length) : null;
    const userColor = getUserColor(username);
    if (appended && appended.length) {
      const last = prevSegments[prevSegments.length - 1];
      if (last && last.username === username) {
        return [
          ...prevSegments.slice(0, -1),
          { ...last, text: `${last.text}${appended}` },
        ];
      }
      return [
        ...prevSegments,
        { username, color: userColor, text: appended, timestamp: Date.now() },
      ];
    }
    return [{ username, color: userColor, text: nextText, timestamp: Date.now() }];
  };

  const updateBlock = (index, side, blockId, updates, options = {}) => {
    if (!canEditEntry) return;
    updateBlocks(index, side, (blocks) =>
      blocks.map((block) => {
        if (block.id !== blockId) return block;
        if (block.type === "text" && typeof updates.text === "string") {
          if (Array.isArray(updates.segments)) {
            return { ...block, ...updates };
          }
          const nextSegments = buildTextSegments(block, updates.text);
          return { ...block, ...updates, segments: nextSegments };
        }
        return { ...block, ...updates };
      }),
      { broadcast: options.broadcast }
    );
  };

  const deleteBlock = (index, side, blockId) => {
    if (!canEditEntry) return;
    updateBlocks(index, side, (blocks) => blocks.filter((block) => block.id !== blockId), {
      broadcast: true,
    });
    setSelectedBlock(null);
  };

  const getBlocksForSide = (index, side) => {
    const page = pages[index];
    if (!page) return [];
    return side === "front" ? page.frontBlocks : page.backBlocks;
  };

  const getBlockById = (index, side, blockId) => {
    return getBlocksForSide(index, side).find((block) => block.id === blockId);
  };

  const renderPreviewBlocks = (blocks) =>
    (blocks || []).map((block) => {
      const rawX = Number.isFinite(block.x) ? block.x : 0;
      const rawY = Number.isFinite(block.y) ? block.y : 0;
      const rawWidth = Number.isFinite(block.w)
        ? block.w
        : Number.isFinite(block.width)
          ? block.width
          : 120;
      const rawHeight = Number.isFinite(block.h)
        ? block.h
        : Number.isFinite(block.height)
          ? block.height
          : 80;
      const boundsWidth = pageBounds?.width;
      const boundsHeight = pageBounds?.height;

      const minWidth =
        block.type === "sticker" ? 30 : block.type === "image" || block.type === "framedImage" ? 50 : 50;
      const minHeight =
        block.type === "sticker" ? 30 : block.type === "image" || block.type === "framedImage" ? 50 : 30;

      const safeX = Number.isFinite(boundsWidth)
        ? Math.max(0, Math.min(rawX, boundsWidth - rawWidth))
        : rawX;
      const safeY = Number.isFinite(boundsHeight)
        ? Math.max(0, Math.min(rawY, boundsHeight - rawHeight))
        : rawY;
      const safeWidth =
        Number.isFinite(boundsWidth)
          ? Math.max(minWidth, Math.min(rawWidth, boundsWidth - rawX))
          : rawWidth;
      const safeHeight =
        Number.isFinite(boundsHeight)
          ? Math.max(minHeight, Math.min(rawHeight, boundsHeight - rawY))
          : rawHeight;

      const baseStyle = {
        left: `${safeX}px`,
        top: `${safeY}px`,
        width: `${safeWidth}px`,
        height: `${safeHeight}px`,
        position: "absolute",
        pointerEvents: "none",
      };

      if (block.type === "text") {
        return (
          <div
            key={block.id}
            style={{
              ...baseStyle,
              fontFamily: block.font || DEFAULT_FONT,
              fontSize: `${block.fontSize || DEFAULT_TEXT_SIZE}px`,
              color: block.color || DEFAULT_COLOR,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflow: "hidden",
            }}
          >
            {block.text}
          </div>
        );
      }

      if (block.type === "framedImage") {
        const inset = PORTRAIT_FRAME_INSET;
        return (
          <div
            key={block.id}
            style={{
              ...baseStyle,
              position: "absolute",
            }}
          >
            <div className="relative w-full h-full">
              <div
                className="absolute overflow-hidden"
                style={{
                  top: `${inset.top}%`,
                  left: `${inset.left}%`,
                  right: `${inset.right}%`,
                  bottom: `${inset.bottom}%`,
                  background: "#fff",
                }}
              >
                <img
                  src={block.imageSrc || block.src}
                  alt="Uploaded"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
              <img
                src={block.frameSrc || PORTRAIT_FRAME_SRC}
                alt="Frame"
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                draggable={false}
              />
            </div>
          </div>
        );
      }

      return (
        <img
          key={block.id}
          src={block.src}
          alt={block.type === "image" ? "Uploaded" : "Sticker"}
          style={{
            ...baseStyle,
            objectFit: "contain",
          }}
          draggable={false}
        />
      );
    });

  const openEditMode = (index, side) => {
    if (!isOpen) return;
    setActive({ index, side });
    setSelectedBlock(null);
    setIsTextEditing(false);
    setZoomMode(true);
  };

  const closeEditMode = () => {
    setZoomMode(false);
    setSelectedBlock(null);
    setIsTextEditing(false);
    disarmMic();
  };

  const handlePageClick = (index, side) => {
    openEditMode(index, side);
  };

  const flipNext = () => {
    setCurrent((prev) => Math.min(prev + 1, pages.length - 1));
    setIsFlipping(true);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setIsFlipping(false);
    }, flipDurationMs);
  };

  const flipPrev = () => {
    setCurrent((prev) => Math.max(prev - 1, 0));
    setIsFlipping(true);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setIsFlipping(false);
    }, flipDurationMs);
  };

  const addPage = () => {
    if (!isOwner) return;
    setPages((prev) => {
      const next = [...prev, createEmptyPage()];
      const nextIndex = next.length - 1;
      setCurrent(nextIndex);
      setIsFlipping(true);
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      flipTimerRef.current = setTimeout(() => {
        setIsFlipping(false);
      }, flipDurationMs);
      return next;
    });
  };

  const requestRemovePage = () => {
    if (!isOwner) return;
    if (isDeletingPage) return;
    setRemoveConfirmOpen(true);
  };

  const cancelRemovePage = () => {
    if (isDeletingPage) return;
    setRemoveConfirmOpen(false);
  };

  const confirmRemovePage = () => {
    if (!isOwner) return;
    if (isDeletingPage) return;
    if (pages.length <= 1) {
      return;
    }

    const targetIndex = current;
    setRemoveConfirmOpen(false);
    setDeletingIndex(targetIndex);
    setIsDeletingPage(true);

    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = setTimeout(() => {
      setPages((prev) => {
        if (prev.length <= 1) {
          return prev;
        }
        const next = prev.filter((_, idx) => idx !== targetIndex);
        const nextIndex = Math.max(0, Math.min(targetIndex - 1, next.length - 1));
        setCurrent(nextIndex);
        return next;
      });
      setIsDeletingPage(false);
      setDeletingIndex(null);
    }, DELETE_ANIM_MS);
  };

  useEffect(() => {
    onPageCountChange?.(pages.length);
  }, [pages.length, onPageCountChange]);

  useEffect(() => {
    registerActions?.({
      addPage,
      removePage: confirmRemovePage,
      requestRemovePage,
      cancelRemovePage,
    });
  }, [registerActions, addPage, confirmRemovePage, requestRemovePage, cancelRemovePage]);

  useEffect(() => {
    onPageInfoChange?.({
      currentPage: current + 1,
      totalPages: pages.length,
    });
  }, [current, pages.length, onPageInfoChange]);

  useEffect(() => {
    if (!isOwner) {
      stopListening();
      setIsMicArmed(false);
      setPendingPlacement(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!inviteOpen) return;
    const handleOutside = (event) => {
      if (inviteMenuRef.current && !inviteMenuRef.current.contains(event.target)) {
        setInviteOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [inviteOpen]);

  const handleStickerSelect = (sticker) => {
    setSelectedSticker(sticker);
    setActiveTool(TOOL_KEYS.STICKER);
  };

  const handleImageUpload = (event) => {
    if (!canEditEntry) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        if (uploadMode === "portrait") {
          setPendingFrameImage({
            imageSrc: reader.result,
            frameSrc: PORTRAIT_FRAME_SRC,
            frameInset: PORTRAIT_FRAME_INSET,
          });
          setPendingImage(null);
        } else {
          setPendingImage(reader.result);
          setPendingFrameImage(null);
        }
        setActiveTool(TOOL_KEYS.IMAGE);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const getPageBlocks = (index, side) => {
    const page = pages[index];
    if (!page) return [];
    const key = side === "front" ? "frontBlocks" : "backBlocks";
    return page[key] || [];
  };

  const normalizeSpeechText = (value = "") =>
    String(value)
      .replace(/\s+/g, " ")
      .trim();

  const mergeSpeechText = (...parts) =>
    parts
      .map((part) => normalizeSpeechText(part))
      .filter(Boolean)
      .join(" ");

  const pickSpeechTranscript = (result) => {
    if (!result || typeof result !== "object" || !Number.isFinite(result.length)) {
      return "";
    }
    let bestTranscript = "";
    let bestScore = -Infinity;
    for (let i = 0; i < result.length; i += 1) {
      const alternative = result[i];
      const transcript = normalizeSpeechText(alternative?.transcript || "");
      if (!transcript) continue;
      const confidence = Number.isFinite(alternative?.confidence) ? alternative.confidence : 0;
      const score = confidence + transcript.length / 10000;
      if (score > bestScore) {
        bestScore = score;
        bestTranscript = transcript;
      }
    }
    return bestTranscript;
  };

  const setSpeechTargetFromBlock = (index, side, block) => {
    speechTargetRef.current = {
      index,
      side,
      blockId: block.id,
      baseText: normalizeSpeechText(block?.text || ""),
      interimText: "",
    };
    return speechTargetRef.current;
  };

  const commitSpeechInterim = () => {
    const target = speechTargetRef.current;
    if (!target || !target.interimText) return;
    const committed = mergeSpeechText(target.baseText, target.interimText);
    target.baseText = committed;
    target.interimText = "";
    updateBlock(target.index, target.side, target.blockId, { text: committed });
  };

  const stopListening = () => {
    shouldListenRef.current = false;
    if (isListening) {
      commitSpeechInterim();
    }
    recognitionRef.current?.stop();
    setIsListening(false);
    speechTargetRef.current = null;
  };

  const startListening = (textId) => {
    if (!isOwner) return;
    if (!textId) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech-to-text is not supported in this browser. Use Chrome.");
      return;
    }

    stopListening();
    setActiveTextId(textId);
    shouldListenRef.current = true;
    setIsListening(true);

    const { index, side } = activeRef.current;
    const block = getBlockById(index, side, textId);
    if (!block || block.type !== "text") {
      stopListening();
      return;
    }
    setSpeechTargetFromBlock(index, side, block);

    const rec = recognitionRef.current || new SpeechRecognition();
    const browserLanguage =
      (Array.isArray(window.navigator?.languages) && window.navigator.languages[0]) ||
      window.navigator?.language ||
      "en-US";
    rec.lang = browserLanguage;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event) => {
      const target = speechTargetRef.current;
      if (!target) return;
      const finalChunks = [];
      const interimChunks = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = pickSpeechTranscript(result);
        if (!transcript) continue;
        if (result.isFinal) {
          finalChunks.push(transcript);
        } else {
          interimChunks.push(transcript);
        }
      }
      if (!target) return;
      let nextBase = target.baseText;
      const finalTrimmed = normalizeSpeechText(finalChunks.join(" "));
      const interimTrimmed = normalizeSpeechText(interimChunks.join(" "));
      if (finalTrimmed) {
        nextBase = mergeSpeechText(nextBase, finalTrimmed);
      }
      target.baseText = nextBase;
      target.interimText = interimTrimmed;
      updateBlock(target.index, target.side, target.blockId, {
        text: mergeSpeechText(nextBase, interimTrimmed),
      });
    };

    rec.onend = () => {
      if (shouldListenRef.current) {
        commitSpeechInterim();
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }, 150);
        return;
      }
      setIsListening(false);
    };

    rec.onerror = (event) => {
      if (shouldListenRef.current && event?.error !== "not-allowed") {
        commitSpeechInterim();
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }, 300);
        return;
      }
      shouldListenRef.current = false;
      setIsListening(false);
      speechTargetRef.current = null;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // ignore
    }
  };

  const armMic = () => {
    if (!isOwner) return;
    stopListening();
    setActiveTool(TOOL_KEYS.MIC);
    setIsMicArmed(true);
    setPendingPlacement(true);
  };

  const disarmMic = () => {
    stopListening();
    setIsMicArmed(false);
    setPendingPlacement(false);
  };

  const handleFontSizeChange = (nextSize) => {
    const size = clamp(nextSize, MIN_TEXT_SIZE, MAX_TEXT_SIZE);
    setFontSize(size);

    const selected = selectedRef.current;
    if (!selected) return;
    const block = getBlockById(selected.index, selected.side, selected.id);
    if (block && block.type === "text") {
      updateBlock(selected.index, selected.side, selected.id, { fontSize: size });
    }
  };

  const handleFontColorChange = (value) => {
    setFontColor(value);
    const selected = selectedRef.current;
    if (!selected) return;
    const block = getBlockById(selected.index, selected.side, selected.id);
    if (block && block.type === "text") {
      updateBlock(selected.index, selected.side, selected.id, { color: value });
    }
  };

  const handleFontFamilyChange = (value) => {
    ensureFontIsLoaded(normalizeFontName(value));
    setFontFamily(value);
    const selected = selectedRef.current;
    if (!selected) return;
    const block = getBlockById(selected.index, selected.side, selected.id);
    if (block && block.type === "text") {
      updateBlock(selected.index, selected.side, selected.id, { font: value });
    }
  };

  const activeStickerId = selectedSticker?.id;
  const selectedItem = selectedBlock
    ? getBlockById(selectedBlock.index, selectedBlock.side, selectedBlock.id)
    : null;
  const isTextSelected = selectedItem?.type === "text";
  const bottomActiveTool = (() => {
    if (isListening) return "mic";
    if (isMicArmed) return "mic";
    if (isTextEditing) return "text";
    if (activeTool === TOOL_KEYS.TEXT) return "text";
    if (selectedItem) return "select";
    if (activeTool === TOOL_KEYS.IMAGE) return "upload";
    return activeTool;
  })();

  const getUserColor = (username) => {
    const existing = collabState.collaborators.find((c) => c.username === username);
    return existing?.color || getColorForUser(username || "");
  };

  const pendingInvites = collabState.invites.filter((invite) => invite.status === "pending");
  const incomingPendingInvites = incomingInvites;
  const collaboratorsSorted = [
    collabState.owner,
    ...collabState.collaborators.filter((collab) => collab.role !== "owner"),
  ];
  const collaboratorCount = collaboratorsSorted.length;
  const nonFriendCollaborators = friendshipBlockers.filter(
    (item, index, array) =>
      item?.user_id &&
      String(item.user_id) !== String(currentUserId) &&
      array.findIndex((x) => String(x?.user_id) === String(item.user_id)) === index
  );

  const handleSendFriendRequestToCollaborator = async (person) => {
    const username = person?.username;
    const receiverId = person?.user_id;
    if (!username && !receiverId) return;
    setInviteBusy(true);
    setInviteError("");
    try {
      await sendFriendRequest({ receiverId, username });
      setInviteMessage(`Friend request sent to ${username || "user"}.`);
      if (entryId) {
        await refreshCollaborators(entryId, collabState.owner?.username || "Owner", {
          currentRole: entryRole,
        });
      }
    } catch (error) {
      setInviteError(error?.message || "Failed to send friend request.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleInviteSubmit = async () => {
    setInviteMessage("");
    if (!isOwner) {
      setInviteError("Only the diary owner can invite collaborators.");
      return;
    }

    const trimmed = inviteName.trim();
    if (!trimmed) {
      setInviteError("Please enter a username.");
      return;
    }

    const normalized = trimmed.toLowerCase();
    const alreadyInvited = collabState.invites.some(
      (invite) => invite.username.toLowerCase() === normalized
    );
    const alreadyCollaborator = collabState.collaborators.some(
      (collab) => collab.username.toLowerCase() === normalized
    );
    if (alreadyInvited || alreadyCollaborator) {
      setInviteError("That username is already invited.");
      return;
    }

    setInviteBusy(true);
    try {
      const targetEntryId = await resolveInviteEntryId();
      if (!targetEntryId) {
        setInviteError("Could not resolve the active diary. Refresh and try again.");
        return;
      }

      let targetUser = friendsDirectory.find(
        (friend) => friend.username?.toLowerCase() === normalized
      );

      if (!targetUser) {
        const searchResult = await searchUsers(trimmed);
        const users = Array.isArray(searchResult?.users) ? searchResult.users : [];
        const exact = users.find(
          (user) =>
            user.username?.toLowerCase() === normalized &&
            (user.is_friend || friendsDirectory.some((friend) => friend.id === user.id))
        );
        if (exact?.id) {
          targetUser = { id: exact.id, username: exact.username };
        }
      }

      if (!targetUser?.id) {
        setInviteError("Username not found in friend list.");
        return;
      }

      await inviteCollaborator(targetEntryId, {
        collaboratorId: targetUser.id,
        role: "editor",
      });

      setInviteName("");
      setInviteError("");
      await refreshCollaborators(targetEntryId, collabState.owner?.username || "Owner", {
        currentRole: entryRole,
      });
    } catch (error) {
      setInviteError(error?.message || "Failed to send invitation.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRemoveInvite = async (invite) => {
    if (!isOwner || !entryId || !invite?.collaboratorId) return;
    setInviteMessage("");
    try {
      await removeCollaborator(entryId, invite.collaboratorId);
      await refreshCollaborators(entryId, collabState.owner?.username || "Owner", {
        currentRole: entryRole,
      });
    } catch (error) {
      setInviteError(error?.message || "Failed to remove invite.");
    }
  };

  const handleRemoveCollaborator = async (collaborator) => {
    if (!entryId || !collaborator?.id) return;
    const isSelfLeave = String(collaborator.id) === String(currentUserId);
    if (!isOwner && !isSelfLeave) return;
    setInviteMessage("");
    try {
      await removeCollaborator(entryId, collaborator.id);
      if (isSelfLeave) {
        setInviteOpen(false);
        navigate(COLLAB_HOME_ROUTE);
        return;
      }
      await refreshCollaborators(entryId, collabState.owner?.username || "Owner", {
        currentRole: entryRole,
      });
    } catch (error) {
      setInviteError(
        error?.message || (isSelfLeave ? "Failed to leave collaboration." : "Failed to remove collaborator.")
      );
    }
  };

  const handleAcceptIncomingInvite = async (invite) => {
    if (!invite?.id) return;
    setInviteMessage("");
    setInviteBusy(true);
    try {
      await acceptCollaborationInvite(invite.id);
      await refreshIncomingInvites();
      const acceptedEntryId = invite.entry_id || invite.entryId;
      if (acceptedEntryId) {
        navigate(`/edit/${acceptedEntryId}?mode=collab`);
        return;
      }
      if (entryId) {
        await refreshCollaborators(entryId, collabState.owner?.username || "Owner", {
          currentRole: entryRole,
        });
      }
    } catch (error) {
      setInviteError(error?.message || "Failed to accept invitation.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleDeclineIncomingInvite = async (inviteId) => {
    if (!inviteId) return;
    setInviteMessage("");
    setInviteBusy(true);
    try {
      await declineCollaborationInvite(inviteId);
      await refreshIncomingInvites();
    } catch (error) {
      setInviteError(error?.message || "Failed to decline invitation.");
    } finally {
      setInviteBusy(false);
    }
  };

  const sendCollabEvent = (payload) => {
    const channel = presenceChannelRef.current;
    if (!channel) return;
    channel.postMessage({
      ...payload,
      userId: currentUserId,
      name: currentUserName,
      color: getUserColor(currentUserName),
    });
  };

  const schedulePresenceBroadcast = (payload) => {
    pendingPresenceRef.current = payload;
    if (presenceThrottleRef.current) return;
    presenceThrottleRef.current = setTimeout(() => {
      if (pendingPresenceRef.current) {
        sendCollabEvent({ type: "presence", ...pendingPresenceRef.current });
        pendingPresenceRef.current = null;
      }
      presenceThrottleRef.current = null;
    }, 120);
  };

  const clearLocalPresence = (textId) => {
    const id = textId || lastPresenceTextIdRef.current;
    if (!id) return;
    sendCollabEvent({ type: "presence", textId: id, isActive: false });
    if (entryDiaryType === DIARY_TYPE_COLLABORATIVE && entryId) {
      const socket = realtimeSocketRef.current;
      if (socket?.connected) {
        socket.emit(COLLAB_WS_EVENTS.ENTRY_CURSOR_CLEAR, { entryId: String(entryId) });
      }
    }
    lastPresenceTextIdRef.current = null;
  };

  const handleCursorPresence = ({ id, cursorIndex, selectionStart, selectionEnd }) => {
    if (!id) return;
    if (lastPresenceTextIdRef.current && lastPresenceTextIdRef.current !== id) {
      clearLocalPresence(lastPresenceTextIdRef.current);
    }
    lastPresenceTextIdRef.current = id;
    schedulePresenceBroadcast({
      textId: id,
      cursorIndex,
      selectionStart,
      selectionEnd,
      isActive: true,
      lastSeenTs: Date.now(),
    });

    if (entryDiaryType === DIARY_TYPE_COLLABORATIVE && entryId) {
      const socket = realtimeSocketRef.current;
      if (socket?.connected) {
        socket.emit(COLLAB_WS_EVENTS.ENTRY_CURSOR_MOVE, {
          entryId: String(entryId),
          position: {
            textId: id,
            cursorIndex,
            selectionStart,
            selectionEnd,
            name: currentUserName,
            color: getUserColor(currentUserName),
            lastSeenTs: Date.now(),
          },
          timestamp: Date.now(),
        });
      }
    }
  };

  useEffect(() => {
    if (!isTextEditing) {
      clearLocalPresence();
    }
  }, [isTextEditing]);

  useEffect(() => {
    return () => {
      clearLocalPresence();
    };
  }, []);

  const renderToolbar = () => {
    const panelClass =
      "flex items-center gap-1.5 sm:gap-2 bg-[#FFFAE8] px-2 sm:px-3 py-1.5 sm:py-2 rounded-[10px] border border-[#4A3C3A] shadow-[0_3px_0_rgba(197,193,176,0.6)]";
    const panelLabel = "text-[10px] sm:text-xs font-semibold text-[#4A3C3A]";
    const smallButton =
      "h-6 w-6 sm:h-7 sm:w-7 rounded-[8px] bg-gradient-to-b from-[#F4E4A8] to-[#E8D58F] text-[#402f2d] text-xs sm:text-sm border border-[#c9b675] shadow-[0_2px_0_rgba(197,193,176,0.6)] transition-transform hover:scale-105";

    const currentFontName = normalizeFontName(fontFamily) || FONT_OPTIONS[0];
    const currentFont =
      FONT_OPTIONS.find((option) => option === currentFontName) || FONT_OPTIONS[0];

    return (
      <>
        <div className="w-full rounded-[12px] sm:rounded-[14px] bg-[#493B3A] border border-[#4A3C3A] px-2 sm:px-4 md:px-6 py-2 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <img
            src="/assets/mainLogo.png"
            alt="Logo"
            className="h-6 sm:h-8 md:h-10 w-auto object-contain"
          />

          <div className="order-3 sm:order-none basis-full sm:basis-auto flex-1 min-w-0 flex justify-center">
            {isTextSelected && (
              <div className="flex flex-wrap md:flex-nowrap gap-1.5 sm:gap-2 items-center justify-center">
                <div className={panelClass}>
                  <span className={panelLabel}>Font</span>
                  <div className="font-dropdown" ref={fontMenuRef}>
                    <button
                      type="button"
                      className="font-dropdown-button"
                      onClick={() => setShowFontDropdown((prev) => !prev)}
                      style={{ fontFamily: `"${currentFont}"` }}
                    >
                      {currentFont}
                    </button>
                    {showFontDropdown && (
                      <div className="font-dropdown-list">
                        {FONT_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`font-dropdown-item ${
                              normalizeFontName(fontFamily) === option ? "selected" : ""
                            }`}
                            style={{ fontFamily: `"${option}"` }}
                            onClick={() => {
                              handleFontFamilyChange(`"${option}"`);
                              setShowFontDropdown(false);
                            }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className={panelClass}>
                  <span className={panelLabel}>Size</span>
                  <button
                    className={smallButton}
                    onClick={() => handleFontSizeChange(fontSize - 2)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={MIN_TEXT_SIZE}
                    max={MAX_TEXT_SIZE}
                    value={fontSize}
                    onChange={(event) =>
                      handleFontSizeChange(parseInt(event.target.value || "0", 10))
                    }
                    className="w-12 sm:w-14 bg-[#FFFAE8] text-[#4A3C3A] text-xs sm:text-sm rounded-[8px] px-1.5 sm:px-2 py-1 text-center border border-[#4A3C3A] focus:outline-none focus:ring-2 focus:ring-[#F4E4A8] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  />
                  <button
                    className={smallButton}
                    onClick={() => handleFontSizeChange(fontSize + 2)}
                  >
                    +
                  </button>
                </div>
                <div className={panelClass}>
                  <span className={panelLabel}>Color</span>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(event) => handleFontColorChange(event.target.value)}
                    className="color-preview"
                  />
                </div>
              </div>
            )}
          </div>

          {canUseCollaborationUi && (
            <div className="relative" ref={inviteMenuRef}>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="h-[34px] sm:h-[40px] md:h-[46px] px-3 sm:px-5 md:px-7 rounded-[8px] bg-gradient-to-b from-[#F4E4A8] to-[#E8D58F] text-[#402f2d] text-xs sm:text-sm md:text-base font-semibold border border-[#c9b675] shadow-[0_2px_0_rgba(197,193,176,0.6)] transition-transform hover:scale-[1.03] active:translate-y-[1px]"
              >
                {isOwner ? "Invite" : "Collaborators"}
              </button>
            </div>
          )}
        </div>

        {canUseCollaborationUi && inviteOpen && (
          <div
            className="invite-modal-backdrop"
            onClick={() => setInviteOpen(false)}
          >
            <div
              className="invite-modal"
              ref={inviteMenuRef}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="invite-modal-header">
                <div>
                  <h3 className="invite-modal-title">Invite Collaborators</h3>
                  <p className="invite-modal-subtitle">
                    Share your book with friends
                  </p>
                </div>
                <button
                  type="button"
                  className="invite-modal-close"
                  onClick={() => setInviteOpen(false)}
                >
                  ✕
                </button>
              </div>

              {isOwner && (
                <div className="invite-input-row">
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(event) => {
                      setInviteName(event.target.value);
                      setInviteError("");
                      setInviteMessage("");
                    }}
                    className="invite-input"
                    placeholder="Enter your friend’s username"
                  />
                  <button
                    type="button"
                    className="invite-action invite-primary"
                    onClick={handleInviteSubmit}
                    disabled={inviteBusy}
                  >
                    {inviteBusy ? "Inviting..." : "Invite"}
                  </button>
                </div>
              )}
              {inviteError && <span className="invite-error">{inviteError}</span>}
              {inviteMessage && <span className="invite-empty">{inviteMessage}</span>}

              <div className="invite-section">
                <span className="invite-section-title">Incoming invites</span>
                {incomingPendingInvites.length ? (
                  <ul className="invite-list">
                    {incomingPendingInvites.map((invite) => (
                      <li key={invite.id} className="invite-card">
                        <span className="invite-avatar muted">
                          {(invite.inviter_username || "U").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="invite-card-info">
                          <span className="invite-username">
                            {invite.entry_title || "Diary entry"}
                          </span>
                          <span className="invite-subtext">
                            From {invite.inviter_username || "Unknown"}
                          </span>
                        </div>
                        <div className="invite-actions">
                          <button
                            type="button"
                            className="invite-accept"
                            onClick={() => handleAcceptIncomingInvite(invite)}
                            disabled={inviteBusy}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="invite-remove"
                            onClick={() => handleDeclineIncomingInvite(invite.id)}
                            disabled={inviteBusy}
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="invite-empty">No incoming invites</span>
                )}
              </div>

              <div className="invite-section">
                <span className="invite-section-title">Pending invites</span>
                {pendingInvites.length ? (
                  <ul className="invite-list">
                    {pendingInvites.map((invite) => (
                      <li key={invite.id || invite.username} className="invite-card">
                        <span className="invite-avatar muted">
                          {invite.username.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="invite-card-info">
                          <span className="invite-username">{invite.username}</span>
                          <span className="invite-subtext">Pending</span>
                        </div>
                        <div className="invite-actions">
                          <button
                            type="button"
                            className="invite-remove"
                            onClick={() => handleRemoveInvite(invite)}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="invite-empty">No pending invites</span>
                )}
              </div>

              <div className="invite-section">
                <span className="invite-section-title">
                  Collaborators ({collaboratorCount})
                </span>
                <ul className="invite-list">
                  {collaboratorsSorted.map((collab) => (
                    <li key={collab.username} className="invite-card">
                      <span className="invite-avatar" style={{ background: collab.color }}>
                        {collab.username.slice(0, 1).toUpperCase()}
                      </span>
                        <div className="invite-card-info">
                          <div className="invite-name-row">
                            <span className="invite-username">{collab.username}</span>
                          {collab.role === "owner" && (
                            <span className="invite-role-badge">Owner</span>
                          )}
                          </div>
                        <span className="invite-subtext">
                          {collab.role === "owner" ? "Full Access" : "Can edit"}
                        </span>
                      </div>
                      {collab.role !== "owner" &&
                        (isOwner || String(collab.id) === String(currentUserId)) && (
                        <button
                          type="button"
                          className="invite-remove"
                          onClick={() => handleRemoveCollaborator(collab)}
                        >
                          {String(collab.id) === String(currentUserId) ? "Leave" : "Remove"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {nonFriendCollaborators.length > 0 && (
                <div className="invite-section">
                  <span className="invite-section-title">Friendship required to collaborate</span>
                  <span className="invite-empty">
                    You need to be friends with these collaborators before editing is enabled.
                  </span>
                  <ul className="invite-list">
                    {nonFriendCollaborators.map((person) => (
                      <li key={String(person.user_id)} className="invite-card">
                        <span className="invite-avatar muted">
                          {(person.username || "U").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="invite-card-info">
                          <span className="invite-username">{person.username || "Unknown user"}</span>
                          <span className="invite-subtext">Not your friend yet</span>
                        </div>
                        <div className="invite-actions">
                          <button
                            type="button"
                            className="invite-accept"
                            onClick={() => handleSendFriendRequestToCollaborator(person)}
                            disabled={inviteBusy}
                          >
                            Request friend
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="invite-note-card">
                Collaborators can view and edit content, but cannot use microphone or
                manage pages.
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const handleBottomToolClick = (tool, mode) => {
    if (!canEditEntry && tool !== "select") {
      return;
    }
    if (tool === "mic" && !isOwner) {
      return;
    }
    if (tool !== "mic") {
      disarmMic();
    }
    if (tool === "select") {
      setActiveTool(TOOL_KEYS.SELECT);
      setStickerOpen(false);
      setPendingPlacement(false);
      return;
    }
    if (tool === "text") {
      setActiveTool(TOOL_KEYS.TEXT);
      setStickerOpen(false);
      setPendingPlacement(true);
      return;
    }
    if (tool === "mic") {
      setStickerOpen(false);
      armMic();
      return;
    }
    if (tool === "upload") {
      setStickerOpen(false);
      setUploadMode(mode === "portrait" ? "portrait" : "normal");
      setActiveTool(TOOL_KEYS.IMAGE);
      setPendingPlacement(true);
      uploadInputRef.current?.click();
      return;
    }
    if (tool === "sticker") {
      setActiveTool(TOOL_KEYS.STICKER);
      setPendingPlacement(true);
      setStickerOpen((prev) => !prev);
      return;
    }
  };

  const stickerCategories = ["All", "Paper", "Vintage", "Flowers", "G Style", "Duck", "Pumpkin", "Letters"];
  const filteredStickers =
    stickerFilter === "All"
      ? STICKERS
      : STICKERS.filter((sticker) => sticker.category === stickerFilter);
  const visiblePageIndexes = useMemo(() => {
    const start = Math.max(0, current - PAGE_RENDER_RADIUS);
    const end = Math.min(pages.length - 1, current + PAGE_RENDER_RADIUS);
    const next = [];
    for (let i = start; i <= end; i += 1) {
      next.push(i);
    }
    return next;
  }, [current, pages.length]);

  const stickerPopover = stickerOpen ? (
    <div
      ref={stickerMenuRef}
      className="sticker-popover"
    >
      <div className="sticker-popover-frame" aria-hidden="true">
        <svg className="sticker-popover-svg" viewBox="0 0 420 560" preserveAspectRatio="none">
          <rect
            x="6"
            y="6"
            width="408"
            height="548"
            rx="18"
            ry="18"
            fill="#FFFAE8"
            stroke="#C5C1B0"
            strokeWidth="2.5"
          />
        </svg>
      </div>
      <div className="sticker-popover-content">
        <div className="sticker-popover-header">
          <div>
            <h3 className="sticker-popover-title">Choose a Sticker</h3>
            <p className="sticker-popover-subtitle">Click to add to your canvas</p>
          </div>
          <button
            type="button"
            className="sticker-popover-close"
            onClick={() => setStickerOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="sticker-popover-filters">
          {stickerCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={`sticker-filter-chip ${
                stickerFilter === category ? "sticker-filter-chip-active" : ""
              }`}
              onClick={() => setStickerFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="sticker-popover-body">
          <div className="sticker-popover-grid">
            {filteredStickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => {
                  handleStickerSelect(sticker);
                  setStickerOpen(false);
                }}
                className={`sticker-popover-item ${
                  activeTool === TOOL_KEYS.STICKER && activeStickerId === sticker.id
                    ? "sticker-popover-item-active"
                    : ""
                }`}
              >
                <img
                  src={sticker.src}
                  alt={sticker.label}
                  className="sticker-popover-image"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full max-w-6xl flex flex-col items-center gap-4">
      <div className="relative">
        <div className={`book ${isOpen ? "open" : ""} ${isFlipping ? "flipping" : ""}`}>
          {isOpen && current > 0 && !zoomMode && (
            <div className="left-overlay" aria-hidden="true">
              <div className="page-editor">
                {renderPreviewBlocks(pages[current - 1]?.backBlocks)}
              </div>
            </div>
          )}
          {isOpen && !zoomMode && (
            <>
              <div
                className="spread-hit left"
                onClick={() => {
                  if (current > 0) {
                    openEditMode(current - 1, "back");
                  }
                }}
              />
              <div
                className="spread-hit right"
                onClick={() => openEditMode(current, "front")}
              />
            </>
          )}
          <div className="cover">
            <div className="cover-content">
              <span className="cover-title">Diary</span>
              <span className="cover-subtitle">Book</span>
            </div>
          </div>
          <div className="back-cover" />
          {isOpen && current > 0 && (
            <button className="nav prev book-nav" onClick={flipPrev} aria-label="Previous page">
              ‹
            </button>
          )}
          {isOpen && current < pages.length - 1 && (
            <button className="nav next book-nav" onClick={flipNext} aria-label="Next page">
              ›
            </button>
          )}

          {visiblePageIndexes.map((index) => {
            const page = pages[index];
            if (!page) return null;
            const shouldRenderBlocks = Math.abs(index - current) <= 2;
            return (
              <Page
                key={index}
                index={index}
                totalPages={pages.length}
                current={current}
                frontBlocks={shouldRenderBlocks ? page.frontBlocks : EMPTY_BLOCKS}
                backBlocks={shouldRenderBlocks ? page.backBlocks : EMPTY_BLOCKS}
                pageBounds={pageBounds}
                isOpen={isOpen}
                onPageClick={handlePageClick}
                isDeleting={isDeletingPage && deletingIndex === index}
              />
            );
          })}
        </div>
      </div>

      {zoomMode && (() => {
        const blocks = getBlocksForSide(active.index, active.side);
        const content = blocks
          .map((block) => {
            if (block.type === "text") {
              return {
                id: block.id,
                type: "text",
                x: block.x,
                y: block.y,
                width: block.w,
                height: block.h,
                text: block.text || "",
                segments: block.segments || [],
                fontFamily: block.font || fontFamily,
                color: block.color || fontColor,
                fontSize: block.fontSize || DEFAULT_TEXT_SIZE,
              };
            }
            if (block.type === "sticker") {
              const matchedSticker = STICKERS.find((sticker) => sticker.src === block.src);
              return {
                id: block.id,
                type: "sticker",
                x: block.x,
                y: block.y,
                width: block.w,
                height: block.h,
                stickerId: matchedSticker?.id || "custom",
                src: block.src,
              };
            }
            if (block.type === "image") {
              return {
                id: block.id,
                type: "image",
                x: block.x,
                y: block.y,
                width: block.w,
                height: block.h,
                src: block.src,
              };
            }
            if (block.type === "framedImage") {
              return {
                id: block.id,
                type: "framedImage",
                x: block.x,
                y: block.y,
                width: block.w,
                height: block.h,
                imageSrc: block.imageSrc || block.src,
                frameSrc: block.frameSrc || PORTRAIT_FRAME_SRC,
                frameInset: PORTRAIT_FRAME_INSET,
              };
            }
            return null;
          })
          .filter(Boolean);

        return (
          <ZoomEditMode
            pageIndex={active.index}
            side={active.side}
            content={content}
            onContentUpdate={(newContent) => {
              const newBlocks = newContent
                .map((item) => {
                  if (item.type === "text") {
                    return {
                      id: item.id,
                      type: "text",
                      x: item.x,
                      y: item.y,
                      w: item.width,
                      h: item.height,
                      text: item.text,
                      segments: item.segments,
                      font: item.fontFamily,
                      color: item.color,
                      fontSize: item.fontSize,
                    };
                  }
                  if (item.type === "sticker") {
                    const fallbackSrc =
                      STICKERS.find((sticker) => sticker.id === item.stickerId)?.src ||
                      STICKERS[0].src;
                    return {
                      id: item.id,
                      type: "sticker",
                      x: item.x,
                      y: item.y,
                      w: item.width,
                      h: item.height,
                      src: item.src || fallbackSrc,
                    };
                  }
                  if (item.type === "image") {
                    return {
                      id: item.id,
                      type: "image",
                      x: item.x,
                      y: item.y,
                      w: item.width,
                      h: item.height,
                      src: item.src,
                    };
                  }
                  if (item.type === "framedImage") {
                    return {
                      id: item.id,
                      type: "framedImage",
                      x: item.x,
                      y: item.y,
                      w: item.width,
                      h: item.height,
                      imageSrc: item.imageSrc || item.src,
                      frameSrc: item.frameSrc || PORTRAIT_FRAME_SRC,
                      frameInset: PORTRAIT_FRAME_INSET,
                    };
                  }
                  return null;
                })
                .filter(Boolean);
              setBlocksForSide(active.index, active.side, newBlocks, { broadcast: true });
            }}
            selectedId={selectedBlock?.id || null}
            onSelect={(id) => {
              if (!id) {
                setSelectedBlock(null);
                setActiveTool(null);
                setStickerOpen(false);
                setIsTextEditing(false);
                setActiveTextId(null);
                if (!isMicArmed) {
                  setPendingPlacement(false);
                }
                return;
              }
              setSelectedBlock({ index: active.index, side: active.side, id });
              const selected = getBlockById(active.index, active.side, id);
              setActiveTextId(selected && selected.type === "text" ? id : null);
              setActiveTool(TOOL_KEYS.SELECT);
              if (!isMicArmed) {
                setPendingPlacement(false);
              }
            }}
            fontFamily={fontFamily}
            color={fontColor}
            fontSize={fontSize}
            onClose={closeEditMode}
    pageBounds={pageBounds}
            mode={activeTool === TOOL_KEYS.MIC ? TOOL_KEYS.TEXT : activeTool}
            onAddItem={(type, data) => {
              const { index, side } = activeRef.current;
              if (type === "text") {
                const existingBlocks = getPageBlocks(index, side);
                const shouldLarge = isMicArmed && existingBlocks.length === 0;
                const block = createTextBlock({
                  x: shouldLarge ? 16 : data.x,
                  y: shouldLarge ? 16 : data.y,
                  font: fontFamily,
                  color: fontColor,
                  fontSize,
                  width: shouldLarge ? pageBounds.width - 32 : undefined,
                  height: shouldLarge ? pageBounds.height - 32 : undefined,
                });
                addBlock(index, side, block);
                setSelectedBlock({ index, side, id: block.id });
                setActiveTextId(block.id);
                if (isMicArmed) {
                  setSpeechTargetFromBlock(index, side, block);
                } else {
                  setPendingPlacement(false);
                  setActiveTool(TOOL_KEYS.SELECT);
                }
                return;
              }
              if (type === "sticker") {
                if (!selectedSticker) return;
                const block = createStickerBlock({
                  x: data.x,
                  y: data.y,
                  src: selectedSticker.src,
                });
                addBlock(index, side, block);
                setSelectedBlock({ index, side, id: block.id });
                setPendingPlacement(false);
                setActiveTool(TOOL_KEYS.SELECT);
                return;
              }
              if (type === "image") {
                if (!pendingImage && !pendingFrameImage) return;
                const block = pendingFrameImage
                  ? createFramedImageBlock({
                      x: data.x,
                      y: data.y,
                      imageSrc: pendingFrameImage.imageSrc,
                      frameSrc: pendingFrameImage.frameSrc,
                      frameInset: pendingFrameImage.frameInset,
                    })
                  : createImageBlock({
                      x: data.x,
                      y: data.y,
                      src: pendingImage,
                    });
                addBlock(index, side, block);
                setSelectedBlock({ index, side, id: block.id });
                setPendingImage(null);
                setPendingFrameImage(null);
                setPendingPlacement(false);
                setActiveTool(TOOL_KEYS.SELECT);
              }
            }}
            onTextEditStart={(id) => {
              setIsTextEditing(true);
              if (id) {
                setActiveTextId(id);
              }
              if (isMicArmed && id) {
                startListening(id);
              }
            }}
            onTextEditEnd={() => {
              setIsTextEditing(false);
              if (isListening) {
                stopListening();
              }
            }}
            currentUser={{
              ...(currentUser || {}),
              ...sessionUser,
              role: isOwner ? "owner" : entryRole,
            }}
            getUserColor={getUserColor}
            remotePresence={remotePresence}
            currentUserId={currentUserId}
            onCursorChange={handleCursorPresence}
            toolbar={renderToolbar()}
            bottomToolProps={{
              activeTool: bottomActiveTool,
              isListening,
              isMicDisabled: !isOwner,
              onToolClick: handleBottomToolClick,
            }}
            stickerPopover={stickerPopover}
            uploadInputRef={uploadInputRef}
            onUploadChange={handleImageUpload}
          />
        );
      })()}
    </div>
  );
}
