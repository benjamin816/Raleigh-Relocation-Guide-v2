(() => {
  const NOTICE = "lir-quiz-newsletter-v3";
  window.LirQuizNewsletterConsent = (form, capture, email, submissionId) => {
    const notice = form?.querySelector('[data-quiz-newsletter-notice]');
    const visibleNotice = notice?.dataset.quizNewsletterNotice === NOTICE &&
      notice.getClientRects().length > 0 && getComputedStyle(notice).visibility === "visible";
    if (!visibleNotice || !["suburb_quiz", "neighborhood_quiz"].includes(capture) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim()) || !submissionId) {
      return { email_marketing_opt_in: false };
    }
    return {
      email_marketing_opt_in: true,
      email_marketing_notice_version: NOTICE,
      email_marketing_capture: capture,
      email_marketing_event_id: submissionId,
      email_marketing_method: "disclosed_quiz_submit"
    };
  };
})();
