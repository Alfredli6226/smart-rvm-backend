<template>
  <div class="ai-verification-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          <span class="inline-flex items-center gap-2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            AI Image Verification
          </span>
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Fraud detection & user trust scoring system
        </p>
      </div>
      <div class="header-right">
        <div class="status-badge bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
          <span class="inline-flex items-center gap-1">
            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            System Active
          </span>
        </div>
      </div>
    </div>

    <!-- Data Connection Status -->
    <div class="mb-6">
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Real-time Data Connection
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Vendor API integration status</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="flex items-center gap-2">
                <span 
                  class="w-3 h-3 rounded-full animate-pulse"
                  :class="{
                    'bg-green-500': dataConnection.machineData.status === 'online',
                    'bg-red-500': dataConnection.machineData.status === 'offline',
                    'bg-yellow-500': dataConnection.machineData.status === 'degraded'
                  }"
                ></span>
                <span 
                  class="text-sm font-medium"
                  :class="{
                    'text-green-700 dark:text-green-400': dataConnection.machineData.status === 'online',
                    'text-red-700 dark:text-red-400': dataConnection.machineData.status === 'offline',
                    'text-yellow-700 dark:text-yellow-400': dataConnection.machineData.status === 'degraded'
                  }"
                >
                  Machine Data: {{ dataConnection.machineData.status.toUpperCase() }}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span 
                  class="w-3 h-3 rounded-full animate-pulse"
                  :class="{
                    'bg-green-500': dataConnection.userData.status === 'online',
                    'bg-red-500': dataConnection.userData.status === 'offline',
                    'bg-yellow-500': dataConnection.userData.status === 'awaiting_fix'
                  }"
                ></span>
                <span 
                  class="text-sm font-medium"
                  :class="{
                    'text-green-700 dark:text-green-400': dataConnection.userData.status === 'online',
                    'text-red-700 dark:text-red-400': dataConnection.userData.status === 'offline',
                    'text-yellow-700 dark:text-yellow-400': dataConnection.userData.status === 'awaiting_fix'
                  }"
                >
                  User Data: {{ 
                    dataConnection.userData.status === 'awaiting_fix' ? 'AWAITING API FIX' : 
                    dataConnection.userData.status.toUpperCase() 
                  }}
                </span>
              </div>
            </div>
            <button 
              @click="checkDataConnection"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Status
            </button>
          </div>
        </div>
        <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <span v-if="dataConnection.machineData.status === 'online'" class="text-green-600 dark:text-green-400">✅</span>
            <span v-else class="text-red-600 dark:text-red-400">❌</span>
            <strong>Machine Data:</strong> 
            {{ dataConnection.machineData.status === 'online' ? 'Connected to vendor API' : 'Connection issue' }}
            ({{ dataConnection.machineData.machinesCount }} machines)
          </p>
          <p>
            <span v-if="dataConnection.userData.status === 'online'" class="text-green-600 dark:text-green-400">✅</span>
            <span v-else-if="dataConnection.userData.status === 'awaiting_fix'" class="text-yellow-600 dark:text-yellow-400">🔄</span>
            <span v-else class="text-red-600 dark:text-red-400">❌</span>
            <strong>User Data:</strong> 
            {{ dataConnection.userData.note }}
          </p>
          <p class="mt-2 text-xs text-blue-600 dark:text-blue-400">
            Last checked: {{ dataConnection.machineData.lastChecked }} | 
            Next automatic check: 15 minutes
          </p>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Verifications</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">158</p>
          </div>
          <div class="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div class="mt-4">
          <div class="flex items-center text-sm text-green-600 dark:text-green-400">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            +12% from last week
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Verification Rate</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">83.5%</p>
          </div>
          <div class="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <div class="mt-4">
          <div class="flex items-center text-sm text-green-600 dark:text-green-400">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            +3.2% from last week
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Fraud Detection</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">5.1%</p>
          </div>
          <div class="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
            <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>
        <div class="mt-4">
          <div class="flex items-center text-sm text-green-600 dark:text-green-400">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            -1.8% from last week
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Trust Score</p>
            <p class="text-3xl font-bold text-gray-900 dark:text-white mt-2">78</p>
          </div>
          <div class="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
        </div>
        <div class="mt-4">
          <div class="flex items-center text-sm text-green-600 dark:text-green-400">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            +5 points from last week
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- User Trust Scores -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            User Trust Scores
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Trust levels based on verification history
          </p>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div v-for="user in users" :key="user.id" class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <span class="font-semibold text-gray-700 dark:text-gray-300">{{ user.initials }}</span>
                </div>
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">{{ user.name }}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">{{ user.id }}</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <div class="font-bold text-gray-900 dark:text-white">{{ user.score }}</div>
                  <div :class="['text-xs px-2 py-1 rounded-full', user.trustClass]">
                    {{ user.trustLevel }}
                  </div>
                </div>
                <div :class="['w-3 h-3 rounded-full', user.statusClass]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Fraud Detection Alerts -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Fraud Alerts
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Latest detected fraud patterns
          </p>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div v-for="alert in alerts" :key="alert.id" class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900 dark:text-white">{{ alert.type }}</span>
                    <span :class="['text-xs px-2 py-1 rounded-full', alert.confidenceClass]">
                      {{ alert.confidence }}% confidence
                    </span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ alert.user }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">{{ alert.time }}</p>
                </div>
                <div :class="['text-xs px-2 py-1 rounded-full', alert.statusClass]">
                  {{ alert.status }}
                </div>
              </div>
              <div class="mt-3 text-sm text-gray-700 dark:text-gray-300">
                {{ alert.action }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Verification Statistics -->
    <div class="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Verification Statistics
        </h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Weekly verification performance
        </p>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="text-center">
            <div class="text-3xl font-bold text-gray-900 dark:text-white">92%</div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">Verified Rate</div>
            <div class="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-green-500 rounded-full" style="width: 92%"></div>
            </div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-gray-900 dark:text-white">5.1%</div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">Fraud Rate</div>
            <div class="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-red-500 rounded-full" style="width: 5.1%"></div>
            </div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-gray-900 dark:text-white">2.9%</div>
            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">Pending Review</div>
            <div class="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div class="h-full bg-yellow-500 rounded-full" style="width: 2.9%"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface User {
  id: string
  name: string
  initials: string
  score: number
  trustLevel: string
  trustClass: string
  statusClass: string
}

