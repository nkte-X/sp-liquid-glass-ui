import { render } from 'solid-js/web';
import App from './app/App';
import './app/App.css';

// The host copies its theme tokens into this iframe (incl. --is-dark-theme)
// and rewrites them in place on a theme switch. Mirror the mode as a class so
// the CSS can pick dark-specific contrast where a token alone isn't enough.
const syncMode = (): void => {
  const dark =
    getComputedStyle(document.documentElement).getPropertyValue('--is-dark-theme').trim() === '1';
  document.documentElement.classList.toggle('dark', dark);
};
syncMode();
const tokens = document.getElementById('injected-theme-vars');
if (tokens) {
  new MutationObserver(syncMode).observe(tokens, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

const root = document.getElementById('root');
if (root) render(() => <App />, root);
