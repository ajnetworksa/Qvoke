import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupGlobalErrorHandlers } from './utils/logger';
import { installCompanyFetch } from './utils/companyFetch';
import './index.css';

// Initialize global runtime exception and promise rejection logger
setupGlobalErrorHandlers();
installCompanyFetch();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
