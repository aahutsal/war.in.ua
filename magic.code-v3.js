(function __geminiTool() {
  // 0) Destroy previous injected instance (if re-pasted)
  if (window.__geminiTool?.destroy) {
      try { window.__geminiTool.destroy(); } catch (_) { }
  }
  // 1) Persistent stats (survives re-paste)
    window.__geminiSession = window.__geminiSession || { input: 0, output: 0, thinking: 0 };
    window.totalSession = window.totalSession || { input: 0, output: 0, thinking: 0 };

  // 2) Stable runtime state
  const state = {
    destroyed: false,
    cleanup: [],
    observers: [],
    timers: new Set(),
    isCtrlPressed: false,
    autoClickRunning: false,
    correctInFlight: false,
    transcribeBtn: null
  };

  // 3) Config
  const SELECTORS = {
    // NOTE:ано замінити на стабільні data-testid, якщо доступно.
    transcribeBtn:
      "#root > div > main > div > " +
      "div.recordsGrid__playlist > div > " +
      "div.FilteredPlaylist__playlist > " +
      "div.FilteredPlaylist__playlistScroller > " +
      "div > div > div > div > div > div > " +
      "div.RecordCard__firstLine_right > button:nth-child(2)",

    callsignSpans:
      "#root > div > main > div > " +
      "div.recordsGrid__form > div.recordsGrid__formScroller > " +
      "div > div > div > p.MuiTypography-root.MuiTypography-body1.css-9l3uo3 > span",

    mainTextarea: "textarea"
  };

  const MODELS = {
    GEMINI_3_1_PRO: "gemini-3.1-pro-preview",
    GEMINI_3_1_FLASH: "gemini-3.1-flash-preview",
    GEMINI_3_1_FLASH_LITE: "gemini-3.1-flash-lite-preview",
    GEMINI_2_5_PRO: "gemini-2.5-pro",
    GEMINI_2_5_FLASH: "gemini-2.5-flash",
    GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
    GEMINI_1_5_PRO: "gemini-1.5-pro",
    GEMINI_1_5_FLASH: "gemini-1.5-flash",
    GEMINI_1_5_FLASH_8B: "gemini-1.5-flash-8b"
  };

    const PRICES = {
        // Моделі 3.1: Вихідні токени дорожчі через високу якість генерації
        [MODELS.GEMINI_3_1_PRO]: { input: 2.00, output: 12.00, thinking: 12.00 },
        [MODELS.GEMINI_3_1_FLASH]: { input: 0.50, output: 3.00, thinking: 3.00 },
        [MODELS.GEMINI_3_1_FLASH_LITE]: { input: 0.25, output: 1.50, thinking: 1.50 },

        // Моделі 2.5: Золотий стандарт ціна/якість
        [MODELS.GEMINI_2_5_PRO]: { input: 1.25, output: 10.00, thinking: 1.25 },
        [MODELS.GEMINI_2_5_FLASH]: { input: 0.30, output: 2.50, thinking: 0.30 },
        [MODELS.GEMINI_2_5_FLASH_LITE]: { input: 0.10, output: 0.40, thinking: 0.10 },

        // Моделі 1.5: Найбільш економні для масової обробки тексту
        [MODELS.GEMINI_1_5_PRO]: { input: 1.25, output: 5.00, thinking: 0 }, // Мислення не підтримується
        [MODELS.GEMINI_1_5_FLASH]: { input: 0.075, output: 0.30, thinking: 0 },
        [MODELS.GEMINI_1_5_FLASH_8B]: { input: 0.0375, output: 0.15, thinking: 0 }
    };

  const MODEL = MODELS.GEMINI_3_1_FLASH_LITE;
  const PRICE = PRICES[MODEL];

  const GEMINI_KEY_STORAGE = "gemini_api_key";
  function getStoredApiKey() {
      return localStorage.getItem(GEMINI_KEY_STORAGE);
  }
  function setStoredApiKey(key) {
      if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key);
  }

  let geminiApiKey = getStoredApiKey() || window.GEMINI_API_KEY;
	if (!geminiApiKey) {
		geminiApiKey = prompt("Enter your Gemini API Key:");
		setStoredApiKey(geminiApiKey);
	}
  window.GEMINI_API_KEY = geminiApiKey || "";

	let knownCallsigns = "АБРАМ, АГЛАР, КРАСНЫЙ, ТОР, ПЯТИЙ, ПЕРС, ПАУК, ТОПОЛЬ";
	let specialWords = "циркулярно,Костлявая,Старя,не прошло,повтори,180,200,300,350";

  const SYSTEM_INSTRUCTION = `Ти — коректор військових радіоперехоплень в російсько-українській війні 2022 року, котрий воює на стороні Сил Оборони України (СОУ).
ЗАВДАННЯ ТА ОБМЕЖЕННЯ:
Правила для ДІАЛОГУ:
1. Зроби виправлення чорнового діалогу, використовуюи аудіофайли (російська мова). Спочатку прослухай файли, далі роби виправлення в тексті. Назва файлу містить часову мітку, номера: мережі, радіостанції та абонента.
2. Текст ТІЛЬКИ російською мовою. Використовуй ПОЗИВНІ в правильному відмінк.
3. Не додумуй нічого, якщо щось не зрозуміло, використовуй ... (три крапки) для позначення незрозумілих слів або фраз.
4. Правила встановлення зв'язку:
  - "База, База Чёрному": військовослужбовець (в/сл) Чёрный викликає в/сл База
  - "Слон, Слон Базе связь, Слон": в/сл База викликає в/сл Слон
5. Числа: всі числові значення повинні бути записані виключно цифрами. Текст - зберігаючи граматику української мови,
6. позивні: всі позивні в тексті повинні бути записані ВЕЛИКИМИ ЛТЕРАМИ.
7. Використовуй загальновідомі військові скорочення.
8. Додай короткий ВИСНОВОК українською мовою. Формат: лаконічний (максимум 2 речення). Ситль: військовий. 
СКОРОЧЕННЯ: Старая, Костлявая, Яга, Баба Яга (вантажне БпЛА СОУ), ждун (БпЛА, що знаходиться на землі в режимі очікування), опта (БпЛА на оптоволокні); борт (БпЛА йм. РОВ); <цифровий код з позначенням напрямку переміщення>, наприклад "450 на восток" або "72й с запада" - (різні типи БпЛА СОУ); союзы (союзні підрозділи РОВ); фипик, фипка, одноразка, камикадзе (БпЛА типу FPV); малый (хвилина, наприклад 15 малых - 15 хвилин), большой - година (через 2 большых - через 2 години); осдаки (вогневий вплив СОУ); В КОНТЕКСТІ ОБСТРІЛУ: слон, хобот (танк СОУ); рубль 20 (міномет 120мм). В КОНТЕКСТІ ЗАСОБІВ ЗВ'ЯЗКУ: тутка (радіостанція TYT), хитера (радіостанція Hytera), мотор (радіостанція Motorolla), бафик (радіостанція Baofeng);
Правила для ВИСНОВКУ:
  - Висновок генеруй українською мовою (крім позивних, позивні російською, як в тексті)
  - Вживай скорочення.
  - Вживай минулий час, чоловічий рід: (доповідав, переміщував, запитував, і т.д. і т.п.).
  - Не вживай "ворожий", "ворог", "противник". Ти воюєш на стороні СОУ та слухаєш переговори РОВ (Російський Окупаційних Військ).
  - Коли вонни згадують про нас, вживай "СОУ".
  - Суть обговорення: що саме координується або про що доповідають.
  - Геолокації: якщо згадуються назви позицій, лісосмуг або номери точок — ОБОВ'ЯЗКОВО вказуй у висновку.
  - НЕ роби припущень і не додавай аналітичних висновків.
  - Вживай тільки офіційні скорочення в/сл, о/с, СОУ, РОВ, БпЛА. Не вживай сленгових: фипик,старая, рублль 20
  - НЕ вживай висновків типу "координували обстріл", "планували наступ", "здійснили розвідку". ВИСНОВОК має бути максимально нейтральним та фактичним, без додумування.

Відповідай ТІЛЬКИ валідним JSON:
{
  "transcription": "correct dialogue here",
  "conclusion": "military assessment here",
  "callsigns": ["list", "of", "callsigns"]
}

`;

  // 4) Helpers
  const rootNode = document.querySelector("#root") || document.body;

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    state.cleanup.push(() => target.removeEventListener(type, fn, opts));
  };

  const observe = (target, cb, opts) => {
    const mo = new MutationObserver(cb);
    mo.observe(target, opts);
    state.observers.push(mo);
  };

  const debounce = (fn, ms = 120) => {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
      state.timers.add(t);
    };
  };

  const delay = (ms) => new Promise((resolve) => {
    const t = setTimeout(() => {
      state.timers.delete(t);
      resolve();
    }, ms);
    state.timers.add(t);
  });

  const setReactTextarea = (textarea, value) => {
    if (!textarea) return;
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    desc?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const safeGet = (obj, path, fallback = undefined) => {
    try {
      return path.split(".").reduce((acc, k) => acc?.[k], obj) ?? fallback;
    } catch (_) {
      return fallback;
    }
  };

  const extractTextFromGemini = (data) => {
    const raw = safeGet(data, "candidates.0.content.parts.0.text", "");
    return String(raw || "").trim();
  };

  const stripCodeFence = (s) => s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // 5) Callsigns observer (debounced, lighter)
  const refreshCallsigns = debounce(() => {
    const spans = Array.from(document.querySelectorAll(SELECTORS.callsignSpans));
    if (!spans.length) return;
    knownCallsigns = spans
      .map((s) => (s.textContent || "").trim())
      .filter(Boolean)
      .join(", ")
      .toLocaleUpperCase();
  }, 150);

  observe(rootNode, refreshCallsigns, { childList: true, subtree: true });
  refreshCallsigns();

  // 6) Gemini main
  const correctWithGemini = async () => {
    if (state.destroyed) return;
    if (state.correctInFlight) {
      console.warn("⏳ Уже виконується запит, зачекай завершення.");
      return;
    }
    if (!window.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY відсутній.");
      return;
    }

    try {
      state.correctInFlight = true;

      const textarea = document.querySelector(SELECTORS.mainTextarea);
      if (!textarea) {
        console.error("❌ No textarea found");
        return;
      }

      const draftTranscript = (textarea.value || "").trim();
      if (!draftTranscript) {
        console.warn("⚠️ Textarea is empty");
        return;
      }

      const contextData = {
        callsigns: knownCallsigns.split(",").map((s) => s.trim()).filter(Boolean),
        jargon: specialWords.split(",").map((s) => s.trim()).filter(Boolean)
      };


        const urls = Array.from(document.querySelectorAll('audio'))
            .map(audio => audio.src || (audio.querySelector('source[src]')?.src || null))
            .filter(src => src !== null);
        const uniqueUrls = Array.from(new Set(urls));

        const filePromises = uniqueUrls.map(async (url) => {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => resolve({
                    inline_data: {
                        mime_type: blob.type || 'audio/mp3',
                        data: reader.result.split(',')[1]
                    }
                });
                reader.onerror = reject;
            });
        });

      console.log("Downloading audio files...");        
      const audioParts = await Promise.all(filePromises);
      console.log("✅ Done");
      console.log("Sending request...");        
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(window.GEMINI_API_KEY)}`;

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                contents: [{
                    parts: [{
                        text:
                            `Draft Transcription:\n${draftTranscript}\n\n` +
                            `Context:\n${JSON.stringify(contextData, null, 2)}`
                    }, ...audioParts]
                }],
                generationConfig: {
                    thinkingConfig: {
                        thinkingBudget: 1024
                    }
                }
            })
        });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
      }

      const data = await response.json();

      // Usage safe
      const usage = data?.usageMetadata || {};
      const promptTokens = Number(usage.promptTokenCount || 0);
      const outputTokens = Number(usage.candidatesTokenCount || 0);
      const totalTokens = Number(usage.totalTokenCount || (promptTokens + outputTokens));
      const thinkingTokens = Math.max(0, totalTokens - promptTokens - outputTokens);

      totalSession.input += promptTokens;
      totalSession.output += outputTokens;
      totalSession.thinking += thinkingTokens;

      const sessionCost =
        (totalSession.input / 1_000_000) * PRICE.input +
        (totalSession.output / 1_000_000) * PRICE.output +
        (totalSession.thinking / 1_000_000) * PRICE.thinking;

      console.log(`[Tokens] in=${promptTokens} out=${outputTokens} thinking=${thinkingTokens}`);
      console.log(`[Session] in=${totalSession.input} out=${totalSession.output} thinking=${totalSession.thinking}`);
      console.log(`[Session] cost=$${sessionCost.toFixed(6)}`);

      // Parse model response
      const raw = stripCodeFence(extractTextFromGemini(data));
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error("❌ JSON parse failed. Raw:", raw);
        throw e;
      }

      const correctedTranscript = String(parsed?.transcription || "");
      const conclusion = String(parsed?.conclusion || "");
      const callsigns = Array.isArray(parsed?.callsigns) ? parsed.callsigns : [];

      const textareas = document.querySelectorAll("textarea");
      if (textareas[0]) setReactTextarea(textareas[0], correctedTranscript);
      if (textareas[2]) setReactTextarea(textareas[2], conclusion);

      console.log("✅ Transcription:", correctedTranscript);
      console.log("✅ Conclusion:", conclusion);
      console.log("✅ Callsigns:", callsigns);
    } catch (error) {
      console.error("❌ An error occurred:", error);
    } finally {
      state.correctInFlight = false;
    }
  };

  // 7) Ctrl/Cmd state tracking
  on(document, "keydown", (e) => {
    if (e.ctrlKey || e.metaKey) state.isCtrlPressed = true;
  }, true);

  on(document, "keyup", (e) => {
    if (!e.ctrlKey && !e.metaKey) state.isCtrlPressed = false;
  }, true);

  on(window, "blur", () => {
    state.isCtrlPressed = false;
  });

    /**
     * Asynchronously clicking on elements in array
     * @param {HTMLElement[]} elements - array of the elements
     * @param {number} pauseMs - delay between clicks (ms)
     */
    async function clickSequentially(elements, pauseMs = 220) {
        for (const el of elements) {
            if (state.destroyed) break;
            if (!state.isCtrlPressed) {
                console.log("⏸️ Ctrl/Cmd released — auto-click stopped");
                break;
            }
            if (el && typeof el.click === "function") {
                el.click();
                await delay(pauseMs); // використовує зовнішню delay(), інтегровану з state.timers
            }
        }
    }

  // 8) Auto-click (delegated + sequential)
    const runAutoClickQueue = async (buttons) => {
        if (state.autoClickRunning) return;
        state.autoClickRunning = true;
        console.log("▶️ Starting auto-click (Ctrl/Cmd held)...");

        try {
            // Якщо потрібно клікати у зворотному порядку, додаємо .slice().reverse()
            await clickSequentially(buttons.slice().reverse(), 100);
            console.log("⏹️ Auto-click complete");
        } finally {
            state.autoClickRunning = false;
        }
    };

  on(document.body, "mousedown", (evt) => {
    const btn = evt.target.closest(SELECTORS.transcribeBtn);
    if (!btn) return;
    if (!(evt.ctrlKey || evt.metaKey || state.isCtrlPressed)) return;
    if (state.autoClickRunning) return;

    const allBtns = Array.from(document.querySelectorAll(SELECTORS.transcribeBtn));
    const idx = allBtns.indexOf(btn);
    const queue = idx !== -1 ? allBtns.slice(0, idx) : allBtns.slice();

    runAutoClickQueue(queue);
  }, true);

  // 9) Inject "Розпізнати" button once
  const ensureButton = debounce(() => {
    if (state.destroyed) return;
    const textarea = document.querySelector(SELECTORS.mainTextarea);
    if (!textarea) return;

    // If current button still in DOM -> nothing to do
    if (state.transcribeBtn && document.contains(state.transcribeBtn)) return;

    // Try to find previously injected button after React remount
    const sibling = textarea.parentElement?.querySelector('button[data-gemini-transcribe="1"]');
    if (sibling) {
      state.transcribeBtn = sibling;
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "🔊 Розпізнати";
    btn.setAttribute("data-gemini-transcribe", "1");
    btn.style.cssText = "margin-left:8px;cursor:pointer;";

    textarea.parentNode?.insertBefore(btn, textarea.nextSibling);
    btn.addEventListener("click", correctWithGemini);
    state.cleanup.push(() => btn.removeEventListener("click", correctWithGemini));

    state.transcribeBtn = btn;
  }, 120);

  observe(rootNode, ensureButton, { childList: true, subtree: true });
  ensureButton();

  // 10) Keyboard shortcuts (single delegated handler)
  const shortcutMap = {
    "alt+с":
      "#root > div > main > div > div.recordsGrid__player > div > div.rhap_main.rhap_horizontal-reverse > div.rhap_controls-section > div.rhap_additional-controls > div > span:nth-child(7) > button",
    "alt+ч":
      "#root > div > main > div > div.recordsGrid__player > div > div.rhap_main.rhap_horizontal-reverse > div.rhap_controls-section > div.rhap_main-controls > button.rhap_button-clear.rhap_main-controls-button.rhap_play-pause-button"
  };

  on(document.body, "keydown", (e) => {
    const combo = [e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift", String(e.key).toLowerCase()]
      .filter(Boolean)
      .join("+");

    const sel = shortcutMap[combo];
    if (!sel) return;

    e.preventDefault();
    const el = document.querySelector(sel);
    if (el) el.click();
  }, true);

  // 11) Teardown API
  const destroy = () => {
    if (state.destroyed) return;
    state.destroyed = true;

    for (const fn of state.cleanup.splice(0)) {
      try { fn(); } catch (_) {}
    }
    for (const mo of state.observers.splice(0)) {
      try { mo.disconnect(); } catch (_) {}
    }
    for (const t of state.timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    state.timers.clear();

    console.log("🧹 Gemini tool destroyed");
  };

  window.__geminiTool = {
    destroy,
    correctWithGemini,
    state
  };

  console.log("✅ Gemini tool initialized (React-safe, idempotent).");
})();
