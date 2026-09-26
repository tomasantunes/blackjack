(function () {
  "use strict";

  var balance = 1000;
  var wager = 50;
  var activeWager = 0;
  var gameState = "betting";
  var deck;
  var dealerHand;
  var playerHand;
  var holeCard;

  var balanceEl = document.getElementById("balance");
  var betAmountEl = document.getElementById("bet-amount");
  var dealerScoreEl = document.getElementById("dealer-score");
  var playerScoreEl = document.getElementById("player-score");
  var messageEl = document.getElementById("table-message");
  var dealButton = document.getElementById("deal");
  var hitButton = document.getElementById("hit");
  var standButton = document.getElementById("stand");
  var doubleButton = document.getElementById("double");
  var chipButtons = Array.prototype.slice.call(document.querySelectorAll(".chip"));

  cards.init({
    table: "#card-table",
    type: STANDARD,
    cardsUrl: "libs/cardsjs/img/cards.png",
    cardback: "red",
    animationSpeed: 240
  });

  deck = new cards.Deck({ faceUp: false });
  dealerHand = new cards.Hand({ faceUp: true });
  playerHand = new cards.Hand({ faceUp: true });
  deck.addCards(cards.all);

  function money(amount) {
    return "$" + amount.toLocaleString("en-US");
  }

  function handValue(hand) {
    var total = 0;
    var aces = 0;
    for (var i = 0; i < hand.length; i++) {
      var rank = hand[i].rank;
      if (rank === 1) {
        aces++;
        total += 11;
      } else {
        total += Math.min(rank, 10);
      }
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  function isBlackjack(hand) {
    return hand.length === 2 && handValue(hand) === 21;
  }

  function positionTable(immediate) {
    var table = document.getElementById("card-table");
    var width = table.clientWidth;
    var height = table.clientHeight;
    deck.x = Math.max(60, Math.min(90, width * 0.11));
    deck.y = height / 2;
    dealerHand.x = width / 2;
    dealerHand.y = Math.max(105, height * 0.27);
    playerHand.x = width / 2;
    playerHand.y = Math.min(height - 95, height * 0.73);
    deck.render({ immediate: immediate });
    dealerHand.render({ immediate: immediate });
    playerHand.render({ immediate: immediate });
    concealHoleCard();
  }

  function concealHoleCard() {
    if (holeCard && gameState === "playing") {
      holeCard.hideCard();
    }
  }

  function setMessage(kicker, title, visible) {
    messageEl.querySelector("span").textContent = kicker;
    messageEl.querySelector("strong").textContent = title;
    messageEl.classList.toggle("hidden", visible === false);
  }

  function updateScores(revealDealer) {
    playerScoreEl.textContent = playerHand.length ? handValue(playerHand) : "—";
    if (!dealerHand.length) {
      dealerScoreEl.textContent = "—";
    } else if (revealDealer) {
      dealerScoreEl.textContent = handValue(dealerHand);
    } else {
      var visibleCards = dealerHand.filter(function (card) { return card !== holeCard; });
      dealerScoreEl.textContent = handValue(visibleCards) + " + ?";
    }
  }

  function updateControls() {
    var playing = gameState === "playing";
    var canDouble = playing && playerHand.length === 2 && balance >= activeWager;
    hitButton.disabled = !playing;
    standButton.disabled = !playing;
    doubleButton.disabled = !canDouble;
    dealButton.disabled = gameState === "dealing" || gameState === "dealer" || balance < wager;
    dealButton.textContent = gameState === "over" ? "Deal again" : "Deal cards";
    dealButton.hidden = playing || gameState === "dealing" || gameState === "dealer";
    chipButtons.forEach(function (button) {
      var amount = Number(button.dataset.bet);
      button.disabled = gameState === "playing" || gameState === "dealing" || gameState === "dealer" || amount > balance;
      button.classList.toggle("selected", amount === wager);
    });
    balanceEl.textContent = money(balance);
    betAmountEl.textContent = money(wager);
  }

  function moveCard(target, callback) {
    if (!deck.length) return;
    target.addCard(deck.topCard());
    target.render({
      speed: 210,
      callback: function () {
        concealHoleCard();
        updateScores(false);
        if (callback) callback();
      }
    });
  }

  function clearHands() {
    while (dealerHand.length) deck.addCard(dealerHand.topCard());
    while (playerHand.length) deck.addCard(playerHand.topCard());
    holeCard = null;
    cards.shuffle(deck);
    deck.render({ immediate: true });
    dealerHand.render({ immediate: true });
    playerHand.render({ immediate: true });
  }

  function startRound() {
    if (gameState === "playing" || balance < wager) return;
    clearHands();
    activeWager = wager;
    balance -= activeWager;
    gameState = "dealing";
    setMessage("Good luck", "Dealing…", true);
    updateScores(false);
    updateControls();

    moveCard(playerHand, function () {
      moveCard(dealerHand, function () {
        holeCard = dealerHand[0];
        concealHoleCard();
        moveCard(playerHand, function () {
          moveCard(dealerHand, finishInitialDeal);
        });
      });
    });
  }

  function finishInitialDeal() {
    gameState = "playing";
    concealHoleCard();
    updateScores(false);
    setMessage("Your move", "Hit, stand, or double", false);
    updateControls();

    if (isBlackjack(playerHand) || isBlackjack(dealerHand)) {
      window.setTimeout(finishNaturals, 300);
    }
  }

  function finishNaturals() {
    revealDealer();
    if (isBlackjack(playerHand) && isBlackjack(dealerHand)) {
      finishRound("push", "Both have Blackjack", "Push");
    } else if (isBlackjack(playerHand)) {
      finishRound("blackjack", "Blackjack!", "You win 3 to 2");
    } else {
      finishRound("lose", "Dealer has Blackjack", "Dealer wins");
    }
  }

  function hit() {
    if (gameState !== "playing") return;
    doubleButton.disabled = true;
    moveCard(playerHand, function () {
      var value = handValue(playerHand);
      updateScores(false);
      if (value > 21) {
        revealDealer();
        finishRound("lose", "Bust — " + value, "Dealer wins");
      } else if (value === 21) {
        stand();
      }
    });
  }

  function doubleDown() {
    if (gameState !== "playing" || playerHand.length !== 2 || balance < activeWager) return;
    balance -= activeWager;
    activeWager *= 2;
    betAmountEl.textContent = money(activeWager);
    updateControls();
    moveCard(playerHand, function () {
      if (handValue(playerHand) > 21) {
        revealDealer();
        finishRound("lose", "Bust — " + handValue(playerHand), "Dealer wins");
      } else {
        stand();
      }
    });
  }

  function revealDealer() {
    gameState = "dealer";
    if (holeCard) holeCard.showCard();
    dealerHand.render();
    updateScores(true);
    updateControls();
  }

  function stand() {
    if (gameState !== "playing") return;
    revealDealer();
    setMessage("Dealer's turn", "Dealer reveals", true);
    window.setTimeout(dealerPlay, 420);
  }

  function dealerPlay() {
    var value = handValue(dealerHand);
    updateScores(true);
    if (value < 17) {
      moveCard(dealerHand, function () {
        if (holeCard) holeCard.showCard();
        updateScores(true);
        window.setTimeout(dealerPlay, 280);
      });
      return;
    }

    var playerValue = handValue(playerHand);
    if (value > 21) {
      finishRound("win", "Dealer busts — " + value, "You win");
    } else if (value > playerValue) {
      finishRound("lose", "Dealer wins " + value + " to " + playerValue, "Better luck next hand");
    } else if (value < playerValue) {
      finishRound("win", "You win " + playerValue + " to " + value, "Well played");
    } else {
      finishRound("push", "Push at " + value, "Your wager is returned");
    }
  }

  function finishRound(result, title, detail) {
    if (result === "blackjack") balance += activeWager * 2.5;
    if (result === "win") balance += activeWager * 2;
    if (result === "push") balance += activeWager;
    gameState = "over";
    updateScores(true);
    setMessage(detail, title, true);

    if (balance === 0) {
      wager = 0;
      dealButton.textContent = "Bankroll empty";
    } else if (wager > balance) {
      var affordable = [250, 100, 50, 25].filter(function (amount) { return amount <= balance; });
      wager = affordable.length ? affordable[0] : balance;
    }
    updateControls();
  }

  chipButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      wager = Number(button.dataset.bet);
      updateControls();
    });
  });

  dealButton.addEventListener("click", startRound);
  hitButton.addEventListener("click", hit);
  standButton.addEventListener("click", stand);
  doubleButton.addEventListener("click", doubleDown);
  document.getElementById("reset-bankroll").addEventListener("click", function () {
    if (gameState === "playing" || gameState === "dealing" || gameState === "dealer") return;
    balance = 1000;
    wager = 50;
    activeWager = 0;
    gameState = "betting";
    clearHands();
    updateScores(false);
    setMessage("Table open", "Place your bet", true);
    updateControls();
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () { positionTable(true); }, 80);
  });

  positionTable(true);
  updateScores(false);
  updateControls();
})();
