import { api } from "./api.js";
import { escapeHtml, eventCard } from "./components.js";

const app = document.querySelector("#app");
const dialog = document.querySelector("#registration-dialog");
const form = document.querySelector("#registration-form");
const alertBox = document.querySelector("#form-alert");
const toast = document.querySelector("#toast");
const studentStorageKey = "campus-calendar-student-id";
let currentEventId = null;
let toastTimer;

function currentStudentId() {
  return localStorage.getItem(studentStorageKey) || "";
}

function updateHeader() {
  const studentId = currentStudentId();
  document.querySelector("#header-student").innerHTML = studentId
    ? `Signed in as <strong>${escapeHtml(studentId)}</strong>`
    : "Student event portal";
  const route = location.hash.startsWith("#my-events") ? "my-events" : "events";
  document.querySelectorAll("[data-nav]").forEach((link) => link.classList.toggle("is-active", link.dataset.nav === route));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function setAlert(message, success = false) {
  alertBox.textContent = message;
  alertBox.hidden = !message;
  alertBox.classList.toggle("is-success", success);
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

async function renderDashboard() {
  app.innerHTML = `
    <div class="page-shell">
      <section class="hero">
        <div class="hero-copy"><p class="eyebrow">YOUR CAMPUS, IN MOTION</p><h1>Make room for<br>something memorable.</h1><p>Find your people, try something new, and make this semester count. Your next campus moment starts here.</p></div>
        <div class="hero-stat"><strong id="event-count">...</strong><span>upcoming events</span></div>
      </section>
      <section aria-labelledby="events-title">
        <div class="toolbar">
          <div><h2 class="section-title" id="events-title">Coming up on campus</h2><p class="results-count" id="results-count">Browse and find your next event</p></div>
          <div class="filters">
            <label class="search-wrap"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input class="search-input" id="event-search" type="search" placeholder="Search events" aria-label="Search events"></label>
            <select class="filter-select" id="category-filter" aria-label="Filter by category"><option value="all">All categories</option></select>
          </div>
        </div>
        <div class="event-grid" id="event-grid" aria-live="polite"></div>
      </section>
    </div>`;

  const events = await api.getEvents();
  document.querySelector("#event-count").textContent = events.length;
  const filter = document.querySelector("#category-filter");
  [...new Set(events.map((event) => event.category))].sort().forEach((category) => {
    filter.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`);
  });
  const search = document.querySelector("#event-search");
  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const category = filter.value;
    const filtered = events.filter((event) => {
      const matchesTerm = [event.name, event.venue, event.description, event.category].some((value) => value.toLowerCase().includes(term));
      return matchesTerm && (category === "all" || event.category === category);
    });
    document.querySelector("#results-count").textContent = `${filtered.length} ${filtered.length === 1 ? "event" : "events"} to explore`;
    document.querySelector("#event-grid").innerHTML = filtered.length
      ? filtered.map(eventCard).join("")
      : `<div class="empty-state">No events match that search. Try another name or category.</div>`;
  };
  search.addEventListener("input", draw);
  filter.addEventListener("change", draw);
  draw();
}

async function renderEventDetails(eventId) {
  app.innerHTML = `<div class="page-shell"><div class="loading-state">Loading event details...</div></div>`;
  const event = await api.getEvent(eventId, currentStudentId());
  const full = event.availableSeats < 1;
  const completed = new Date(`${event.date}T23:59:59`) < new Date();
  const registration = event.registration;
  const badge = registration
    ? `<span class="status-badge">${escapeHtml(registration.status)}</span>`
    : `<span class="status-badge ${full ? "is-full" : ""}">${completed ? "Completed" : full ? "Full" : "Open"}</span>`;
  app.innerHTML = `
    <div class="page-shell">
      <div class="detail-top"><a class="back-link" href="#events">&#8592; All events</a><span>/</span><span>${escapeHtml(event.category)}</span></div>
      <div class="detail-layout">
        <article class="detail-main">
          <img class="detail-image" src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.name)}">
          <div class="detail-body"><div class="detail-title-row"><h1 class="detail-title">${escapeHtml(event.name)}</h1>${badge}</div><p class="detail-description">${escapeHtml(event.description)}</p></div>
        </article>
        <aside class="detail-aside"><h2 class="aside-title">Event details</h2>
          <div class="detail-fact"><span class="fact-icon">&#9635;</span><div><span class="fact-label">DATE</span><span class="fact-value">${formatDate(event.date)}</span></div></div>
          <div class="detail-fact"><span class="fact-icon">&#9719;</span><div><span class="fact-label">TIME</span><span class="fact-value">${escapeHtml(event.time)}</span></div></div>
          <div class="detail-fact"><span class="fact-icon">&#9673;</span><div><span class="fact-label">VENUE</span><span class="fact-value">${escapeHtml(event.venue)}</span></div></div>
          <div class="detail-fact"><span class="fact-icon">&#8599;</span><div><span class="fact-label">AVAILABLE SEATS</span><span class="fact-value">${event.availableSeats} of ${event.capacity}</span></div></div>
          ${registration ? `<p class="registered-note">Registration ID: <strong>${escapeHtml(registration.registrationId)}</strong></p>` : ""}
          <button class="button button-primary" id="register-button" ${registration || full || completed ? "disabled" : ""}>${registration ? "Already registered" : full ? "Event is full" : completed ? "Event completed" : "Register now"}<span aria-hidden="true">&#8594;</span></button>
        </aside>
      </div>
    </div>`;
  currentEventId = event.id;
  document.querySelector("#register-button").addEventListener("click", () => openRegistration(event));
}

function openRegistration(event) {
  currentEventId = event.id;
  document.querySelector("#dialog-event-name").textContent = event.name;
  setAlert("");
  form.reset();
  if (currentStudentId()) form.elements.studentId.value = currentStudentId();
  dialog.showModal();
}

async function renderMyEvents(studentId = currentStudentId()) {
  app.innerHTML = `
    <div class="page-shell">
      <header class="page-heading"><p class="eyebrow">YOUR CAMPUS PLANS</p><h1>My events</h1><p>Your registrations, all in one place. You can cancel a registration up until the event.</p></header>
      <form class="lookup-bar" id="student-lookup"><label class="visually-hidden" for="lookup-id">Student ID</label><input class="lookup-input" id="lookup-id" name="studentId" required placeholder="Enter your student ID" value="${escapeHtml(studentId)}"><button class="button button-primary" type="submit">Find registrations</button></form>
      <div id="registered-events"></div>
    </div>`;
  document.querySelector("#student-lookup").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = new FormData(event.currentTarget).get("studentId").trim();
    if (!id) return;
    localStorage.setItem(studentStorageKey, id);
    updateHeader();
    await loadStudentEvents(id);
  });
  if (studentId) await loadStudentEvents(studentId);
}

async function loadStudentEvents(studentId) {
  const container = document.querySelector("#registered-events");
  container.innerHTML = `<div class="loading-state">Finding your registrations...</div>`;
  try {
    const registrations = await api.getStudentEvents(studentId);
    if (!registrations.length) {
      container.innerHTML = `<div class="empty-state">No registrations found for this student ID yet.</div>`;
      return;
    }
    const rows = registrations.map((registration) => {
      const statusClass = registration.status.toLowerCase();
      const date = new Date(`${registration.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const action = registration.status === "Registered"
        ? `<button class="cancel-button" data-cancel="${escapeHtml(registration.registrationId)}">Cancel</button>`
        : "";
      return `<div class="registered-row"><div><div class="registered-event">${escapeHtml(registration.eventName)}</div><div class="registered-meta">${escapeHtml(registration.time)}</div></div><div>${date}</div><div>${escapeHtml(registration.venue)}</div><div><span class="registration-code">${escapeHtml(registration.registrationId)}</span></div><div><span class="status-text ${statusClass}">${escapeHtml(registration.status)}</span></div><div class="cancel-cell">${action}</div></div>`;
    }).join("");
    container.innerHTML = `<div class="table-head"><span>Event</span><span>Date</span><span>Venue</span><span>Registration ID</span><span>Status</span><span></span></div><div class="registered-list">${rows}</div>`;
    container.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm("Cancel this event registration?")) return;
      try {
        await api.cancelRegistration(button.dataset.cancel, studentId);
        showToast("Registration cancelled.");
        await loadStudentEvents(studentId);
      } catch (error) {
        showToast(error.message);
      }
    }));
  } catch (error) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function renderRoute() {
  updateHeader();
  try {
    if (location.hash.startsWith("#event/")) {
      const eventId = Number(location.hash.slice("#event/".length));
      if (!Number.isInteger(eventId) || eventId < 1) throw new Error("Event not found.");
      await renderEventDetails(eventId);
    } else if (location.hash.startsWith("#my-events")) {
      await renderMyEvents();
    } else {
      await renderDashboard();
    }
  } catch (error) {
    app.innerHTML = `<div class="page-shell"><div class="empty-state">${escapeHtml(error.message)} <a class="back-link" href="#events">Back to events</a></div></div>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAlert("");
  const student = Object.fromEntries(new FormData(form).entries());
  student.name = student.name.trim();
  student.studentId = student.studentId.trim();
  student.email = student.email.trim();
  student.phone = student.phone.trim();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email);
  const phoneDigits = student.phone.replace(/\D/g, "").length;
  if (Object.values(student).some((value) => !String(value).trim())) return setAlert("Please complete all required fields.");
  if (!emailIsValid) return setAlert("Enter a valid email address.");
  if (!/^\+?[\d\s().-]{7,20}$/.test(student.phone) || phoneDigits < 7) return setAlert("Enter a valid phone number.");
  const submitButton = form.querySelector("[type=submit]");
  submitButton.disabled = true;
  try {
    const result = await api.register(currentEventId, student);
    localStorage.setItem(studentStorageKey, student.studentId);
    updateHeader();
    setAlert(`${result.message} ${result.eventName} · Registration ID: ${result.registrationId}`, true);
    submitButton.textContent = "Registration confirmed";
    setTimeout(() => {
      dialog.close();
      location.hash = `#event/${currentEventId}`;
      renderRoute();
      showToast("Registration successful!");
      submitButton.disabled = false;
      submitButton.innerHTML = 'Confirm registration <span aria-hidden="true">&#8594;</span>';
    }, 1700);
  } catch (error) {
    setAlert(error.message);
    submitButton.disabled = false;
  }
});

document.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute, { once: true });