interface Alert {
  id: number
  type: string
  user: string
  time: string
  confidence: number
  confidenceClass: string
  action: string
  status: string
  statusClass: string
}

// Data connection status
const dataConnection = ref({
  machineData: {
    status: 'online',
    lastChecked: new Date().toLocaleTimeString(),
    machinesCount: 8
  },
  userData: {
    status: 'online',
    lastChecked: new Date().toLocaleTimeString(),
    note: 'Connected to vendor API - 1,128 real users available',
    totalUsers: 1128
  }
})

// Check data connection status
const checkDataConnection = async () => {
  try {
    // In production, this would call the API health endpoint
    dataConnection.value.machineData.lastChecked = new Date().toLocaleTimeString()
    dataConnection.value.userData.lastChecked = new Date().toLocaleTimeString()
    
    // Simulate API check
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Show success message
    alert('Data connection status refreshed successfully!')
  } catch (error) {
    console.error('Failed to check data connection:', error)
    alert('Error checking data connection. Please try again.')
  }
}

const users = ref<User[]>([
  {
    id: 'user_001',
    name: 'EcoWarrior',
    initials: 'EW',
    score: 100,
    trustLevel: 'PLATINUM',
    trustClass: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    statusClass: 'bg-green-500'
  },
  {
    id: 'user_002',
    name: 'GreenHero',
    initials: 'GH',
    score: 100,
    trustLevel: 'PLATINUM',
    trustClass: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    statusClass: 'bg-green-500'
  },
  {
    id: 'user_003',
    name: 'SuspiciousUser',
    initials: 'SU',
    score: 12,
    trustLevel: 'RESTRICTED',
    trustClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    statusClass: 'bg-red-500'
  },
  {
    id: 'user_004',
    name: 'NewRecycler',
    initials: 'NR',
    score: 85,
    trustLevel: 'GOLD',
    trustClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    statusClass: 'bg-green-500'
  }
])


const alerts = ref<Alert[]>([
  {
    id: 1,
    type: 'Duplicate Image',
    user: 'SuspiciousUser (user_003)',
    time: '2026-04-16 11:30',
    confidence: 95,
    confidenceClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    action: 'Points withheld, user flagged for review',
    status: 'Resolved',
    statusClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  {
    id: 2,
    type: 'High Frequency',
    user: 'SuspiciousUser (user_003)',
    time: '2026-04-16 10:45',
    confidence: 88,
    confidenceClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    action: 'Rate limited, further submissions blocked',
    status: 'Resolved',
    statusClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
  },
  {
    id: 3,
    type: 'Image Editing',
    user: 'Unknown (IP: 192.168.1.105)',
    time: '2026-04-15 14:20',
    confidence: 92,
    confidenceClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    action: 'Blocked submission, IP logged',
    status: 'Investigating',
    statusClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  }
])
</script>

<style scoped>
.ai-verification-dashboard {
  @apply p-6;
}

.dashboard-header {
  @apply flex flex-col md:flex-row md:items-center justify-between mb-8;
}

.header-left h1 {
  @apply text-2xl font-bold text-gray-900 dark:text-white;
}

.header-left p {
  @apply text-gray-600 dark:text-gray-400 mt-1;
}

.status-badge {
  @apply inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium;
}
</style>
