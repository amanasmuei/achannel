// aman Web UI — app.js
// Chat with SSE streaming, tab router, API integration
//
// Security: All user input displayed via textContent (safe).
// AI responses rendered via markdown after escapeHtml first.

(function () {
  "use strict";

  // State
  var sessionId = localStorage.getItem("aman-session") || "web-" + Date.now();
  localStorage.setItem("aman-session", sessionId);

  // DOM helpers
  function $(s) { return document.querySelector(s); }
  function $$(s) { return document.querySelectorAll(s); }
  function createEl(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  var messagesEl = $("#messages");
  var chatForm = $("#chat-form");
  var chatInput = $("#chat-input");
  var sendBtn = $("#send-btn");
  var typingEl = $("#typing");
  var sidebarEl = $("#sidebar");
  var sidebarToggle = $("#sidebar-toggle");
  var themeToggle = $("#theme-toggle");

  // Theme
  var savedTheme = localStorage.getItem("aman-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = savedTheme === "dark" ? "\u263D" : "\u2600";
  themeToggle.addEventListener("click", function () {
    var c = document.documentElement.getAttribute("data-theme");
    var n = c === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", n);
    localStorage.setItem("aman-theme", n);
    themeToggle.textContent = n === "dark" ? "\u263D" : "\u2600";
  });

  // Sidebar mobile toggle
  sidebarToggle.addEventListener("click", function () { sidebarEl.classList.toggle("open"); });
  document.addEventListener("click", function (e) {
    if (window.innerWidth <= 768 && sidebarEl.classList.contains("open") &&
      !sidebarEl.contains(e.target) && e.target !== sidebarToggle) {
      sidebarEl.classList.remove("open");
    }
  });

  // Tab router
  function setActiveTab(name) {
    $$(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    $$(".page").forEach(function (p) { p.classList.toggle("active", p.id === "page-" + name); });
    if (name === "plans") loadPlans();
    else if (name === "profiles") loadProfiles();
    else if (name === "teams") loadTeams();
    else if (name === "settings") loadSettings();
  }
  $$(".tab").forEach(function (tab) {
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      window.location.hash = tab.dataset.tab;
      setActiveTab(tab.dataset.tab);
      sidebarEl.classList.remove("open");
    });
  });
  setActiveTab(window.location.hash.slice(1) || "chat");
  window.addEventListener("hashchange", function () { setActiveTab(window.location.hash.slice(1) || "chat"); });

  // Markdown (escape first, then apply formatting)
  function renderMarkdown(text) {
    var h = escapeHtml(text);
    return h
      .replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, "<h4>$1</h4>")
      .replace(/^## (.+)$/gm, "<h3>$1</h3>")
      .replace(/^# (.+)$/gm, "<h2>$1</h2>")
      .replace(/^- (.+)$/gm, "\u2022 $1")
      .replace(/\n/g, "<br>");
  }

  // Chat messages
  function addMessage(role, text) {
    var div = createEl("div", role === "user" ? "msg msg-user" : "msg msg-ai");
    if (role === "user") {
      div.textContent = text;
    } else {
      // AI text is escaped inside renderMarkdown before formatting
      var rendered = renderMarkdown(text);
      // Use a safe approach: create a template
      var temp = document.createElement("div");
      temp.innerHTML = rendered; // safe: input was escaped by escapeHtml
      while (temp.firstChild) div.appendChild(temp.firstChild);
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }
  function addToolMsg(text) {
    messagesEl.appendChild(createEl("div", "msg msg-tool", text));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // SSE Chat
  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = chatInput.value.trim();
    if (!msg) return;
    chatInput.value = "";
    sendBtn.disabled = true;
    addMessage("user", msg);
    typingEl.style.display = "flex";

    var aiDiv = null, aiText = "";
    var url = "/chat/stream?message=" + encodeURIComponent(msg) + "&session_id=" + encodeURIComponent(sessionId);
    var es = new EventSource(url);

    es.addEventListener("text", function (e) {
      if (!aiDiv) { typingEl.style.display = "none"; aiDiv = addMessage("ai", ""); }
      aiText += e.data;
      // Re-render markdown into the div
      var rendered = renderMarkdown(aiText);
      var temp = document.createElement("div");
      temp.innerHTML = rendered;
      aiDiv.textContent = "";
      while (temp.firstChild) aiDiv.appendChild(temp.firstChild);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
    es.addEventListener("tool", function (e) {
      try { var d = JSON.parse(e.data); addToolMsg("[" + d.name + ": " + d.status + "]"); } catch (err) { /* skip */ }
    });
    es.addEventListener("done", function (e) {
      try { var d = JSON.parse(e.data); if (d.session_id) { sessionId = d.session_id; localStorage.setItem("aman-session", sessionId); } } catch (err) { /* skip */ }
      es.close(); typingEl.style.display = "none"; sendBtn.disabled = false; chatInput.focus(); loadSidebar();
    });
    es.addEventListener("error", function () {
      es.close(); typingEl.style.display = "none";
      if (!aiDiv) addMessage("ai", "Connection error. Please try again.");
      sendBtn.disabled = false;
    });
    es.onerror = function () {
      es.close(); typingEl.style.display = "none";
      if (!aiDiv) addMessage("ai", "Connection lost.");
      sendBtn.disabled = false;
    };
  });

  // Sidebar
  function loadSidebar() {
    fetch("/api/status").then(function (r) { return r.json(); }).then(function (d) {
      $("#sidebar-ai-name").textContent = d.aiName || "Aman";
      $("#header-model").textContent = d.model || "";
      var layers = d.layers || {};
      var n = Object.keys(layers).filter(function (k) { return layers[k]; }).length;
      $("#sidebar-layers").textContent = n + "/6 layers";
    }).catch(function () { });
    fetch("/api/plans").then(function (r) { return r.json(); }).then(function (plans) {
      var a = plans.find(function (p) { return p.content.indexOf("**Active:** true") >= 0; });
      if (a) {
        var total = (a.content.match(/- \[[ x]\]/g) || []).length;
        var done = (a.content.match(/- \[x\]/g) || []).length;
        var pct = total > 0 ? Math.round((done / total) * 100) : 0;
        $("#sidebar-plan").textContent = a.name + " (" + done + "/" + total + ")";
        $("#sidebar-plan-bar").style.display = "block";
        $("#sidebar-plan-bar .progress-fill").style.width = pct + "%";
      }
    }).catch(function () { });
  }

  // Plans page
  function loadPlans() {
    var el = $("#plans-list"); el.textContent = "";
    fetch("/api/plans").then(function (r) { return r.json(); }).then(function (plans) {
      if (!plans.length) { el.textContent = "No plans. Create with /plan create in CLI."; return; }
      plans.forEach(function (p) {
        var card = createEl("div", "card");
        card.appendChild(createEl("h3", null, p.name));
        var gm = p.content.match(/\*\*Goal:\*\*\s*(.+)/);
        if (gm) card.appendChild(createEl("p", null, gm[1]));
        var steps = [], re = /- \[([ x])\] (.+)/g, m;
        while ((m = re.exec(p.content)) !== null) steps.push({ done: m[1] === "x", text: m[2] });
        var dn = steps.filter(function (s) { return s.done; }).length;
        var pct = steps.length > 0 ? Math.round((dn / steps.length) * 100) : 0;
        var bar = createEl("div", "progress-bar"); bar.style.margin = "8px 0";
        var fill = createEl("div", "progress-fill"); fill.style.width = pct + "%";
        bar.appendChild(fill); card.appendChild(bar);
        card.appendChild(createEl("p", null, dn + "/" + steps.length + " (" + pct + "%)"));
        steps.forEach(function (s) {
          var row = createEl("div", "plan-step" + (s.done ? " done" : ""));
          var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = s.done; cb.disabled = true;
          row.appendChild(cb); row.appendChild(document.createTextNode(" " + s.text));
          card.appendChild(row);
        });
        el.appendChild(card);
      });
    }).catch(function () { el.textContent = "Error loading plans."; });
  }

  // Profiles page
  function loadProfiles() {
    var el = $("#profiles-list"); el.textContent = "";
    fetch("/api/profiles").then(function (r) { return r.json(); }).then(function (profiles) {
      if (!profiles.length) { el.textContent = "No profiles. Create with /profile create in CLI."; return; }
      profiles.forEach(function (p) {
        var card = createEl("div", "card");
        card.appendChild(createEl("h3", null, p.aiName));
        card.appendChild(createEl("span", "tag", p.name));
        card.appendChild(createEl("p", null, p.personality));
        el.appendChild(card);
      });
    }).catch(function () { el.textContent = "Error loading profiles."; });
  }

  // Teams page
  function loadTeams() {
    var el = $("#teams-list"); el.textContent = "";
    fetch("/api/teams").then(function (r) { return r.json(); }).then(function (teams) {
      if (!teams.length) { el.textContent = "No teams. Create with /team create in CLI."; return; }
      teams.forEach(function (t) {
        var card = createEl("div", "card");
        card.appendChild(createEl("h3", null, t.name));
        card.appendChild(createEl("span", "tag", t.workflow));
        if (t.goal) card.appendChild(createEl("p", null, t.goal));
        var mp = createEl("p"); mp.style.marginTop = "6px";
        t.members.forEach(function (m) {
          mp.appendChild(createEl("span", "tag", m.profile + ": " + m.role));
          mp.appendChild(document.createTextNode(" "));
        });
        card.appendChild(mp); el.appendChild(card);
      });
    }).catch(function () { el.textContent = "Error loading teams."; });
  }

  // Memory search
  $("#memory-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = $("#memory-query").value.trim(); if (!q) return;
    var el = $("#memory-results"); el.textContent = "Searching...";
    fetch("/api/memory?q=" + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (results) {
      if (!Array.isArray(results) || !results.length) { el.textContent = "No memories found."; return; }
      el.textContent = "";
      results.forEach(function (m) {
        var card = createEl("div", "card");
        card.appendChild(createEl("span", "tag", m.type || "memory"));
        if (m.score) card.appendChild(createEl("span", "tag", Math.round(m.score * 100) + "%"));
        card.appendChild(createEl("p", null, m.content || m.text || JSON.stringify(m)));
        el.appendChild(card);
      });
    }).catch(function () { el.textContent = "Search failed."; });
  });

  // Settings page
  function loadSettings() {
    var el = $("#settings-content"); el.textContent = "";
    fetch("/api/status").then(function (r) { return r.json(); }).then(function (data) {
      var layers = data.layers || {};
      var c1 = createEl("div", "card");
      [["Provider", data.provider || "unknown"], ["Model", data.model || "unknown"], ["Session", sessionId]].forEach(function (p) {
        var row = createEl("div", "setting-row");
        row.appendChild(createEl("span", "setting-label", p[0]));
        row.appendChild(createEl("span", "setting-value", p[1]));
        c1.appendChild(row);
      });
      el.appendChild(c1);
      var c2 = createEl("div", "card"); c2.appendChild(createEl("h3", null, "Layers"));
      Object.keys(layers).forEach(function (k) {
        var row = createEl("div", "setting-row");
        row.appendChild(createEl("span", "setting-label", k));
        row.appendChild(createEl("span", "setting-value", layers[k] ? "\u2705" : "\u274C"));
        c2.appendChild(row);
      });
      el.appendChild(c2);
      var c3 = createEl("div", "card"); c3.appendChild(createEl("h3", null, "Actions"));
      var cr = createEl("div", "setting-row");
      cr.appendChild(createEl("span", "setting-label", "Clear conversation"));
      var btn = document.createElement("button"); btn.textContent = "Clear";
      btn.style.cssText = "padding:6px 12px;background:var(--red);color:#fff;border:none;border-radius:var(--radius);cursor:pointer";
      btn.addEventListener("click", clearSession);
      cr.appendChild(btn); c3.appendChild(cr); el.appendChild(c3);
    }).catch(function () { el.textContent = "Error loading settings."; });
  }

  function clearSession() {
    fetch("/chat", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }) }).catch(function () { });
    sessionId = "web-" + Date.now();
    localStorage.setItem("aman-session", sessionId);
    messagesEl.textContent = "";
    addMessage("ai", "Conversation cleared. How can I help?");
  }

  // Init
  loadSidebar();
  addMessage("ai", "Hello! I'm your AI companion. How can I help today?");
})();
