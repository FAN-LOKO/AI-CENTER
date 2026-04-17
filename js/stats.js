function openDialog(dialogId, username, channel) {
  console.log('[stats] openDialog fired', { dialogId, username, channel });

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
    console.error('[stats] openDialog error', e);
  }
}

function navigateAgent(page) {
  try {
    window.parent?.postMessage?.({ type: 'navigate', page, tab: 'modules' }, '*');
  } catch (e) {
    console.error('[stats] navigateAgent error', e);
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
