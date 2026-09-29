export function eventCard(event) {
  const full = event.availableSeats < 1;
  const status = new Date(`${event.date}T23:59:59`) < new Date() ? "Completed" : full ? "Full" : "Open";
  const date = new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `
    <article class="event-card">
      <a href="#event/${event.id}" aria-label="View ${escapeHtml(event.name)} details">
        <div class="event-image">
          <img src="${escapeHtml(event.imageUrl)}" alt="" loading="lazy">
          <span class="category-tag">${escapeHtml(event.category)}</span>
        </div>
        <div class="card-content">
          <div class="card-title-row"><h3 class="card-title">${escapeHtml(event.name)}</h3><span class="status-badge ${status === "Full" ? "is-full" : ""}">${status}</span></div>
          <p class="card-description">${escapeHtml(event.description)}</p>
          <div class="event-meta">
            <span><span class="meta-icon" aria-hidden="true">&#9635;</span>${date}</span>
            <span><span class="meta-icon" aria-hidden="true">&#9719;</span>${escapeHtml(event.time)}</span>
            <span><span class="meta-icon" aria-hidden="true">&#9673;</span>${escapeHtml(event.venue)}</span>
            <span><span class="meta-icon" aria-hidden="true">&#8599;</span>${escapeHtml(event.category)}</span>
          </div>
          <div class="card-footer"><span class="seats"><strong>${event.availableSeats}</strong> seats left</span><span class="text-link">Event details <span aria-hidden="true">&#8594;</span></span></div>
        </div>
      </a>
    </article>`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}