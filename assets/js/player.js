(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var slug = params.get("course");

  var titleEl = document.getElementById("course-title");
  var subEl = document.getElementById("course-sub");
  var chipEl = document.getElementById("status-chip");
  var scormBadge = document.getElementById("course-scorm");
  var toolEl = document.getElementById("course-tool");
  var restartBtn = document.getElementById("restart-btn");
  var fullscreenBtn = document.getElementById("fullscreen-btn");
  var frameWrap = document.getElementById("frame-wrap");
  var frame = document.getElementById("sco-frame");
  var placeholder = document.getElementById("player-placeholder");
  var placeholderTitle = document.getElementById("placeholder-title");
  var placeholderText = document.getElementById("placeholder-text");
  var slugA = document.getElementById("slug-a");
  var slugB = document.getElementById("slug-b");

  var infoTitle = document.getElementById("info-title");
  var infoStandard = document.getElementById("info-standard");
  var infoTool = document.getElementById("info-tool");
  var infoPackage = document.getElementById("info-package");
  var infoStatus = document.getElementById("info-status");
  var infoScore = document.getElementById("info-score");

  var statusTimer = null;

  function setSlugLabels(value) {
    if (slugA) slugA.textContent = value;
    if (slugB) slugB.textContent = value;
  }

  function statusLabel(raw) {
    switch (String(raw || "").toLowerCase()) {
      case "passed":
        return "Passed";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "incomplete":
        return "In progress";
      case "browsed":
        return "Browsed";
      case "not attempted":
        return "Not started";
      default:
        return raw || "Not started";
    }
  }

  function stateFor(raw) {
    var value = String(raw || "").toLowerCase();
    if (value === "completed" || value === "passed") return "completed";
    if (value === "failed") return "failed";
    if (value === "incomplete" || value === "browsed") return "running";
    return "idle";
  }

  function applyStatus(rawStatus, rawScore) {
    var label = statusLabel(rawStatus);
    var state = stateFor(rawStatus);

    if (chipEl) {
      chipEl.textContent = label;
      chipEl.setAttribute("data-state", state);
    }
    if (infoStatus) infoStatus.textContent = label;

    if (infoScore) {
      if (rawScore === null || rawScore === undefined || rawScore === "") {
        infoScore.textContent = "-";
      } else {
        infoScore.textContent = String(rawScore);
      }
    }
  }

  function readValue(name) {
    if (!window.API || typeof window.API.LMSGetValue !== "function") return "";
    try {
      return window.API.LMSGetValue(name);
    } catch (error) {
      return "";
    }
  }

  function pollStatus() {
    var rawStatus = readValue("cmi.core.lesson_status");
    var rawScore = readValue("cmi.core.score.raw");
    var maxScore = readValue("cmi.core.score.max");
    var scoreText = rawScore;

    if (rawScore !== "" && maxScore !== "" && maxScore !== undefined) {
      scoreText = rawScore + " / " + maxScore;
    }

    applyStatus(rawStatus, scoreText);
  }

  function createApi() {
    if (typeof window.Scorm12API !== "function") {
      return false;
    }
    try {
      window.API = new window.Scorm12API({ autocommit: true, logLevel: 0 });
      return true;
    } catch (error) {
      return false;
    }
  }

  function launchCourse(course) {
    var apiReady = createApi();

    if (placeholder) placeholder.hidden = true;
    if (frameWrap) frameWrap.hidden = false;
    if (restartBtn) restartBtn.hidden = false;
    if (fullscreenBtn) fullscreenBtn.hidden = false;
    if (infoPackage) infoPackage.textContent = "Imported";

    frame.src = course.launch;

    if (!apiReady) {
      if (infoPackage) infoPackage.textContent = "SCORM run-time unavailable";
      applyStatus("", "");
      return;
    }

    pollStatus();
    if (statusTimer) window.clearInterval(statusTimer);
    statusTimer = window.setInterval(pollStatus, 1200);
  }

  function showNotImported(course, reasonTitle, reasonText) {
    if (placeholderTitle && reasonTitle) placeholderTitle.textContent = reasonTitle;
    if (placeholderText && reasonText) placeholderText.textContent = reasonText;
    if (placeholder) placeholder.hidden = false;
    if (frameWrap) frameWrap.hidden = true;
    if (restartBtn) restartBtn.hidden = true;
    if (fullscreenBtn) fullscreenBtn.hidden = true;
    if (infoPackage) infoPackage.textContent = "Not imported";
    applyStatus("", "");
  }

  function fillDetails(course) {
    if (!course) return;
    document.title = course.title + " | Course Player";
    if (titleEl) titleEl.textContent = course.title;
    if (subEl) subEl.textContent = (course.scormVersion || "SCORM 1.2") + " package player";
    if (scormBadge) scormBadge.textContent = "SCORM " + (course.scormVersion || "1.2");
    if (toolEl) toolEl.textContent = course.authoringTool || "Course package";
    if (infoTitle) infoTitle.textContent = course.title;
    if (infoStandard) infoStandard.textContent = "SCORM " + (course.scormVersion || "1.2");
    if (infoTool) infoTool.textContent = course.authoringTool || "-";
    setSlugLabels(course.slug);
  }

  function init() {
    if (!slug) {
      showNotImported(
        null,
        "No course selected",
        "Open a course from the work samples section to load its SCORM 1.2 package here."
      );
      return;
    }

    setSlugLabels(slug);

    fetch("assets/scorm/courses.json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Unable to load course index");
        return response.json();
      })
      .then(function (data) {
        var courses = (data && data.courses) || [];
        var course = courses.filter(function (item) {
          return item.slug === slug;
        })[0];

        if (!course) {
          showNotImported(
            null,
            "Course not found",
            "The course '" + slug + "' is not registered in assets/scorm/courses.json."
          );
          return;
        }

        fillDetails(course);

        if (course.available && course.launch) {
          launchCourse(course);
        } else {
          showNotImported(course);
        }
      })
      .catch(function () {
        showNotImported(
          null,
          "Course index unavailable",
          "Could not load assets/scorm/courses.json. Open this page through a web server (or GitHub Pages), not directly from a file."
        );
      });
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      createApi();
      if (frame) {
        var base = frame.getAttribute("src") || "";
        var clean = base.split("?r=")[0];
        frame.src = clean + (clean.indexOf("?") > -1 ? "&" : "?") + "r=" + Date.now();
      }
      if (statusTimer) window.clearInterval(statusTimer);
      statusTimer = window.setInterval(pollStatus, 1200);
      applyStatus("", "");
    });
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", function (event) {
      event.preventDefault();
      if (!frameWrap) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (frameWrap.requestFullscreen) {
        frameWrap.requestFullscreen();
      }
    });
  }

  init();
})();
