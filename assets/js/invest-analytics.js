(function () {
  "use strict";

  var endpoint = "https://script.google.com/macros/s/AKfycbzBMxFBoQZBWSCdVCRnW4kFnjyoGZA2F-3ym2rqW-fVMFa1Wx5xT5SNMrvZdP3Xky0/exec";
  var sessionKey = "raleigh_invest_analytics_session";
  var sessionId;
  try {
    sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = "invest-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      sessionStorage.setItem(sessionKey, sessionId);
    }
  } catch (_) {
    sessionId = "invest-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  var pageViewId = "view-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  var path = location.pathname.replace(/\/index\.html$/, "/");
  if (/^\/invest\/review\//.test(path)) return;

  function send(eventName) {
    var event = {
      event_name: eventName,
      event_time: new Date().toISOString(),
      session_id: sessionId,
      page_view_id: pageViewId,
      page_path: path,
      page_url: location.href,
      page_title: document.title,
      page_type: "investor",
      referrer: document.referrer || ""
    };
    var body = JSON.stringify({ source: "website_analytics", events: [event] });
    if (eventName !== "page_view" && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      return;
    }
    fetch(endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
  }

  send("page_view");
})();
