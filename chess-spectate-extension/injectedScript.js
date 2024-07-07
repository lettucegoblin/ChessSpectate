setInterval(() => {
  let game = document.querySelector(".board").game;
  if (game) {
    //if(window.lastFen === game.fen) return;
    let fen = game.getFEN();
    window.lastFen = fen;
    sendToContentScript("fenFromPage", { fen });

    let markings = getAllMarkings();
    sendToContentScript("markingsFromPage", { markings });
  }
}, 1000);

function sendToContentScript(endpoint, data) {
  const event = new CustomEvent(endpoint, { detail: data });
  document.dispatchEvent(event);
}

function getAllMarkings() {
  let markings = [];
  let rawMarkings = document.querySelector(".board").game.markings.getAll();
  for (let marking of rawMarkings) {
    markings.push({
      from: marking.data.from,
      to: marking.data.to,
      type: marking.type,
      id: marking.id,
    });
  }
  return markings;
}
