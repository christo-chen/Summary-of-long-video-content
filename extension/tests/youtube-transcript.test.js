const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const extractorPath = path.join(__dirname, "../content/extractors/youtube.js");

class FakeNode {
  constructor({ tagName = "div", textContent = "", className = "", attrs = {}, children = [] } = {}) {
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    this.className = className;
    this.attrs = attrs;
    this.children = children;
  }

  getAttribute(name) {
    return this.attrs[name] || "";
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const descendants = this._descendants();
    if (selector === ".segment-timestamp") {
      return descendants.filter(node => node.className === "segment-timestamp");
    }
    if (selector === ".segment-text") {
      return descendants.filter(node => node.className === "segment-text");
    }
    if (selector === "span.ytAttributedStringHost") {
      return descendants.filter(node => (
        node.tagName === "SPAN" && node.className === "ytAttributedStringHost"
      ));
    }
    if (selector === "*") {
      return descendants;
    }
    if (selector === "button") {
      return descendants.filter(node => node.tagName === "BUTTON");
    }
    return [];
  }

  _descendants() {
    const nodes = [];
    const visit = (node) => {
      for (const child of node.children) {
        nodes.push(child);
        visit(child);
      }
    };
    visit(this);
    return nodes;
  }
}

function oldSegment(timestamp, text) {
  return new FakeNode({
    tagName: "ytd-transcript-segment-renderer",
    textContent: timestamp + " " + text,
    children: [
      new FakeNode({ className: "segment-timestamp", textContent: timestamp }),
      new FakeNode({ className: "segment-text", textContent: text }),
    ],
  });
}

function newSegment(timestamp, text) {
  return new FakeNode({
    tagName: "transcript-segment-view-model",
    textContent: timestamp + " " + text,
    children: [
      new FakeNode({ tagName: "span", className: "ytAttributedStringHost", textContent: timestamp }),
      new FakeNode({ tagName: "span", className: "ytAttributedStringHost", textContent: text }),
    ],
  });
}

function fakeDocument({ oldSegments = [], newSegments = [] } = {}) {
  return {
    title: "Test Video - YouTube",
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "ytd-transcript-segment-renderer") return oldSegments;
      if (selector === "transcript-segment-view-model") return newSegments;
      if (selector === "ytd-transcript-segment-renderer,transcript-segment-view-model" ||
          selector === "ytd-transcript-segment-renderer, transcript-segment-view-model") {
        return oldSegments.concat(newSegments);
      }
      return [];
    },
    createElement() {
      return { innerHTML: "", value: "" };
    },
  };
}

function loadExtractor(document = fakeDocument()) {
  const source = fs.readFileSync(extractorPath, "utf8");
  const sandbox = {
    console: { debug() {}, warn() {} },
    document,
    window: { location: { href: "https://www.youtube.com/watch?v=test-video" } },
    URL,
    DOMParser: class {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    MouseEvent: class {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => { throw new Error("fetch should not run in unit tests"); },
  };
  vm.runInNewContext(source + "\nglobalThis.YoutubeExtractor = YoutubeExtractor;", sandbox);
  return sandbox.YoutubeExtractor;
}

test("deduplicates old transcript double buffer by timestamp and text while preserving real repeated lines", () => {
  const firstPass = [
    oldSegment("0:01", "Stay Hungry."),
    oldSegment("0:02", "Don't settle."),
    oldSegment("0:03", "Stay Hungry."),
  ];
  const document = fakeDocument({ oldSegments: firstPass.concat(firstPass) });
  const extractor = loadExtractor(document);

  const transcript = extractor._readTranscriptSegments();

  assert.equal(transcript.selector, "ytd-transcript-segment-renderer");
  assert.deepEqual(Array.from(transcript.lines), [
    "Stay Hungry.",
    "Don't settle.",
    "Stay Hungry.",
  ]);
});

test("uses old transcript selector when only old UI segments exist", () => {
  const extractor = loadExtractor(fakeDocument({
    oldSegments: [oldSegment("0:01", "Old UI line")],
  }));

  const transcript = extractor._readTranscriptSegments();

  assert.equal(transcript.selector, "ytd-transcript-segment-renderer");
  assert.deepEqual(Array.from(transcript.lines), ["Old UI line"]);
});

test("falls back to new transcript selector when only new UI segments exist", () => {
  const extractor = loadExtractor(fakeDocument({
    newSegments: [newSegment("0:01", "New UI line")],
  }));

  const transcript = extractor._readTranscriptSegments();

  assert.equal(transcript.selector, "transcript-segment-view-model");
  assert.deepEqual(Array.from(transcript.lines), ["New UI line"]);
});

test("returns null when no transcript segment selector matches", () => {
  const extractor = loadExtractor(fakeDocument());

  assert.equal(extractor._readTranscriptSegments(), null);
});

test("records no-entry failure code when no transcript opener is found", async () => {
  const extractor = loadExtractor();
  extractor._resetTranscriptPanelBeforeOpen = async () => {};
  extractor._openTranscriptPanel = async () => null;
  extractor._closeTranscriptPanel = () => {};

  const transcript = await extractor.getTranscript("test-video");

  assert.equal(transcript, null);
  assert.equal(extractor.lastFailureReason, extractor.FAILURE_REASONS.TRANSCRIPT_BUTTON_NOT_FOUND);
});

test("records timeout failure code when an opener exists but segments do not stabilize", async () => {
  const extractor = loadExtractor();
  extractor._resetTranscriptPanelBeforeOpen = async () => {};
  extractor._openTranscriptPanel = async () => {
    extractor.lastOpenTranscriptFailureReason = extractor.FAILURE_REASONS.TRANSCRIPT_PANEL_TIMEOUT;
    return null;
  };
  extractor._closeTranscriptPanel = () => {};

  const transcript = await extractor.getTranscript("test-video");

  assert.equal(transcript, null);
  assert.equal(extractor.lastFailureReason, extractor.FAILURE_REASONS.TRANSCRIPT_PANEL_TIMEOUT);
});

test("records empty-panel failure code when opened panel has no readable lines", async () => {
  const extractor = loadExtractor();
  extractor._resetTranscriptPanelBeforeOpen = async () => {};
  extractor._openTranscriptPanel = async () => new FakeNode({ tagName: "button" });
  extractor._readTranscriptSegments = () => ({ selector: "ytd-transcript-segment-renderer", lines: [] });
  extractor._closeTranscriptPanel = () => {};

  const transcript = await extractor.getTranscript("test-video");

  assert.equal(transcript, null);
  assert.equal(extractor.lastFailureReason, extractor.FAILURE_REASONS.TRANSCRIPT_PANEL_EMPTY);
});

test("does not overwrite specific getTranscript failure with generic unavailable code", async () => {
  const extractor = loadExtractor();
  extractor.getTranscript = async () => {
    extractor._recordFailure(extractor.FAILURE_REASONS.TRANSCRIPT_PANEL_TIMEOUT);
    return null;
  };

  const subtitle = await extractor._fetchSubtitle("test-video");

  assert.equal(subtitle, null);
  assert.equal(extractor.lastFailureReason, extractor.FAILURE_REASONS.TRANSCRIPT_PANEL_TIMEOUT);
});
