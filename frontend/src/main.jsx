// frontend/src/index.js (or main.jsx for Vite default)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css'; // Import your global CSS

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
