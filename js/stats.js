let agentStatsState = {
  dialogsTotal: 0,
  refLinksTotal: 0,
  dialogsToday: 0,
  refLinksToday: 0,
  dialogs: [],
  issuedLinks: []
};

function navigateAgent(page) {
  try {
    window.parent?.postMessage?.({ type: 'navigate', page, tab: 'modules' }, '*');
  } catch (e) {
    console.error(e);
  }
}

function toggleAccordion(button) {
  const card = button.closest('.accordion-card');
  const body = card && card.querySelector(':scope > .accordion-body');
  if (!card || !body) return;

  const isOpen = card.classList.contains('open');
  card.classList.toggle('open', !isOpen);
  body.style.display = isOpen ? 'none' : 'block';
}

function normalizeStats(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  return {
    dialogsTotal: Number(data.dialogsTotal || 0),
    refLinksTotal: Number(data.refLinksTotal || 0),
    dialogsToday: Number(data.dialogsToday || 0),
    refLinksToday: Number(data.refLinksToday || 0),
    dialogs: Array.isArray(data.dialogs) ? data.dialogs : [],
    issuedLinks: Array.isArray(data.issuedLinks) ? data.issuedLinks : []
  };
}

function getAgentStatsState() {
  try {
    const directState = window.parent?.AICAppShell?.getAgentStats?.();
    if (directState && typeof directState === 'object') {
      return normalizeStats(directState);
    }
  } catch (error) {
    console.error('[AI CENTER][Agent Stats] stats state read failed', error);
  }

  return normalizeStats(agentStatsState);
}

function setAgentStatsState(nextState) {
  agentStatsState = normalizeStats(nextState);
  applyStats();
}

function requestAgentStats() {
  try {
    window.parent?.postMessage?.({ type: 'agent-stats-request' }, '*');
  } catch (error) {
    console.error('[AI CENTER][Agent Stats] request failed', error);
  }
}

function setText(id, value, fallback) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value !== undefined && value !== null && value !== '' ? value : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function openDialog(dialogId, username, channel) {
  try {
    window.parent?.postMessage?.(
      {
        type: 'agent-open-dialog',
        dialogId,
        username,
        channel
      },
      '*'
    );
  } catch (e) {
    console.error(e);
  }
}

function renderDialogs(dialogs) {
  const listEl = document.getElementById('dialogsList');
  if (!listEl) return;

  if (!Array.isArray(dialogs) || dialogs.length === 0) {
    listEl.innerHTML = '<div class="module-notice">Пока нет данных по диалогам.</div>';
    return;
  }

  const html = dialogs.map(function (dialog) {
    const dialogId = dialog.id || '';
    const username = dialog.username || 'Без имени';
    const channel = dialog.channel || 'Telegram';
    const time = dialog.timeLabel || '—';
    const lastMessage = dialog.lastMessage || 'Сообщений пока нет';

    return (
      '<div class="dialog-item" ' +
        'data-dialog-id="' + escapeHtml(dialogId) + '" ' +
        'data-username="' + escapeHtml(username) + '" ' +
        'data-channel="' + escapeHtml(channel) + '">' +
        '<div class="dialog-item-row">' +
          '<span class="dialog-user">' + escapeHtml(username) + '</span>' +
          '<span class="dialog-time">' + escapeHtml(time) + '</span>' +
        '</div>' +
        '<div class="dialog-last-msg">' + escapeHtml(lastMessage) + '</div>' +
      '</div>'
    );
  }).join('');

  listEl.innerHTML = html;
}

function renderIssuedLinks(items) {
  const listEl = document.getElementById('issuedLinksList');
  if (!listEl) return;

  if (!Array.isArray(items) || items.length === 0) {
    listEl.innerHTML = '<div class="module-notice">Пока нет данных по выданным ссылкам.</div>';
    return;
  }

  const html = items.map(function (item) {
    return (
      '<div class="stats-issued-card">' +
        '<div class="module-summary">' +
          '<div class="module-summary-row">' +
            '<div class="module-summary-label">Кому</div>' +
            '<div class="module-summary-value">' + escapeHtml(item.username || '—') + '</div>' +
          '</div>' +
          '<div class="module-summary-row">' +
            '<div class="module-summary-label">Тип ссылки</div>' +
            '<div class="module-summary-value">' + escapeHtml(item.linkType || '—') + '</div>' +
          '</div>' +
          '<div class="module-summary-row">' +
            '<div class="module-summary-label">Время</div>' +
            '<div class="module-summary-value">' + escapeHtml(item.timeLabel || '—') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  listEl.innerHTML = html;
}

function applyStats() {
  const stats = getAgentStatsState();

  setText('statDialogsTotal', stats.dialogsTotal, '0');
  setText('statRefLinksTotal', stats.refLinksTotal, '0');
  setText('statDialogsToday', stats.dialogsToday, '0');
  setText('statRefLinksToday', stats.refLinksToday, '0');

  renderDialogs(stats.dialogs);
  renderIssuedLinks(stats.issuedLinks);
}

function bindDialogsClick() {
  const listEl = document.getElementById('dialogsList');
  if (!listEl) return;

  listEl.addEventListener('click', function (event) {
    const item = event.target.closest('.dialog-item');
    if (!item) return;

    const dialogId = item.getAttribute('data-dialog-id') || '';
    const username = item.getAttribute('data-username') || '';
    const channel = item.getAttribute('data-channel') || 'Telegram';

    openDialog(dialogId, username, channel);
  });
}

window.addEventListener('message', function (event) {
  const data = event && event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'agent-stats-response' && data.stats) {
    setAgentStatsState(data.stats);
    return;
  }

  if (data.type === 'agent-stats-update' && data.stats) {
    setAgentStatsState(data.stats);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  try {
    window.Telegram?.WebApp?.ready?.();
  } catch (e) {}

  bindDialogsClick();
  applyStats();
  requestAgentStats();
});
