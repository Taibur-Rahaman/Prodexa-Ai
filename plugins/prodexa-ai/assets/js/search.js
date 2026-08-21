(function () {
  "use strict";

  var config = window.prodexaAiSearch || {};

  function text(value) {
    return typeof value === "string" ? value : "";
  }

  function i18n(key) {
    return text(config.i18n && config.i18n[key] ? config.i18n[key] : key);
  }

  function safeHttpUrl(value) {
    if (typeof value !== "string" || value === "") {
      return "";
    }
    try {
      var parsed = new URL(value, window.location.origin);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return "";
      }
      if (parsed.username || parsed.password) {
        return "";
      }
      return parsed.href;
    } catch (error) {
      return "";
    }
  }

  function formatPrice(amount, currency) {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      return "";
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency,
      }).format(amount);
    } catch (error) {
      return String(amount) + " " + currency;
    }
  }

  function formatPageLabel(page) {
    return i18n("page").replace("%s", String(page));
  }

  function availabilityLabel(code) {
    if (code === "in_stock" || code === "out_of_stock" || code === "preorder" || code === "unknown") {
      return i18n(code);
    }
    return i18n("unknown");
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function setStatus(root, message, state) {
    var status = root.querySelector("[data-prodexa-status]");
    if (!status) {
      return;
    }
    status.textContent = message;
    if (state) {
      status.setAttribute("data-state", state);
      status.setAttribute("role", state === "error" ? "alert" : "status");
    } else {
      status.removeAttribute("data-state");
      status.setAttribute("role", "status");
    }
  }

  function renderCard(offer) {
    var card = document.createElement("article");
    card.className = "prodexa-ai-search__card";
    card.setAttribute("data-offer-id", text(offer.offer_id));

    var media = document.createElement("div");
    media.className = "prodexa-ai-search__media";
    var imageUrl = safeHttpUrl(offer.image_url);
    if (imageUrl) {
      var image = document.createElement("img");
      image.src = imageUrl;
      image.alt = text(offer.title);
      image.loading = "lazy";
      media.appendChild(image);
    } else {
      media.textContent = i18n("image_unavailable");
    }
    card.appendChild(media);

    var title = document.createElement("h3");
    title.className = "prodexa-ai-search__title";
    title.textContent = text(offer.title);
    card.appendChild(title);

    var price = document.createElement("p");
    price.className = "prodexa-ai-search__price";
    price.textContent = formatPrice(offer.display_price, text(offer.currency));
    card.appendChild(price);

    var meta = document.createElement("p");
    meta.className = "prodexa-ai-search__meta";
    var freshness = offer.freshness && typeof offer.freshness.retrieved_at === "string"
      ? offer.freshness.retrieved_at
      : "";
    meta.textContent = availabilityLabel(offer.availability) + (freshness ? " · " + freshness : "");
    card.appendChild(meta);

    return card;
  }

  function renderResults(root, payload) {
    var resultsNode = root.querySelector("[data-prodexa-results]");
    var pager = root.querySelector("[data-prodexa-pager]");
    if (!resultsNode || !pager) {
      return;
    }
    clearNode(resultsNode);
    clearNode(pager);

    var results = Array.isArray(payload.results) ? payload.results : [];
    results.forEach(function (offer) {
      if (!offer || typeof offer !== "object") {
        return;
      }
      resultsNode.appendChild(renderCard(offer));
    });

    var page = typeof payload.page === "number" ? payload.page : 1;
    var limit = typeof payload.limit === "number" ? payload.limit : Number(root.getAttribute("data-limit") || 10);
    var count = payload.meta && typeof payload.meta.count === "number" ? payload.meta.count : results.length;
    var hasPrev = page > 1;
    var hasNext = count >= limit;

    if (!hasPrev && !hasNext) {
      pager.hidden = true;
      return;
    }

    pager.hidden = false;

    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "prodexa-ai-search__page";
    prev.textContent = i18n("previous");
    prev.disabled = !hasPrev;
    prev.setAttribute("data-prodexa-page", String(page - 1));
    pager.appendChild(prev);

    var label = document.createElement("span");
    label.className = "prodexa-ai-search__page-label";
    label.textContent = formatPageLabel(page);
    pager.appendChild(label);

    var next = document.createElement("button");
    next.type = "button";
    next.className = "prodexa-ai-search__page";
    next.textContent = i18n("next");
    next.disabled = !hasNext;
    next.setAttribute("data-prodexa-page", String(page + 1));
    pager.appendChild(next);
  }

  function init(root) {
    var form = root.querySelector("[data-prodexa-form]");
    var input = root.querySelector("[data-prodexa-query]");
    var submit = form ? form.querySelector('button[type="submit"]') : null;
    var pager = root.querySelector("[data-prodexa-pager]");
    if (!form || !input) {
      return;
    }

    var inFlight = false;
    var lastQuery = "";

    function setBusy(busy) {
      inFlight = busy;
      root.setAttribute("aria-busy", busy ? "true" : "false");
      input.disabled = busy;
      if (submit) {
        submit.disabled = busy;
      }
    }

    function search(page) {
      var query = String(input.value || "").trim();
      if (query === "" || inFlight) {
        return;
      }
      lastQuery = query;
      setBusy(true);
      setStatus(root, i18n("loading"), "loading");

      var body = new URLSearchParams();
      body.set("action", text(config.action));
      body.set("nonce", text(config.nonce));
      body.set("query", query);
      body.set("page", String(page));
      body.set("limit", root.getAttribute("data-limit") || "10");

      fetch(text(config.ajaxUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        credentials: "same-origin",
        body: body.toString(),
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (json) {
          setBusy(false);
          if (!json || json.success !== true || !json.data) {
            var message = json && json.data && json.data.message ? json.data.message : i18n("error");
            setStatus(root, message, "error");
            renderResults(root, { results: [], page: page, limit: Number(root.getAttribute("data-limit") || 10), meta: { count: 0 } });
            return;
          }
          var payload = json.data;
          payload.page = typeof payload.page === "number" ? payload.page : page;
          payload.limit = typeof payload.limit === "number" ? payload.limit : Number(root.getAttribute("data-limit") || 10);
          if (!payload.results || payload.results.length === 0) {
            setStatus(root, i18n("empty"), "empty");
          } else {
            setStatus(root, "", "");
          }
          renderResults(root, payload);
        })
        .catch(function () {
          setBusy(false);
          setStatus(root, i18n("error"), "error");
        });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      search(1);
    });

    if (pager) {
      pager.addEventListener("click", function (event) {
        var button = event.target.closest("[data-prodexa-page]");
        if (!button || button.disabled) {
          return;
        }
        var nextPage = Number(button.getAttribute("data-prodexa-page") || "0");
        if (!Number.isInteger(nextPage) || nextPage < 1) {
          return;
        }
        if (lastQuery) {
          input.value = lastQuery;
        }
        search(nextPage);
      });
    }
  }

  function start() {
    document.querySelectorAll("[data-prodexa-search]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
