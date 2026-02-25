(async function transcribeAndCorrectAudio() {
  const apiKey = 'AIzaSyDcl1s8-nI3KMmch1hOt_z-XzmKCNJZnUA';
  const model = 'gemini-2.5-pro';

  const knownCallsigns = "АБРАМ, АГЛАР, АЛИТРИС, АЛИТРИШ, АРБУЗ, АРТИСТ, АРЧИ, АХМАТ, АХМЕД, АХРЫЗ, БАГАБ, БАЙКАЛ, БАРАЖ, БАРАШ, БАТЫР, БАЧА, БЕТОН, БЛЭК, БОГ, БОГА, БОД, БОДУН, БОЛЬШОЙ, БОРЗЫЙ, БОРОС, БОТ, БОЧА, БРАКОНЬЕР, БУБА, БУЛАЙ, БУРАН, ВАГА, ВИКТОР, ВИХРЬ, ВИШНЯ, ВОЛГА, ВОЛНА, ВОРОБЕЙ, ГНЕЗДО, ГНОМ, ГОВЕР, ГОД, ГОНЧАР, ГОРА, ГОФЕР, ГОША, ГРИБ, ГРОМ, ГРОМКИЙ, ГРУЗИН, ГУФИК, ДЕНЧИК, ДЖАНГО, ДИНА, ДОБРЫЙ, ДОВЖИК, ДОЗОР, ДОРОГОЙ, ДРУИД, ДУТЫЙ, ДЫНЯ, ДЭНЧИК, ЕЖИК, ЕФИМ, ЖАРА, ЖЕКА, ЖИВЧИК, ЖУЖИК, ЖУЛИК, ЗАРЯ, ЗЕМА, ЗОРЯ, ИРКУТ, ИРТЫШ, ИСАУЛ, КАБАН, КАВКАЗ, КАЗАХ, КАЗБЕК, КАЛДОН, КАЛУЗИН, КАМЫШ, КАРА, КАСКАД, КАСПЕР, КАССИР, КАСТЕТ, КБ, КЕША, КИЛЯ, КИРГИЗ, КЛИМ, КОБА, КОЗАХ, КОКА, КОЛДОН, КОЛДУН, КОНЬ, КОЩЕЙ, КРЕСТ, КРЕСТИК, КРУЗ, КРЫМ, КУВАЛДА, КУЗЯ, КУЛАГА, КУЧЕР, ЛАБУС, ЛАСТИК, ЛЕГЕЗИД, ЛЕГО, ЛЕМУР, ЛИМОН, ЛИМУР, ЛИС, ЛИСТИК, ЛОБА, ЛУЧИК, ЛЫСЫЙ, ЛЮТЫЙ, МАЖОР, МАЛАЙ, МАЛОЙ, МАЛЫШ, МАМАЙ, МАМОНТ, МАРАТ, МАЯК, МЕДВЕДЬ, МЕЛОМАН, МЕХАН, МИКРОФОН, МИХАЛЫЧ, МИХЕЙ, МОНГОЛ, МОРГАН, МОРДОР, МОРЯК, МОСКВА, МОТОРИСТ, МРАК, МУЗЫКАНТ, МУРАТ, НЕГР, НЕМЕЦ, НОСИ, ОКУНЬ, ОЛИМП, ОРЕЛ, ОСИП, ОТЕЦ, ПАК, ПРОФИ, ПРЯНИК, ПСИХ, ПУХ, ПЧЕЛА, РАТ, РАТНИК, РЕКВИЗИТ, РОН, РУС, РЫЖИЙ, САПУН, САТЕН, САФОН, СВЕТЛЫЙ, СВЯТОЙ, СЕЛИКУТА, СЕМЬ, СЕНА, СИМ СИМ, СКИВА, СМАЙЛ, СНЕГ, СОВА, СОКОЛ, СОЛОМА, СОРОКА, СОТЕН, СПАРТАК, СТАВРИК, СТАРЫЙ, СТРЕЛЕЦ, СУЕТА, СУЛТАН, СУМАТОХА, СУМРАК, СЫРКА, ТАЛАЛАЙ, ТАМЕРЛАН, ТАНЦОР, ТАТАРИН, ТОЛСТЫЙ, ТОМАС, ТОПОЛЬ, ТТ, ТУВА, ТУВИК, ТУЗИК, ТУМАН, ТУРИК, УРАЙ, УСИК, УФА, ФАРА, ФАРТОВЫЙ, ФЕНИКС, ФИЛДОН, ФИЛИН, ФИЛЯ, ФИН, ФМН, ФОКУСНИК, ХАЛЯВА, ХАН, ХАЧИК, ХИМИК, ХОДОК, ХОРА, ХРОМОЙ, ХУДРУК, ЦЕПУН, ЧАВА, ЧАУС, ЧЕВА, ЧЕЛА, ЧЕЛДОН, ЧЕРНОМОР, ЧЕХ, ЧИКА, ЧИНГИЗ, ЧОВА, ЧУБА, ЧУГУН, ЧУДАК, ЧУДО, ЧУЛА, ЧУЛДОН, ШАИАН, ШАМАН, ШАТЕН, ШЕГОЛ, ШЕЛДОН, ШИРКА, ШИФЕР, ШКАЛИК, ШМЕЛЬ, ШУГУР, ШУМИХА, ЩЕГОЛ, ЭЛЬДАР, ЯКУТ, ЯРЫЙ, ЯСЫРКА";
  const specialWords = "циркулярно,Костлявая,Старя,не прошло,повтори,180,200,300,350";

  // 💡 DROP YOUR PRE-TRANSCRIBED TEXT HERE
  const draftTranscript = `
  — Татарин, 2 ноля 4. Татарин, 2 ноля 4. Как принял?
  — Центру, Дрон плюс.
—
— Ермол, Цыгану связь. Ермол, Цыгану связь.
— Раскопа. Повтори.
— Прибыл Барс, Прибыл Барс.
— Тулан, Тулан, я Молот, я Тулан.
— Ты слышал? Плюс, плюс.
— Так, убудут дальше, доклад.
— Что там, операция закончилась?
`.trim();

  console.log("🔍 Step 1: Finding audio sources...");
  const urls = Array.from(document.querySelectorAll('audio'))
    .map(audio => audio.src || (audio.querySelector('source[src]')?.src || null))
    .filter(src => src !== null);

  if (urls.length === 0) return console.error("❌ No audio sources found.");

  console.log(`📥 Step 2: Fetching ${urls.length} audio files in parallel...`);

  try {
    // Fetch and convert ALL files at the same time (Much faster!)
    const filePromises = urls.map(async (url) => {
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

    // Wait for all files to be ready
    const audioParts = await Promise.all(filePromises);
    console.log("🚀 Step 3: Sending single batch request to Gemini...");

    // Build the prompt part
    const promptPart = {
      text: `You are a radio intercept transcriber. Review the provided draft transcript against the attached audio recordings. The audio quality is very poor.

Draft Transcript:
${draftTranscript}

Context to help you recognize words in the static:
- Known Callsigns: ${knownCallsigns}
- Special Words/Jargon: ${specialWords}

Task:
Correct any errors, omissions, or misheard words in the draft transcript based on what you hear in the audio files. Output ONLY the raw, corrected dialogue in the exact same format as the draft. Do not add commentary. Also, make the conclusion on what that conversation was all about. Output in Ukrainian language.`
        };

        // Combine the text prompt with ALL audio files
        const contentsParts = [promptPart, ...audioParts];

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: "Output strictly the raw dialogue. Do not add introductions or commentary." }]
                },
                contents: [{ parts: contentsParts }]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("❌ Gemini API Error:", data.error.message);
        } else {
            console.log("\n✅ === CORRECTED TRANSCRIPT ===\n");
            console.log(data.candidates[0].content.parts[0].text);
        }

    } catch (error) {
        console.error("❌ An error occurred:", error);
    }
})();
