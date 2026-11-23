import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#17302a', color: '#eef3ee', border: '1px solid #2a4a41', fontFamily: 'Figtree, sans-serif' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
