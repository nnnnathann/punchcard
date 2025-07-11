export {};

const html = String.raw;
class LoginWithGoogle extends HTMLElement {
  #loading = true;
  #user = null;
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    firebase.auth().onAuthStateChanged((user) => {
      this.#loading = false;
      this.#user = user;
      this.render();
      this.dispatchEvent(
        new CustomEvent("change", {
          detail: user,
          bubbles: true,
          composed: true,
        })
      );
    });
    this.shadowRoot.innerHTML = html`
      <style>
        :host {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: Arial, sans-serif;
          width: 100%;
          padding: 10px;
          box-sizing: border-box;
        }
        button {
          padding: 8px 12px;
          font-size: 16px;
          cursor: pointer;
        }
        #user-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        #user-info div {
          font-weight: bold;
        }
      </style>
      <div>Punchcard</div>
      <div id="content"></div>
    `;
  }
  connectedCallback() {
    this.render();
  }
  render() {
    if (this.#loading) {
      this.renderLoading();
      return;
    } else if (!this.#user) {
      this.renderLogin();
      return;
    } else {
      this.renderLogout();
      return;
    }
  }
  renderLoading() {
    this.renderContent(`<p>Loading...</p>`);
  }
  renderLogin() {
    this.renderContent(html` <button id="login">Login with Google</button> `);
    this.shadowRoot.querySelector("#login").addEventListener("click", () => {
      firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
    });
  }
  renderLogout() {
    this.renderContent(html`
      <div id="user-info">
        <div>
          <div>${this.#user.displayName}</div>
          <div>${this.#user.email}</div>
        </div>
        <button id="logout">Logout</button>
      </div>
    `);
    this.shadowRoot.querySelector("#logout").addEventListener("click", () => {
      firebase.auth().signOut();
    });
  }
  renderContent(content) {
    this.shadowRoot.querySelector("#content").innerHTML = content;
  }
}
customElements.define("login-with-google", LoginWithGoogle);

class PunchcardApp extends HTMLElement {
  #user = null;
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = html`
      <style>
        :host {
          display: block;
          font-family: Arial, sans-serif;
          padding: 20px;
        }
      </style>
      <div id="app-content"></div>
    `;
  }
  connectedCallback() {
    this.render();
  }
  render() {
    if (!this.#user) {
      this.renderContent("<p>Please log in to continue.</p>");
      return;
    }
    // Here you can render the main app content based on the user
    this.renderContent(`<calendar-summary></calendar-summary>`);
  }
  renderContent(content) {
    this.shadowRoot.querySelector("#app-content").innerHTML = content;
  }
  set user(user) {
    this.#user = user;
    this.render();
  }
  get user() {
    return this.#user;
  }
}
customElements.define("punchcard-app", PunchcardApp);

