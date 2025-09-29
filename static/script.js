const formChat = document.getElementById('chat-form');
const chatBox = document.getElementById('chat-box');

function addMessage(text, sender) {
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  div.innerHTML = sender === 'bot' ? text.replace(/\n/g, '<br/>') : text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

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
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    addMessage(data.answer || 'Sin respuesta', 'bot');
  } catch (err) {
    addMessage('Ocurrió un error. Intenta nuevamente.', 'bot');
  }
});
