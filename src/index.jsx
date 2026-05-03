import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Der basename sorgt dafür, dass alle Routen relativ zum Repo-Namen funktionieren */}
    <BrowserRouter basename="/codespaces-react">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();