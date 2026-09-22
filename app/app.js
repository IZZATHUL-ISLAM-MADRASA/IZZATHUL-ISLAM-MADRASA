// app.js
import { renderLandingPage } from "./landing-page.js";
import { renderMeetupRegister } from "./meetup-register.js";
import { renderAdminLogin } from "./admin-auth.js";
import { renderAdminDashboard } from "./admin-dashboard.js";
import { renderMeetupAdmin } from "./admin-family-meetup.js";
import { renderFamilyPassView } from "./family-pass.js";
import { renderVerificationDesk } from "./verification-desk.js";

export const state = {
  currentView: new URLSearchParams(window.location.search).get("view") || "landing",
  user: {
    uid: sessionStorage.getItem("portalUserId"),
    role: sessionStorage.getItem("portalRole")
  }
};

window.navigate = (view) => {
  state.currentView = view;
  state.user.uid = sessionStorage.getItem("portalUserId");
  state.user.role = sessionStorage.getItem("portalRole");

  const url = new URL(window.location);
  url.searchParams.set("view", view);
  window.history.pushState({}, "", url);
  renderApp();
};

window.addEventListener("popstate", () => {
  state.currentView = new URLSearchParams(window.location.search).get("view") || "landing";
  state.user.uid = sessionStorage.getItem("portalUserId");
  state.user.role = sessionStorage.getItem("portalRole");
  renderApp();
});

export function renderApp() {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = "";

  switch (state.currentView) {
    case "landing":
      renderLandingPage();
      break;
    case "register":
      renderMeetupRegister();
      break;
    case "family-login":
      renderFamilyPassView();
      break;
    case "verification-desk":
      renderVerificationDesk();
      break;
    case "dashboard":
      if (!state.user.uid || !["admin", "usthad"].includes(state.user.role)) return window.navigate("login");
      renderAdminDashboard();
      break;
    case "meetup-admin":
      if (!state.user.uid || !["admin", "usthad"].includes(state.user.role)) return window.navigate("login");
      renderMeetupAdmin();
      break;
    case "login":
      renderAdminLogin();
      break;
    default:
      renderLandingPage();
      break;
  }
}

// Initial Boot
renderApp();