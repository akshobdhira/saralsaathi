/* SaralSaathi "Explain this notice" widget. No dependencies. All API data is inserted with textContent. */
(function () {
  "use strict";
  var me = document.currentScript;
  if (!me || window.SaralSaathi) return;
  var origin = new URL(me.src, location.href).origin;
  var key = me.getAttribute("data-api-key") || "";
  var lang = (me.getAttribute("data-lang") || "en").toLowerCase().slice(0, 2);
  var T = {
    en: ["Explain this notice", "Explaining…", "Close", "Read aloud", "Stop", "What this is", "What to do", "Dates", "Money", "Scam check", "Warnings", "Check the original document before paying or signing.", "Sorry, something went wrong. Please try again.", "Risk"],
    hi: ["इस सूचना को समझाएँ", "समझा रहे हैं…", "बंद करें", "पढ़कर सुनाएँ", "रोकें", "यह क्या है", "क्या करना है", "तारीखें", "पैसे", "धोखाधड़ी जाँच", "चेतावनी", "भुगतान या हस्ताक्षर से पहले मूल दस्तावेज़ जाँच लें।", "माफ़ कीजिए, कुछ गलत हुआ। फिर से कोशिश करें।", "खतरा"],
    kn: ["ಈ ಸೂಚನೆಯನ್ನು ವಿವರಿಸಿ", "ವಿವರಿಸುತ್ತಿದೆ…", "ಮುಚ್ಚಿ", "ಓದಿ ಹೇಳಿ", "ನಿಲ್ಲಿಸಿ", "ಇದು ಏನು", "ಏನು ಮಾಡಬೇಕು", "ದಿನಾಂಕಗಳು", "ಹಣ", "ವಂಚನೆ ಪರಿಶೀಲನೆ", "ಎಚ್ಚರಿಕೆಗಳು", "ಹಣ ಕಟ್ಟುವ ಅಥವಾ ಸಹಿ ಮಾಡುವ ಮೊದಲು ಮೂಲ ದಾಖಲೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.", "ಕ್ಷಮಿಸಿ, ಏನೋ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", "ಅಪಾಯ"],
    ta: ["இந்த அறிவிப்பை விளக்கு", "விளக்குகிறது…", "மூடு", "உரக்கப் படி", "நிறுத்து", "இது என்ன", "என்ன செய்ய வேண்டும்", "தேதிகள்", "பணம்", "மோசடி சோதனை", "எச்சரிக்கைகள்", "பணம் செலுத்தும் அல்லது கையெழுத்திடும் முன் அசல் ஆவணத்தைச் சரிபாருங்கள்.", "மன்னிக்கவும், ஏதோ தவறு. மீண்டும் முயலுங்கள்.", "ஆபத்து"]
  };
  var t = T[lang] || T.en;
  var SPEECH = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", ta: "ta-IN" };

  var css =
    ".ssw-btn{display:inline-flex;align-items:center;min-height:44px;min-width:44px;margin:8px 0;padding:8px 16px;font:600 16px/1.3 system-ui,sans-serif;color:#fff;background:#0b3d91;border:2px solid #0b3d91;border-radius:8px;cursor:pointer}" +
    ".ssw-btn:hover{background:#082c6b}.ssw-btn:focus-visible,.ssw-dlg button:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}" +
    ".ssw-dlg{max-width:min(40rem,calc(100vw - 32px));max-height:85vh;overflow:auto;padding:20px;border:2px solid #111;border-radius:12px;color:#111;background:#fff;font:17px/1.5 system-ui,sans-serif}" +
    ".ssw-dlg::backdrop{background:rgba(0,0,0,.6)}.ssw-dlg h2{font-size:22px;margin:0 0 12px}.ssw-dlg h3{font-size:18px;margin:16px 0 4px}" +
    ".ssw-dlg ul{margin:0;padding-left:20px}.ssw-note{margin-top:16px;padding:10px;border:2px solid #b00020;border-radius:8px;font-weight:600}" +
    ".ssw-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.ssw-dlg button{min-height:44px;padding:8px 16px;font:600 16px system-ui,sans-serif;border:2px solid #111;border-radius:8px;background:#fff;color:#111;cursor:pointer}" +
    "@media (prefers-color-scheme:dark){.ssw-dlg{color:#f2f2f2;background:#16181d;border-color:#f2f2f2}.ssw-dlg button{color:#f2f2f2;background:#16181d;border-color:#f2f2f2}.ssw-note{border-color:#ff8a80}.ssw-btn{background:#8ab4f8;color:#000;border-color:#8ab4f8}}" +
    "@media (prefers-reduced-motion:reduce){.ssw-btn,.ssw-dlg{transition:none;animation:none}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }

  var n = 0;
  var dlg = el("dialog", "ssw-dlg");
  dlg.lang = lang;
  dlg.setAttribute("aria-labelledby", "ssw-title");
  var title = el("h2", "", t[0]);
  title.id = "ssw-title";
  title.tabIndex = -1;
  var live = el("div");
  live.setAttribute("aria-live", "polite");
  var body = el("div");
  var row = el("div", "ssw-row");
  var readBtn = el("button", "", t[3]);
  readBtn.type = "button";
  var closeBtn = el("button", "", t[2]);
  closeBtn.type = "button";
  row.append(readBtn, closeBtn);
  dlg.append(title, live, body, row);
  var trigger = null, speech = "", speaking = false;

  function stopSpeech() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    speaking = false;
    readBtn.textContent = t[3];
  }
  readBtn.onclick = function () {
    if (!window.speechSynthesis || !speech) return;
    if (speaking) return stopSpeech();
    var u = new SpeechSynthesisUtterance(speech);
    u.lang = SPEECH[lang] || "en-IN";
    u.onend = u.onerror = stopSpeech;
    speaking = true;
    readBtn.textContent = t[4];
    speechSynthesis.speak(u);
  };
  closeBtn.onclick = function () { dlg.close(); };
  dlg.addEventListener("close", function () {
    stopSpeech();
    if (trigger) trigger.focus();
  });

  function section(h, items) {
    if (!items || !items.length) return;
    body.append(el("h3", "", h));
    var ul = el("ul");
    items.forEach(function (i) { ul.append(el("li", "", i)); });
    body.append(ul);
  }

  function render(r) {
    body.textContent = "";
    body.append(el("h3", "", t[5]), el("p", "", r.what_it_is));
    section(t[6], r.what_to_do);
    section(t[7], (r.deadlines || []).map(function (d) { return d.date + ": " + d.what; }));
    section(t[8], (r.amounts || []).map(function (a) { return a.value + ": " + a.what; }));
    if (r.fraud_check) section(t[9], [t[13] + ": " + r.fraud_check.risk + ". " + r.fraud_check.reason]);
    section(t[10], r.warnings);
    body.append(el("p", "ssw-note", t[11]));
    speech = r.speech_text || r.simple_text || "";
    readBtn.hidden = !speech || !window.speechSynthesis;
  }

  function explain(src) {
    trigger = src.btn;
    body.textContent = "";
    readBtn.hidden = true;
    live.textContent = t[1];
    if (!dlg.open) dlg.showModal();
    title.focus();
    var payload = { language: lang };
    if (src.url) payload.url = src.url; else payload.text = src.text;
    fetch(origin + "/api/v1/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error && j.error.message) || t[12]);
        render(j.result);
        live.textContent = t[0] + " ✓ " + (j.result.what_it_is || "");
      })
      .catch(function (e) {
        body.textContent = "";
        body.append(el("p", "", (e && e.message) || t[12]));
        live.textContent = t[12];
      });
  }

  function attach(target) {
    if (target.__ssw) return;
    target.__ssw = 1;
    var btn = el("button", "ssw-btn", t[0]);
    btn.type = "button";
    btn.id = "ssw-btn-" + ++n;
    btn.onclick = function () {
      explain({
        btn: btn,
        url: target.getAttribute("data-url"),
        text: target.getAttribute("data-text") || (target.textContent || "").trim()
      });
    };
    target.insertAdjacentElement("afterend", btn);
  }

  function scan() {
    if (!dlg.isConnected) document.body.append(dlg);
    document.querySelectorAll("[data-saralsaathi-explain]").forEach(attach);
  }
  /* Call SaralSaathi.scan() after adding new notices to the page (e.g. single-page apps). */
  window.SaralSaathi = { scan: scan };
  var init = scan;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
