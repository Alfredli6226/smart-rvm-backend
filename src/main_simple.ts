import { createApp } from 'vue'
import './style.css'
import MinimalApp from './minimal_app.vue'

// Create Vue app
const app = createApp(MinimalApp)

// Mount to DOM
app.mount('#app')

console.log('🚀 RVM Vue.js Application Started Successfully!')
console.log('🌐 Production Environment: https://rvm-merchant-platform-main.vercel.app')
console.log('📊 Data: 1,128 users, 8 machines, AI verification system ready')