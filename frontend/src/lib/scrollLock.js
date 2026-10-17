const FIXED_LOCK_SELECTOR = ".home-nav.is-scrolled, .back-to-top";

function getScrollbarWidth() {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

export function lockPageScroll() {
  const scrollbarWidth = getScrollbarWidth();
  const body = document.body;
  const html = document.documentElement;

  const snapshot = {
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    htmlPaddingRight: html.style.paddingRight,
    fixed: [],
  };

  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
    html.style.paddingRight = `${scrollbarWidth}px`;

    document.querySelectorAll(FIXED_LOCK_SELECTOR).forEach((node) => {
      snapshot.fixed.push({
        node,
        paddingRight: node.style.paddingRight,
      });
      node.style.paddingRight = `${scrollbarWidth}px`;
    });
  }

  return snapshot;
}

export function unlockPageScroll(snapshot) {
  if (!snapshot) return;

  const body = document.body;
  const html = document.documentElement;

  body.style.overflow = snapshot.bodyOverflow;
  body.style.paddingRight = snapshot.bodyPaddingRight;
  html.style.paddingRight = snapshot.htmlPaddingRight;

  snapshot.fixed.forEach(({ node, paddingRight }) => {
    node.style.paddingRight = paddingRight;
  });
}
