(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const success = document.querySelector("#participant-success");
    const unavailable = document.querySelector("#submission-unavailable");
    try {
      const rawParticipant = localStorage.getItem("sosialisasi.participantData");
      const participant = rawParticipant ? JSON.parse(rawParticipant) : null;
      if (!participant || typeof participant !== "object" || !participant.submittedAt) {
        unavailable.hidden = false;
        return;
      }

      const rawActivities = localStorage.getItem("activities");
      const activities = rawActivities ? JSON.parse(rawActivities) : [];
      const submittedActivity = Array.isArray(activities)
        ? activities.find((activity) => activity && String(activity.id) === String(participant.eventId))
        : null;
      const rawDraft = localStorage.getItem("sosialisasi.employeeDraft");
      const draft = rawDraft ? JSON.parse(rawDraft) : {};
      const event = submittedActivity?.event || draft?.eventInfo || draft?.event || {};
      document.querySelector("#success-event-name").textContent = event.name || "Kegiatan Sosialisasi";
      const submittedAt = new Date(participant.submittedAt);
      document.querySelector("#success-submission-time").textContent = Number.isNaN(submittedAt.getTime())
        ? "Data peserta telah diterima."
        : `Dikirim pada ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(submittedAt)}`;
      success.hidden = false;
    } catch (error) {
      console.error("Status pengiriman peserta tidak dapat dibaca.", error);
      unavailable.hidden = false;
    }
  });
})();
