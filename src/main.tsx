import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { registerPushNotifications } from './pushService';

// Boot up native device Background/Push Notifications system scaffolding
registerPushNotifications();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
