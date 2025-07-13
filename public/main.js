export {};

const html = String.raw;
class LoginWithGoogle extends HTMLElement {
  static CLIENT_ID =
    "1016583805708-6f9si6f88jcv7v8novm336he5ngvjg0s.apps.googleusercontent.com";
  static DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
  ];
  static SCOPES = "https://www.googleapis.com/auth/calendar.events";

  #loading = true;
  #user = null;
  #gapiReady = false;
  #tokenClient = null;

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
        }),
      );
      this._maybeRequestAccessToken();
    });

    this.shadowRoot.innerHTML = /* html */ `
      <style>
        :host { display: flex; justify-content: space-between;
                 align-items: center; font-family: Arial, sans-serif;
                 width: 100%; padding: 10px; }
        button { padding: 8px 12px; font-size: 16px; cursor: pointer; }
        #user-info { display: flex; align-items: center; gap: 10px; }
        #user-info div { font-weight: bold; }
      </style>
      <div>Punchcard</div>
      <div id="content"></div>
    `;
  }

  connectedCallback() {
    this.render();
    this._initGapiClient();
    this._initGis();
  }

  // ——— Load & init gapi.client for Calendar ———
  _initGapiClient() {
    if (window.gapi) {
      gapi.load("client", () => {
        gapi.client
          .init({
            discoveryDocs: LoginWithGoogle.DISCOVERY_DOCS,
          })
          .then(() => {
            this.#gapiReady = true;
            this._maybeRequestAccessToken();
          })
          .catch((err) => console.error("gapi.client.init error", err));
      });
    }
  }

  // ——— Load & init GIS for ID + Access tokens ———
  _initGis() {
    if (!window.google?.accounts?.id) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => this._initGis();
      document.head.appendChild(s);
      return;
    }

    google.accounts.id.initialize({
      client_id: LoginWithGoogle.CLIENT_ID,
      callback: (resp) => this._handleCredentialResponse(resp),
    });

    this.#tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: LoginWithGoogle.CLIENT_ID,
      scope: LoginWithGoogle.SCOPES,
      callback: (tokenResp) => this._handleTokenResponse(tokenResp),
    });

    this._maybeRequestAccessToken();
  }

  // ——— If signed-in + gapi + tokenClient ready → request token ———
  _maybeRequestAccessToken() {
    if (this.#user && this.#tokenClient) {
      this.#tokenClient.requestAccessToken({ prompt: "" });
    }
  }

  render() {
    if (this.#loading) return this._renderLoading();
    else if (!this.#user) return this._renderLogin();
    else return this._renderLogout();
  }

  _renderLoading() {
    this._renderContent(`<p>Loading...</p>`);
  }

  _renderLogin() {
    this._renderContent(`<div id="gis-button"></div>`);
    google.accounts.id.renderButton(
      this.shadowRoot.getElementById("gis-button"),
      { theme: "outline", size: "large" },
    );
    google.accounts.id.prompt();
  }

  async _handleCredentialResponse(response) {
    const idToken = response.credential;
    const cred = firebase.auth.GoogleAuthProvider.credential(idToken);
    await firebase.auth().signInWithCredential(cred);
  }

  _handleTokenResponse(tokenResponse) {
    const accessToken = tokenResponse.access_token;
    window.calendarAccessToken = accessToken;
    if (this.#gapiReady) {
      gapi.client.setToken({ access_token: accessToken });
    }
    this.dispatchEvent(
      new CustomEvent("gapi-login", {
        detail: { user: this.#user, accessToken },
        bubbles: true,
        composed: true,
      }),
    );
  }

  _renderLogout() {
    this._renderContent(/* html */ `
      <div id="user-info">
        <div>
          <div>${this.#user.displayName}</div>
          <div>${this.#user.email}</div>
        </div>
        <button id="logout">Logout</button>
      </div>
    `);
    this.shadowRoot
      .getElementById("logout")
      .addEventListener("click", () => firebase.auth().signOut());
  }

  _renderContent(htmlStr) {
    this.shadowRoot.getElementById("content").innerHTML = htmlStr;
  }
}
customElements.define("login-with-google", LoginWithGoogle);

class PunchcardApp extends HTMLElement {
  #user = null;
  #gapiReady = false;
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
    if (!this.#user || !this.#gapiReady) {
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
  set gapiReady(ready) {
    this.#gapiReady = ready;
    this.render();
  }
  get gapiReady() {
    return this.#gapiReady;
  }
}
customElements.define("punchcard-app", PunchcardApp);

class CalendarSummary extends HTMLElement {
  #loading = false;
  #error = false;
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
          background: white;
          border-radius: 5px;
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
      <h2>Events by Tag (calendar: &quot;punchcard&quot;)</h2>
      <div class="date-range">
        <input type="date" id="start-date" />
        <input type="date" id="end-date" />
        <button id="refresh">Update</button>
      </div>
      <div id="content"></div>
    `;
    this.render();
  }
  connectedCallback() {
    this.render();
    this.shadowRoot
      .querySelector("#refresh")
      .addEventListener("click", this.refresh.bind(this));
    setTimeout(() => {
      this.fetchCalendarData(oneMonthAgo(), today());
    }, 0);
  }
  refresh() {
    this.fetchCalendarData();
  }
  disconnectedCallback() {
    // Cleanup if needed
  }
  fetchCalendarData(startDate, endDate) {
    if (this.#loading) {
      console.warn("Already loading calendar data, ignoring new request.");
      return;
    }
    this.#loading = true;
    const startDateEl = this.shadowRoot.querySelector("#start-date");
    const endDateEl = this.shadowRoot.querySelector("#end-date");
    if (!startDate) {
      if (startDateEl?.value) {
        startDate = new Date(startDateEl.value);
      } else {
        startDate = oneMonthAgo();
      }
    }
    if (!endDate) {
      if (endDateEl?.value) {
        console.log("Using endDateEl value:", endDateEl.value);
        endDate = new Date(endDateEl.value);
      } else {
        endDate = today();
      }
    }
    if (startDateEl) {
      startDateEl.value = startDate.toISOString().split("T")[0];
    }
    if (endDateEl) {
      endDateEl.value = endDate.toISOString().split("T")[0];
    }
    this.render();
    fetchGoogleCalendarEvents(startDate, endDate)
      .then((events) => {
        this.#events = events;
        this.#loading = false;
        this.#error = false;
        this.render();
      })
      .catch((error) => {
        console.error("Error fetching calendar events:", error);
        this.#loading = false;
        this.#error = true;
        this.#events = null;
        this.render();
      });
  }
  render() {
    if (this.#loading) {
      this.renderLoading();
      return;
    } else if (this.#error) {
      this.renderContent(
        "<p>Error loading calendar data. Please try again later.</p>",
      );
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
    const events = this.#events;
    const summary = calculateSummary(events);
    const content = summary.map(this.renderTag.bind(this)).join("");
    this.renderContent(html` <div id="summary">${content}</div> `);
  }
  renderTag(tag) {
    const descriptionsByCount = Object.entries(tag.descriptions);
    descriptionsByCount.sort((a, b) => b[1] - a[1]);
    const descriptions = descriptionsByCount.map(
      ([description, count]) => `${description} (${count})`,
    );
    const suffix =
      descriptions.length > 3 ? `, ${descriptions.length - 3} more` : "";
    return html`<div class="tag">
      <div class="tag-title">${tag.title.replace(/\[|\]/g, "")}</div>
      <div class="hrs">${Math.round(tag.total)}hrs</div>
      <div class="count">${tag.count} Events</div>
      <div class="descriptions">${descriptions.slice(0, 3)}${suffix}</div>
    </div>`;
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
    userEl.addEventListener("gapi-login", (e) => {
      loadEl.textContent = "";
      appEl.gapiReady = true;
      appEl.user = e.detail.user;
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
    if (!tags || tags.length === 0) {
      console.warn("No tags found in event title:", event.title);
      return;
    }
    try {
      const minDate = new Date(event.date[0]);
      const maxDate = new Date(event.date[1]);
      const minTime = Math.min(minDate.getTime(), maxDate.getTime());
      const maxTime = Math.max(minDate.getTime(), maxDate.getTime());
      const permutations = getPermutations(deduplicate(tags));
      permutations.forEach((t) => {
        const existing = tagSets.get(t);
        const durationInHrs = (maxTime - minTime) / (1000 * 60 * 60);
        if (existing) {
          existing.count++;
          existing.total += durationInHrs;
          existing.descriptions[description] =
            (existing.descriptions[description] || 0) + 1;
          tagSets.set(t, existing);
        } else {
          tagSets.set(t, {
            title: t,
            count: 1,
            total: durationInHrs,
            descriptions: { [description]: 1 },
          });
        }
      });
    } catch (e) {
      console.error("Invalid date format in event:", event, e);
      return;
    }
  });
  return Array.from(tagSets.values()).sort((a, b) => {
    if (a.total !== b.total) {
      return b.total - a.total;
    }
    return b.count - a.count;
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

function deduplicate(arr) {
  const seen = new Set(arr);
  return Array.from(seen.values());
}

window.getPermutations = getPermutations;

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

async function fetchGoogleCalendarEvents(startDate, endDate) {
  return fetchGoogleCalendarEventsReal(startDate, endDate);
}

/**
 * Finds the first calendar whose summary matches the given regex.
 * @param {RegExp} regex
 * @returns {gapi.client.calendar.CalendarListEntry|null}
 */
async function findCalendarByRegex(regex) {
  try {
    const resp = await gapi.client.calendar.calendarList.list();
    const calendars = resp.result.items || [];
    return calendars.find((cal) => regex.test(cal.summary)) || null;
  } catch (err) {
    console.error("Error finding calendar", err);
    return null;
  }
}

/**
 * Fetches **all** events from the “punchcard” calendar between startDate and endDate,
 * handling pagination so you get beyond the first page of results.
 * Returns an array of { title, date: [start, end] }.
 * @param {Date} startDate
 * @param {Date} endDate
 * @throws if no “punchcard” calendar is found
 */
async function fetchGoogleCalendarEventsReal(startDate, endDate) {
  try {
    const calendar = await findCalendarByRegex(/punchcard/i);
    if (!calendar) {
      throw new Error("No calendar found with the name 'punchcard'");
    }

    let allItems = [];
    let pageToken = undefined;

    do {
      const resp = await gapi.client.calendar.events.list({
        calendarId: calendar.id,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        pageToken: pageToken,
      });

      const items = resp.result.items || [];
      allItems = allItems.concat(items);
      pageToken = resp.result.nextPageToken;
    } while (pageToken);

    return allItems.map((event) => {
      let dateRange = [event.start.dateTime, event.end.dateTime].map(
        (d) => new Date(d),
      );
      return {
        title: event.summary,
        date: dateRange,
      };
    });
  } catch (err) {
    console.error("Error fetching punchcard events", err);
    throw err;
  }
}

async function fetchGoogleCalendarEventsFake(startDate, endDate) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          title: "[v1] [meeting] ACHQC Data",
          date: ["2025-07-01T00:00:00Z", "2025-07-01T23:59:59Z"],
        },
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
      ]);
    }, 1000); // Simulate network delay
  });
}
