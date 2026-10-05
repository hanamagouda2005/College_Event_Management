async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

export const api = {
  getEvents: () => request("/api/events"),
  getEvent: (eventId, studentId) => request(`/api/events/${eventId}${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`),
  checkRegistration: (eventId, studentId) => request(`/api/events/${eventId}/registration?studentId=${encodeURIComponent(studentId)}`),
  register: (eventId, student) => request(`/api/registrations/events/${eventId}`, { method: "POST", body: JSON.stringify(student) }),
  getStudentEvents: (studentId) => request(`/api/registrations/students/${encodeURIComponent(studentId)}/events`),
  cancelRegistration: (registrationId, studentId) => request(`/api/registrations/${encodeURIComponent(registrationId)}/cancel`, { method: "POST", body: JSON.stringify({ studentId }) })
};