/**
 * Read YouTube player state from the page world and return only extraction data
 * needed by the isolated content script.
 */
(() => {
  const REQUEST = "AI_SUMMARY_REQUEST_YOUTUBE_PLAYER_DATA";
  const RESPONSE = "AI_SUMMARY_YOUTUBE_PLAYER_DATA";
  const CAPTION_REQUEST = "AI_SUMMARY_REQUEST_YOUTUBE_CAPTION_TEXT";
  const CAPTION_RESPONSE = "AI_SUMMARY_YOUTUBE_CAPTION_TEXT";
  const SOURCE = "ai-summary-extension";

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }

  function parseResponse(value) {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }

  function getCaptionTracks(response) {
    return response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
  }

  function getConfigValue(key) {
    try {
      return window.ytcfg?.get?.(key);
    } catch {
      return null;
    }
  }

  function findPlayerResponse(videoId) {
    const candidates = [];

    try {
      candidates.push(document.querySelector("#movie_player")?.getPlayerResponse?.());
    } catch { /* Player API is not available on every page state. */ }

    try {
      candidates.push(document.querySelector("ytd-player")?.getPlayerResponse?.());
    } catch { /* Player API is not available on every page state. */ }

    candidates.push(document.querySelector("ytd-watch-flexy")?.playerData);
    candidates.push(window.ytInitialPlayerResponse);
    candidates.push(window.ytplayer?.config?.args?.player_response);

    for (const candidate of candidates) {
      const response = parseResponse(candidate);
      if (videoId && response?.videoDetails?.videoId && response.videoDetails.videoId !== videoId) {
        continue;
      }
      const tracks = getCaptionTracks(response);
      if (Array.isArray(tracks) && tracks.length > 0) {
        return { response, tracks };
      }
    }
    return { response: null, tracks: null };
  }

  function getInnerTubeConfig() {
    const context = clone(getConfigValue("INNERTUBE_CONTEXT")) || {};
    const client = context.client || {};
    return {
      apiKey: getConfigValue("INNERTUBE_API_KEY") || null,
      client: {
        clientName: client.clientName || "WEB",
        clientVersion: client.clientVersion || getConfigValue("INNERTUBE_CLIENT_VERSION") || null,
        hl: client.hl || document.documentElement.lang || "en",
        gl: client.gl || null,
        visitorData: client.visitorData || getConfigValue("VISITOR_DATA") || null,
      },
      clientNameHeader: String(getConfigValue("INNERTUBE_CONTEXT_CLIENT_NAME") || "1"),
    };
  }

  function isAllowedCaptionUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" &&
        (parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com"));
    } catch {
      return false;
    }
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || message?.source !== SOURCE) {
      return;
    }

    if (message.type === REQUEST) {
      const playerData = findPlayerResponse(message.videoId);
      window.postMessage({
        source: SOURCE,
        type: RESPONSE,
        requestId: message.requestId,
        data: {
          captionTracks: clone(playerData.tracks),
          innerTube: getInnerTubeConfig(),
        },
      }, "*");
    }

    if (message.type === CAPTION_REQUEST && isAllowedCaptionUrl(message.url)) {
      fetch(message.url, { credentials: "include" }).then(async response => {
        const text = await response.text();
        window.postMessage({
          source: SOURCE,
          type: CAPTION_RESPONSE,
          requestId: message.requestId,
          data: {
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get("content-type") || "",
            text: text,
          },
        }, "*");
      }).catch(() => {
        window.postMessage({
          source: SOURCE,
          type: CAPTION_RESPONSE,
          requestId: message.requestId,
          data: { ok: false, status: 0, contentType: "", text: "" },
        }, "*");
      });
    }
  });
})();
