import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from "./router";
import { createI18n } from "vue-i18n";

import en from "./locales/en.json";
import ms from "./locales/ms.json";
import zh from "./locales/zh.json";

const i18n = createI18n({
  legacy: false,
  locale: "en", // default language
  messages: { en, ms, zh },
});

createApp(App).use(router).use(i18n).mount('#app');
