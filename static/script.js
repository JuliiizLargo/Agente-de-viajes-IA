    const formKeys = document.getElementById('keys-form');
    const formChat = document.getElementById('chat-form');
    const chatBox = document.getElementById('chat-box');
    let GROQ_KEY = "";
    let SERP_KEY = "";

    function addMessage(text, sender) {
      const div = document.createElement('div');
      div.className = `message ${sender}`;
      if (sender === 'bot') {
        const formatted = formatBotAnswer(text);
        div.appendChild(formatted);
      } else {
        div.textContent = text;
      }
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function formatBotAnswer(answer) {
      const wrapper = document.createElement('div');
      const isItinerary = /Itinerario de\s+\d+\s+d[ií]as/i.test(answer) && /- Día\s*\d+/i.test(answer);

      if (!isItinerary) {
        wrapper.innerHTML = safeTextToHTML(answer);
        return wrapper;
      }

      const lines = answer.split('\n').map(l => l.trim()).filter(Boolean);

      const headerIdx = lines.findIndex(l => /^Itinerario de\s+\d+\s+d[ií]as/i.test(l));
      const headerText = headerIdx >= 0 ? lines[headerIdx] : 'Itinerario';

      const headerEl = document.createElement('div');
      headerEl.className = 'itinerary-header';
      headerEl.textContent = headerText;
      wrapper.appendChild(headerEl);

      const incluyeStart = lines.findIndex(l => /^Incluye:$/i.test(l));
      let incluyeList = [];
      if (incluyeStart >= 0) {
        for (let i = incluyeStart + 1; i < lines.length; i++) {
          const li = lines[i];
          if (!li.startsWith('•')) break;
          incluyeList.push(li.replace(/^•\s*/, ''));
        }
      }
      if (incluyeList.length) {
        const aside = document.createElement('div');
        aside.className = 'itinerary-aside';
        const title = document.createElement('div');
        title.className = 'aside-title';
        title.textContent = 'Incluye';
        const ul = document.createElement('ul');
        incluyeList.forEach(txt => {
          const li = document.createElement('li');
          li.textContent = txt;
          ul.appendChild(li);
        });
        aside.appendChild(title);
        aside.appendChild(ul);
        wrapper.appendChild(aside);
      }

      const dayBlocks = [];
      let current = [];
      for (const l of lines) {
        if (/^- Día\s*\d+/i.test(l)) {
          if (current.length) dayBlocks.push(current);
          current = [l];
        } else if (current.length) {
          if (/^(Incluye:|ℹ Nota:)/i.test(l)) continue;
          current.push(l);
        }
      }
      if (current.length) dayBlocks.push(current);

      const grid = document.createElement('div');
      grid.className = 'itinerary-grid';

      dayBlocks.forEach(block => {
        const card = document.createElement('article');
        card.className = 'itinerary-card';

        const titleLine = block.find(l => /^- Día\s*\d+/i.test(l)) || '- Día';
        const dayTitle = document.createElement('h3');
        dayTitle.textContent = titleLine.replace(/^- /, '');
        card.appendChild(dayTitle);

        const morning = block.find(l => /^Mañana:/i.test(l));
        const afternoon = block.find(l => /^Tarde:/i.test(l));
        const night = block.find(l => /^Noche:/i.test(l));
        const tip = block.find(l => /^Tip:/i.test(l));

        if (morning) card.appendChild(makeRow('Mañana', morning.replace(/^Mañana:\s*/i, '')));
        if (afternoon) card.appendChild(makeRow('Tarde', afternoon.replace(/^Tarde:\s*/i, '')));
        if (night) card.appendChild(makeRow('Noche', night.replace(/^Noche:\s*/i, '')));
        if (tip) card.appendChild(makeRow('Tip', tip.replace(/^Tip:\s*/i, '')));

        grid.appendChild(card);
      });

      wrapper.appendChild(grid);

      const disclaimer = lines.find(l => /^ℹ Nota:/i.test(l));
      if (disclaimer) {
        const note = document.createElement('div');
        note.className = 'disclaimer';
        note.textContent = disclaimer;
        wrapper.appendChild(note);
      }

      return wrapper;
    }

    function makeRow(label, text) {
      const row = document.createElement('div');
      row.className = 'itinerary-row';
      const k = document.createElement('span');
      k.className = 'row-key';
      k.textContent = label + ':';
      const v = document.createElement('span');
      v.className = 'row-val';
      v.textContent = text;
      row.appendChild(k);
      row.appendChild(v);
      return row;
    }

    function safeTextToHTML(text) {
      const esc = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return esc.replace(/\n/g, '<br/>');
    }

    formKeys.addEventListener('submit', (e) => {
      e.preventDefault();
      GROQ_KEY = document.getElementById('groq-key').value.trim();
      SERP_KEY = document.getElementById('serp-key').value.trim();
      if (!GROQ_KEY || !SERP_KEY) return;

      addMessage("✅ Claves guardadas. Ahora puedes hacer tus preguntas.", 'bot');
      formKeys.style.display = "none";
      formChat.style.display = "flex";
    });

    formChat.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = document.getElementById('question').value.trim();
      if (!question) return;

      addMessage(question, 'user');
      document.getElementById('question').value = '';

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            groq_key: GROQ_KEY,
            serp_key: SERP_KEY
          })
        });
        if (!res.ok) throw new Error('Error del servidor');
        const data = await res.json();
        addMessage(data.answer || 'Sin respuesta', 'bot');
      } catch (err) {
        addMessage('Ocurrió un error. Intenta nuevamente.', 'bot');
      }
    });