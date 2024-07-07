setInterval(() => {
  let game = document.querySelector('.board').game;
  //console.log(game, window.lastFen === game.getFEN());
  if (game) {
      //if(window.lastFen === game.fen) return;
      let fen = game.getFEN();
      window.lastFen = fen
      const event = new CustomEvent('fenFromPage', { detail: { fen: fen } });
      document.dispatchEvent(event);
  }
}, 1000);