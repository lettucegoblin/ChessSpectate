let ourMarkings = [];
let notOurMarkings = [];
let eventsAdded = false;

function addEvents(){
  let board = document.querySelector(".board");
  board.addEventListener("mouseup", () => {
    console.log("mousemouse up");
    drawMarkings(notOurMarkings);
  });

  eventsAdded = true;
}
function handleFen(){
  let game = document.querySelector(".board").game;
  let state = JSON.parse(
    JSON.stringify(document.querySelector(".board").state)
  );
  let fen = game.getFEN();

  window.lastFen = fen;
  sendToContentScript("fenFromPage", { fen, state });
}

function handleMarkings(){
  let markings = getAllMarkings(); // our markings
  if (isThereAnyMarkingChange(markings)) {
    ourMarkings = markings;
    sendToContentScript("markingsFromPage", { markings });
  }
}

setInterval(() => {
  let game = document.querySelector(".board").game;
  if (game) {
    if(!eventsAdded) addEvents();
    handleFen();
    handleMarkings();
  } 
}, 700);

function isThereAnyMarkingChange(markings) {
  if (ourMarkings.length !== markings.length) return true;

  for (let i = 0; i < markings.length; i++) {
    if (
      ourMarkings[i].from !== markings[i].from ||
      ourMarkings[i].to !== markings[i].to
    ) {
      return true;
    }
  }

  return false;
}
function sendToContentScript(endpoint, data) {
  const event = new CustomEvent(endpoint, { detail: data });
  document.dispatchEvent(event);
}

function getAllMarkings() {
  let markings = [];
  let rawMarkings = document.querySelector(".board").game.markings.getAll();
  for (let marking of rawMarkings) {
    if (typeof marking.node == "string")
      // node is an id of another user not us.
      continue;

    if (marking.type === "arrow") {
      markings.push({
        from: marking.data.from,
        to: marking.data.to,
        type: marking.type,
      });
    } else if (marking.type === "highlight") {
      markings.push({
        highlight: marking.data.square,
        type: marking.type,
      });
    }
  }
  return markings;
}

document.addEventListener("markingsFromBackground", function (e) {
  console.log("Markings from background:", e.detail.markings);

  let markings = e.detail.markings;
  notOurMarkings = markings;
  drawMarkings(markings);
});

function drawMarkings(markings) {
  for (let marking of markings) {
    clearMarkingsById(marking.from_id);
  }
  if (!markings.length) {
    clearAllNotMeMarkings();
  }

  for (let marking of markings) {
    if (marking.type === "highlight") {
      addHighlight(marking.highlight, marking.from_id);
    } else if (marking.type === "arrow") {
      addArrow(marking.from, marking.to, marking.from_id);
    }
  }
}

function clearAllNotMeMarkings() {
  let game = document.querySelector(".board").game;
  let markings = game.markings.getAll();
  for (let marking of markings) {
    if (typeof marking.node == "string") {
      game.markings.removeOne(marking.key);
    }
  }
}

function clearMarkingsById(id) {
  let game = document.querySelector(".board").game;
  let markings = game.markings.getAll();
  for (let marking of markings) {
    if (marking.node == id) {
      game.markings.removeOne(marking.key); //game.markings.removeOne('arrow|f4e4')
    }
  }
}

function isArrowAlreadyAdded(from, to, from_id) {
  let game = document.querySelector(".board").game;
  let markings = game.markings.getAll();
  for (let marking of markings) {
    if (
      marking.data.from === from &&
      marking.data.to === to &&
      marking.node === from_id
    ) {
      return true;
    }
  }
  return false;
}

function addArrow(from, to, from_id) {
  if (isArrowAlreadyAdded(from, to, from_id)) return;
  let game = document.querySelector(".board").game;

  let arrow = game.markings.factory.buildStandardArrow(from, to);
  arrow.node = from_id;
  arrow.data.opacity = 0.4;

  game.markings.addOne(arrow);
}

function addHighlight(highlight, from_id) {
  let game = document.querySelector(".board").game;

  let highlightMarking =
    game.markings.factory.buildStandardAnalysisHighlight(highlight);
  highlightMarking.node = from_id;
  game.markings.addOne(highlightMarking);
}
