import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return <h1>SlotHelper 後台</h1>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
