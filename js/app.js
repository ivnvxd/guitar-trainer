/* Start: apply settings, route to the page in the link, and enable offline use on HTTPS. */
(function (root) {
  'use strict';
  const GT = root.GT;
  GT.audio.setVoice(GT.settings.voice);
  GT.audio.setVolume(GT.settings.volume);
  GT.applySound();
  GT.applyTheme();
  const sound = document.querySelector('.sound-btn');
  if (sound) sound.addEventListener('click', () => GT.setMuted(!GT.settings.muted));
  root.addEventListener('hashchange', GT.render);
  GT.render();
  if ('serviceWorker' in navigator && root.isSecureContext && root.location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* the site works without it */ });
  }
})(window);
