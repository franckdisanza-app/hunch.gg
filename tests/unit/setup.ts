import "@testing-library/jest-dom/vitest";

// jsdom has no <dialog> modal API. This minimal stand-in keeps the `open` attribute and the
// `close` event behaving like browsers do; the real behaviour is covered by Playwright.
if (typeof window !== "undefined" && typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.show = proto.showModal;
    proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new Event("close"));
    };
  }
}