class CalendarSummary extends HTMLElement {
  #loading = true;
  #events = null;
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = html`
      <style>
        :host {
          display: block;
          font-family: Arial, sans-serif;
          padding: 10px;
          border: 1px solid #ccc;
          margin-top: 10px;
        }
        #summary {
          font-size: 16px;
        }
        .tag-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .descriptions {
          font-size: 14px;
          color: #555;
        }
        .tag {
          margin-bottom: 10px;
          padding: 5px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .date-range {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }
        input[type="date"] {
          padding: 5px;
          font-size: 14px;
        }
      </style>
      <div id="content"></div>
    `;
    this.render();
  }
  connectedCallback() {
    this.fetchCalendarData();
    this.render();
  }
  disconnectedCallback() {
    // Cleanup if needed
  }
  fetchCalendarData() {
    this.#loading = true;
    // Simulate fetching calendar data
    setTimeout(() => {
      this.#loading = false;
      this.#events = [
        { title: "Meeting with Bob", date: "2023-10-01" },
        { title: "Project deadline", date: "2023-10-05" },
        { title: "Conference", date: "2023-10-10" },
      ];
      this.render();
    }, 1000);
  }
  render() {
    if (this.#loading) {
      this.renderLoading();
      return;
    } else if (!this.#events) {
      this.renderNoEvents();
      return;
    } else {
      this.renderEvents();
      return;
    }
  }
  renderLoading() {
    this.renderContent("<p>Loading calendar data...</p>");
  }
  renderNoEvents() {
    this.renderContent("<p>No events found.</p>");
  }
  renderEvents() {
    const events = [
      {
        title: "[v1] [meeting] ACHQC Data",
        date: ["2025-07-01T00:00:00Z", "2025-07-01T23:59:59Z"],
      },
      // more like that
      {
        title: "[v1] [pd] DOS",
        date: ["2025-07-02T14:15:00Z", "2025-07-02T15:00:00Z"],
      },
      {
        title: "[v2] [meeting] Standup",
        date: ["2025-07-03T14:15:00Z", "2025-07-03T15:00:00Z"],
      },
      {
        title: "[v2] [pd] Project X",
        date: ["2025-07-04T14:15:00Z", "2025-07-04T15:00:00Z"],
      },
      {
        title: "[v1] [meeting] Sprint Planning",
        date: ["2025-07-05T14:15:00Z", "2025-07-05T15:00:00Z"],
      },
      {
        title: "[v1] [pd] Feature Y",
        date: ["2025-07-06T14:15:00Z", "2025-07-06T15:00:00Z"],
      },
      {
        title: "[v1] [meeting] Retrospective",
        date: ["2025-07-07T14:15:00Z", "2025-07-07T15:00:00Z"],
      },
      {
        title: "[v1] [pd] Bug Fixes",
        date: ["2025-07-08T14:15:00Z", "2025-07-08T15:00:00Z"],
      },
    ];
    const summary = calculateSummary(events);
    const content = summary
      .map((tag) => {
        const descriptionsByCount = Object.entries(tag.descriptions);
        descriptionsByCount.sort((a, b) => b[1] - a[1]);
        const descriptions = descriptionsByCount.map(
          ([description, count]) => `${description} (${count})`
        );
        const suffix =
          descriptions.length > 3 ? `, ${descriptions.length - 3} more` : "";
        return html`<div class="tag">
          <div class="tag-title">
            ${tag.title} ${tag.total.toFixed(1)}hrs ${tag.count}
          </div>
          <div class="descriptions">${descriptions.slice(0, 3)}${suffix}</div>
        </div>`;
      })
      .join("");
    const startDate = oneMonthAgo();
    const endDate = today();
    this.renderContent(html`
      <div id="summary">
        <h2>Events by Tag (calendar: &quot;punchcard&quot;)</h2>
        <div class="date-range">
          <input type="date" id="start-date" disabled />
          <input type="date" id="end-date" disabled />
        </div>
        ${content}
      </div>
    `);
    this.shadowRoot.querySelector("#start-date").value = startDate
      .toISOString()
      .split("T")[0];
    this.shadowRoot.querySelector("#end-date").value = endDate
      .toISOString()
      .split("T")[0];
  }
  renderContent(content) {
    this.shadowRoot.querySelector("#content").innerHTML = content;
  }
}
customElements.define("calendar-summary", CalendarSummary);

document.addEventListener("DOMContentLoaded", function () {
  const loadEl = document.querySelector("#app-status");
  const userEl = document.querySelector("login-with-google");
  const appEl = document.querySelector("punchcard-app");
  try {
    userEl.addEventListener("change", (e) => {
      loadEl.textContent = "";
      appEl.user = e.detail;
    });
  } catch (e) {
    console.error(e);
    loadEl.textContent = "Error loading the Firebase SDK, check the console.";
  }
});

function calculateSummary(events) {
  let tagSets = new Map();
  events.forEach((event) => {
    const tagRegex = /\[([^\]]+)\]/g;
    const tags = event.title.match(tagRegex);
    const description = event.title.replace(tagRegex, "").trim();
    try {
      const minDate = new Date(event.date[0]);
      const maxDate = new Date(event.date[1]);
      const minTime = Math.min(minDate.getTime(), maxDate.getTime());
      const maxTime = Math.max(minDate.getTime(), maxDate.getTime());
      const permutations = getPermutations(tags);
      permutations.forEach((t) => {
        const existing = tagSets.get(t);
        const total = (maxTime - minTime) / (1000 * 60 * 60 * 24) + 1;
        if (existing) {
          existing.count++;
          existing.total += total;
          existing.descriptions[description] =
            (existing.descriptions[description] || 0) + 1;
          tagSets.set(t, existing);
        } else {
          tagSets.set(t, {
            title: t,
            count: 1,
            total: total,
            descriptions: { [description]: 1 },
          });
        }
      });
    } catch (e) {
      console.error("Invalid date format in event:", event);
      return;
    }
  });
  return Array.from(tagSets.values()).sort((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count; // Sort by count descending
    }
    return b.total - a.total; // If counts are equal, sort by total descending
  });
}

/**
 * Generates all permutations, both single tags, and combinations of tags.
 * @param {string[]} tags - Array of tags to generate permutations from.
 * @return {string[]} - Array of unique tag combinations.
 */
function getPermutations(tags) {
  const results = new Set();
  const n = tags.length;
  for (let i = 0; i < 1 << n; i++) {
    let combination = [];
    for (let j = 0; j < n; j++) {
      if (i & (1 << j)) {
        combination.push(tags[j]);
      }
    }
    if (combination.length > 0) {
      results.add(combination.join(" "));
    }
  }
  return Array.from(results);
}

function startOfThisMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function oneMonthAgo() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date;
}

function today() {
  return new Date();
}
