// ---------- FIREBASE ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLRu0tXWSyHlB7F0MfHzitBpuUYUQyMdI",
  authDomain: "gradbridge-5e613.firebaseapp.com",
  projectId: "gradbridge-5e613",
  storageBucket: "gradbridge-5e613.appspot.com",
  messagingSenderId: "986933006410",
  appId: "1:986933006410:web:d02848c34a2f4e2038d6b3"
};
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// ---------- THEME ----------
const toggleBtn = document.getElementById("themeToggle");
const html = document.documentElement;
const saved = localStorage.getItem("theme");
if (saved === "dark") html.setAttribute("data-theme", "dark");
toggleBtn.addEventListener("click", () => {
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  localStorage.setItem("theme", isDark ? "light" : "dark");
});

// ---------- TIMELINE ----------
fetch("data/timeline.json")
  .then(r => r.json())
  .then(list => {
    const ul = document.getElementById("timelineList");
    list.forEach(({ event, date }) => {
      const li = document.createElement("li");
      const daysLeft = Math.ceil((new Date(date) - new Date()) / 86400000);
      li.textContent = `${event} — ${date} (${daysLeft} day${daysLeft !== 1 ? "s" : ""} left)`;
      ul.appendChild(li);
    });
  });

// ---------- REQUIREMENTS ----------
const reqSelect = document.getElementById("reqSelect");
const reqDetails = document.getElementById("reqDetails");
let reqData = [];
fetch("data/requirements.json")
  .then(r => r.json())
  .then(data => {
    reqData = data;
    data.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.country;
      opt.textContent = r.country;
      reqSelect.appendChild(opt);
    });
    reqSelect.dispatchEvent(new Event("change"));
  });
reqSelect.addEventListener("change", () => {
  const sel = reqData.find(r => r.country === reqSelect.value);
  if (!sel) return (reqDetails.innerHTML = "");
  reqDetails.innerHTML = `
    <h4>${sel.country} – ${sel.courseLevel}</h4>
    <p>Min IELTS: ${sel.minIELTS}</p>
    <p>Min TOEFL: ${sel.minTOEFL || "N/A"}</p>
    <p>Tuition: $${sel.tuitionUSD[0]} – $${sel.tuitionUSD[1]}</p>
    <p>Living: $${sel.livingUSD[0]} – $${sel.livingUSD[1]}</p>
    <strong>Required docs:</strong>
    <ul>${sel.docs.map(d => `<li>${d}</li>`).join("")}</ul>
  `;
});

// ---------- BUDGET CALCULATOR ----------
const budgetCountry = document.getElementById("budgetCountry");
const budgetLevel = document.getElementById("budgetLevel");
const budgetYears = document.getElementById("budgetYears");
const calcBtn = document.getElementById("calcBtn");
const budgetResult = document.getElementById("budgetResult");

reqData.forEach(r => {
  const opt = document.createElement("option");
  opt.value = r.country;
  opt.textContent = r.country;
  budgetCountry.appendChild(opt);
});

calcBtn.addEventListener("click", () => {
  const country = budgetCountry.value;
  const level = budgetLevel.value;
  const years = +budgetYears.value;
  const match = reqData.find(r => r.country === country && r.courseLevel === level);
  if (!match) return (budgetResult.textContent = "Select a country first.");
  const tuition = (match.tuitionUSD[0] + match.tuitionUSD[1]) / 2;
  const living = (match.livingUSD[0] + match.livingUSD[1]) / 2;
  const totalUSD = Math.round((tuition + living) * years);
  budgetResult.textContent = `Estimated total ≈ $${totalUSD} for ${years} year${years !== 1 ? "s" : ""}`;
});

// ---------- DOCUMENT VAULT ----------
const uploadBtn = document.getElementById("uploadBtn");
const docInput = document.getElementById("docInput");
const docTable = document.querySelector("#docTable tbody");

uploadBtn.onclick = async () => {
  if (!docInput.files.length) return alert("Pick files first!");
  [...docInput.files].forEach(file => {
    const storageRef = ref(storage, `docs/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed", null, console.error, refreshDocs);
  });
  docInput.value = "";
};

async function refreshDocs() {
  docTable.innerHTML = "";
  const res = await listAll(ref(storage, "docs"));
  res.items.forEach(async itemRef => {
    const url = await getDownloadURL(itemRef);
    const meta = await itemRef.getMetadata();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="${url}" target="_blank">${itemRef.name}</a></td>
      <td>${(meta.size / 1024).toFixed(1)} KB</td>
      <td><button class="del" data-path="${itemRef.fullPath}">Delete</button></td>
    `;
    docTable.appendChild(tr);
  });
}
docTable.addEventListener("click", async e => {
  if (e.target.classList.contains("del")) {
    await deleteObject(ref(storage, e.target.dataset.path));
    refreshDocs();
  }
});
refreshDocs();

// ---------- GEMINI CHAT ----------
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

const GEMINI_KEY = "AIzaSyCI-Z_PHF9GERWjr6oS_h7BgTGoN5Ia4js";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`;

sendBtn.onclick = async () => {
  const msg = chatInput.value.trim();
  if (!msg) return;
  appendChat("You", msg);
  chatInput.value = "";
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Visa interview question: ${msg}` }] }]
    })
  });
  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
  appendChat("GradBot", reply);
};

function appendChat(sender, text) {
  const div = document.createElement("div");
  div.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ---------- EMAILJS CONTACT ----------
import emailjs from "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
emailjs.init("C98ueRTfd5dM_QNOLh_WV");

document.getElementById("contactForm").addEventListener("submit", e => {
  e.preventDefault();
  emailjs.sendForm("SExDFt6JXd7pAIzM5", "template_qrhuj0c", e.target).then(
    () => alert("Message sent!"),
    err => alert("Failed: " + JSON.stringify(err))
  );
  e.target.reset();
});

// ---------- FLOATING CHAT ----------
document.getElementById("floatBtn").onclick = () => {
  document.getElementById("chat").scrollIntoView({ behavior: "smooth" });
};
